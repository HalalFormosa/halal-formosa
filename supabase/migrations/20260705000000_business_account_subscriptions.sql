-- Account-level (per-owner) business subscription. The tier applies to ALL
-- locations the owner owns; location_plans.tier is a synced reflection so all
-- existing gating (triggers, analytics RPC, entitlements) keeps reading it.

create table if not exists public.business_subscriptions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  tier       text not null default 'free'   check (tier in ('free','bronze','silver','gold')),
  source     text not null default 'manual' check (source in ('complimentary','manual','revenuecat')),
  status     text not null default 'active' check (status in ('active','expired','canceled')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.business_subscriptions enable row level security;
create policy business_subscriptions_select on public.business_subscriptions
  for select using (user_id = auth.uid() or public.is_admin());
grant select on public.business_subscriptions to authenticated;

-- Core: set an owner's tier + fan out to every location they own.
-- Service-role only (the RevenueCat webhook); admins go through the wrapper below.
create or replace function public.apply_owner_business_tier(
  p_user_id uuid, p_tier text, p_source text default 'revenuecat', p_expires_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.business_subscriptions(user_id, tier, source, status, expires_at, updated_at)
  values (p_user_id, p_tier, p_source, case when p_tier='free' then 'expired' else 'active' end, p_expires_at, now())
  on conflict (user_id) do update
    set tier=excluded.tier, source=excluded.source, status=excluded.status,
        expires_at=excluded.expires_at, updated_at=now();

  insert into public.location_plans(location_id, tier, source, status, updated_at)
  select o.location_id, p_tier, p_source, 'active', now()
  from public.location_owners o
  where o.user_id = p_user_id and o.role = 'owner'
  on conflict (location_id) do update
    set tier=excluded.tier, source=excluded.source, updated_at=now();
end; $$;
revoke execute on function public.apply_owner_business_tier(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_owner_business_tier(uuid, text, text, timestamptz) to service_role;

-- Admin wrapper: set tier for the owner of a given location (fans out).
create or replace function public.admin_set_business_tier_for_location(p_location_id integer, p_tier text)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select user_id into v_owner from public.location_owners
    where location_id=p_location_id and role='owner' order by created_at asc limit 1;
  if v_owner is null then
    insert into public.location_plans(location_id, tier, source, updated_at)
    values (p_location_id, p_tier, 'manual', now())
    on conflict (location_id) do update set tier=excluded.tier, source='manual', updated_at=now();
  else
    perform public.apply_owner_business_tier(v_owner, p_tier, 'manual', null);
  end if;
end; $$;
grant execute on function public.admin_set_business_tier_for_location(integer, text) to authenticated;

-- Recreate approve_claim so a newly-claimed business inherits the owner's
-- current subscription tier (instead of always 'free').
create or replace function public.approve_claim(p_claim_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_claim public.location_claims;
begin
  if not public.is_admin() then raise exception 'Only admins can approve claims'; end if;
  select * into v_claim from public.location_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;

  update public.location_claims
     set status='approved', reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
   where id = p_claim_id;

  insert into public.location_owners (location_id, user_id, role)
  values (v_claim.location_id, v_claim.user_id,
          case when v_claim.claimant_role='manager' then 'manager' else 'owner' end)
  on conflict (location_id, user_id) do nothing;

  update public.locations set is_claimed = true where id = v_claim.location_id;

  insert into public.location_plans (location_id, tier, source)
  select v_claim.location_id, coalesce(bs.tier,'free'), coalesce(bs.source,'complimentary')
  from (select v_claim.user_id as uid) u
  left join public.business_subscriptions bs on bs.user_id = u.uid
  on conflict (location_id) do update set tier=excluded.tier, source=excluded.source;
end; $$;
