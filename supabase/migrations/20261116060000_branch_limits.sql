-- Branch limits per Business plan.
--
-- How many stores ONE owner can hold: Free 1, Bronze 2, Silver 5, Gold 10
-- (app_config 'business_plan_features' -> maxBranches, -1 = unlimited).
-- An owner's plan is the highest of their active business subscription and the
-- plans of the stores they own, so a partner-granted Gold counts, and so do
-- partner stores (they count towards the limit like any other store).
-- Above the limit an owner contacts Halal Formosa; an admin raises that owner's
-- quota with admin_set_branch_quota() (stored in owner_branch_quota_overrides).
--
-- Enforced when a claim is SUBMITTED (trigger on location_claims). Admins can
-- still approve claims and assign owners by hand, which is the override path.
-- Only owner-type claims count: manager claims create 'manager' rows, not owners.

-- 1) maxBranches in the plan matrix
update public.app_config set value = (
  select jsonb_object_agg(t.k, t.v || jsonb_build_object('maxBranches',
           case t.k when 'free' then 1 when 'bronze' then 2 when 'silver' then 5 when 'gold' then 10 else 1 end))::text
    from jsonb_each(value::jsonb) as t(k, v))
 where key = 'business_plan_features';

-- 2) per-owner quota overrides ("contact us to negotiate more branches")
create table if not exists public.owner_branch_quota_overrides (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  max_branches integer not null check (max_branches >= 1),
  note         text,
  updated_at   timestamptz not null default now()
);
alter table public.owner_branch_quota_overrides enable row level security;
drop policy if exists "admins manage branch quotas" on public.owner_branch_quota_overrides;
create policy "admins manage branch quotas" on public.owner_branch_quota_overrides
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3) tier + limit helpers
create or replace function public.owner_plan_tier(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case greatest(
           coalesce((select public.plan_rank(bs.tier) from public.business_subscriptions bs
                      where bs.user_id = p_user and bs.status = 'active'
                        and (bs.expires_at is null or bs.expires_at > now())), 0),
           coalesce((select max(public.plan_rank(lp.tier))
                       from public.location_plans lp
                       join public.location_owners lo on lo.location_id = lp.location_id
                      where lo.user_id = p_user and lo.role = 'owner' and lp.status = 'active'
                        and (lp.expires_at is null or lp.expires_at > now())), 0))
         when 3 then 'gold' when 2 then 'silver' when 1 then 'bronze' else 'free' end;
$$;
revoke all on function public.owner_plan_tier(uuid) from public, anon, authenticated;

-- -1 = unlimited
create or replace function public.owner_branch_limit(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select o.max_branches from public.owner_branch_quota_overrides o where o.user_id = p_user),
    (select (c.value::jsonb -> public.owner_plan_tier(p_user) ->> 'maxBranches')::int
       from public.app_config c where c.key = 'business_plan_features'),
    case public.owner_plan_tier(p_user) when 'bronze' then 2 when 'silver' then 5 when 'gold' then 10 else 1 end
  );
$$;
revoke all on function public.owner_branch_limit(uuid) from public, anon, authenticated;

create or replace function public.owner_branch_usage(p_user uuid)
returns table (used integer, pending integer)
language sql
stable
security definer
set search_path = public
as $$
  select (select count(*)::int from public.location_owners lo where lo.user_id = p_user and lo.role = 'owner'),
         (select count(*)::int from public.location_claims c
           where c.user_id = p_user and c.status = 'pending' and c.claimant_role <> 'manager');
$$;
revoke all on function public.owner_branch_usage(uuid) from public, anon, authenticated;

-- 4) what the app shows
create or replace function public.get_my_branch_quota()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer; v_used integer; v_pending integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_limit := public.owner_branch_limit(v_uid);
  select u.used, u.pending into v_used, v_pending from public.owner_branch_usage(v_uid) u;
  return jsonb_build_object(
    'tier', public.owner_plan_tier(v_uid),
    'limit', v_limit,
    'used', v_used,
    'pending', v_pending,
    'can_claim', (v_limit < 0 or v_used + v_pending < v_limit)
  );
end;
$$;
revoke all on function public.get_my_branch_quota() from public, anon;
grant execute on function public.get_my_branch_quota() to authenticated;

-- 5) enforcement on claim submission
create or replace function public.enforce_branch_limit_on_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_limit integer; v_used integer; v_pending integer;
begin
  if new.claimant_role = 'manager' or public.is_admin() then return new; end if;
  v_limit := public.owner_branch_limit(new.user_id);
  if v_limit < 0 then return new; end if;
  select u.used, u.pending into v_used, v_pending from public.owner_branch_usage(new.user_id) u;
  if v_used + v_pending >= v_limit then
    raise exception 'branch_limit_reached';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_branch_limit_on_claim on public.location_claims;
create trigger trg_branch_limit_on_claim
  before insert on public.location_claims
  for each row execute function public.enforce_branch_limit_on_claim();

-- 6) admin: raise (or reset) one owner's quota after negotiating with them
create or replace function public.admin_set_branch_quota(p_user uuid, p_max integer, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_max is null then
    delete from public.owner_branch_quota_overrides where user_id = p_user;
  else
    insert into public.owner_branch_quota_overrides (user_id, max_branches, note, updated_at)
    values (p_user, p_max, p_note, now())
    on conflict (user_id) do update
      set max_branches = excluded.max_branches, note = excluded.note, updated_at = now();
  end if;
end;
$$;
revoke all on function public.admin_set_branch_quota(uuid, integer, text) from public, anon;
grant execute on function public.admin_set_branch_quota(uuid, integer, text) to authenticated;
