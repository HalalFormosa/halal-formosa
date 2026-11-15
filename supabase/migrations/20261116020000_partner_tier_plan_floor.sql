-- A paying merchant partner's stores get at least the matching Business plan.
--
-- Rule: if a location belongs to an active MERCHANT partner (locations.partner_id),
-- its Business plan (location_plans.tier) can never be lower than the partner's
-- tier (partners.partner_tier: gold/silver/bronze). The partner "paid through
-- other means", so it is not tied to the owner's RevenueCat subscription.
--
-- Certifying bodies (partner_type = 'halal_body') and other partner types are
-- deliberately excluded: the stores they certify did not pay.
--
-- Implemented as a floor trigger on location_plans so EVERY writer (RevenueCat
-- sync, claim approval, admin dropdown) is covered and none can downgrade a
-- partner store. All readers (client, limit triggers, analytics) keep reading
-- location_plans unchanged. A higher paid tier still wins over the floor.

alter table public.location_plans drop constraint if exists location_plans_source_check;
alter table public.location_plans add constraint location_plans_source_check
  check (source = any (array['complimentary'::text, 'manual'::text, 'revenuecat'::text, 'partner'::text]));

create or replace function public.plan_rank(p_tier text)
returns integer
language sql
immutable
as $$
  select case p_tier when 'bronze' then 1 when 'silver' then 2 when 'gold' then 3 else 0 end;
$$;

-- The minimum plan a location is entitled to through its partner (null = none).
create or replace function public.partner_plan_floor(p_location_id integer)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.partner_tier
    from public.locations l
    join public.partners p on p.id = l.partner_id
   where l.id = p_location_id
     and p.is_active
     and p.partner_type = 'merchant'
     and p.partner_tier in ('bronze', 'silver', 'gold');
$$;
revoke all on function public.partner_plan_floor(integer) from public, anon, authenticated;

-- BEFORE INSERT/UPDATE on location_plans: never below the partner floor.
create or replace function public.enforce_partner_plan_floor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_floor text := public.partner_plan_floor(new.location_id);
begin
  if v_floor is not null and public.plan_rank(v_floor) > public.plan_rank(new.tier) then
    new.tier := v_floor;
    new.source := 'partner';
    new.status := 'active';
    new.expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_partner_plan_floor on public.location_plans;
create trigger trg_partner_plan_floor
  before insert or update on public.location_plans
  for each row execute function public.enforce_partner_plan_floor();

-- Re-evaluate one location's plan after its partner link or the partner changes.
create or replace function public.sync_partner_plan(p_location_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_floor text := public.partner_plan_floor(p_location_id); v_cur public.location_plans;
begin
  select * into v_cur from public.location_plans where location_id = p_location_id;

  if not found then
    if v_floor is not null then
      insert into public.location_plans (location_id, tier, source) values (p_location_id, v_floor, 'partner');
    end if;
    return;
  end if;

  if v_floor is not null then
    -- touch the row: the BEFORE trigger lifts it to the floor if it is lower
    update public.location_plans set updated_at = now() where location_id = p_location_id;
  elsif v_cur.source = 'partner' then
    -- partner link/tier removed: a partner-granted plan goes back to free
    update public.location_plans set tier = 'free', source = 'complimentary', updated_at = now()
     where location_id = p_location_id;
  end if;

  -- partner tier lowered (e.g. gold -> silver): drop a partner-granted plan to the new floor
  if v_floor is not null and v_cur.source = 'partner' and public.plan_rank(v_cur.tier) > public.plan_rank(v_floor) then
    update public.location_plans set tier = v_floor, updated_at = now() where location_id = p_location_id;
  end if;
end;
$$;
revoke all on function public.sync_partner_plan(integer) from public, anon, authenticated;

create or replace function public.trg_sync_plan_on_location_partner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.partner_id is distinct from old.partner_id then
    perform public.sync_partner_plan(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_sync_plan_on_location_partner on public.locations;
create trigger trg_sync_plan_on_location_partner
  after insert or update of partner_id on public.locations
  for each row execute function public.trg_sync_plan_on_location_partner();

create or replace function public.trg_sync_plan_on_partner_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  for r in select l.id from public.locations l where l.partner_id = new.id loop
    perform public.sync_partner_plan(r.id);
  end loop;
  return new;
end;
$$;
drop trigger if exists trg_sync_plan_on_partner_change on public.partners;
create trigger trg_sync_plan_on_partner_change
  after update of partner_tier, is_active, partner_type on public.partners
  for each row execute function public.trg_sync_plan_on_partner_change();

-- Backfill: apply the rule to every location that already has a partner.
do $$
declare r record;
begin
  for r in select id from public.locations where partner_id is not null loop
    perform public.sync_partner_plan(r.id);
  end loop;
end $$;
