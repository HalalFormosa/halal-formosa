-- Make a person a store owner by EMAIL, even before they have an account.
--
-- An admin adds an email to a store. If a confirmed account with that email
-- already exists they become owner/manager immediately; otherwise a pending
-- invite is kept and applied automatically the first time that email logs in
-- (confirmed email only), on the web app or the mobile app. This is what lets a
-- store owner who only uses the web app redeem codes, as long as they are
-- logged in with the email the admin set.

create table if not exists public.pending_location_owners (
  id          uuid primary key default gen_random_uuid(),
  location_id integer not null references public.locations(id) on delete cascade,
  email       text not null check (email = lower(btrim(email)) and email like '%@%'),
  role        text not null default 'owner' check (role in ('owner', 'manager')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  claimed_by  uuid references auth.users(id) on delete set null
);
create unique index if not exists pending_location_owners_open_key
  on public.pending_location_owners (location_id, email) where claimed_at is null;
alter table public.pending_location_owners enable row level security;
drop policy if exists "admins manage owner invites" on public.pending_location_owners;
create policy "admins manage owner invites" on public.pending_location_owners
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Same effects as approve_claim, minus the claim: ownership row, claimed flag,
-- and a plan row only if the store has none (never overwrites an existing plan).
create or replace function public._assign_store_owner(p_location_id integer, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.location_owners (location_id, user_id, role)
  values (p_location_id, p_user, case when p_role = 'manager' then 'manager' else 'owner' end)
  on conflict (location_id, user_id) do nothing;

  update public.locations set is_claimed = true where id = p_location_id and not is_claimed;

  insert into public.location_plans (location_id, tier, source)
  select p_location_id, coalesce(bs.tier, 'free'), coalesce(bs.source, 'complimentary')
    from (select p_user as uid) u
    left join public.business_subscriptions bs on bs.user_id = u.uid
  on conflict (location_id) do nothing;
end;
$$;
revoke all on function public._assign_store_owner(integer, uuid, text) from public, anon, authenticated;

-- Admin: add an owner/manager by email. Returns 'added' or 'invited'.
create or replace function public.admin_add_location_owner(p_location_id integer, p_email text, p_role text default 'owner')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role text := coalesce(p_role, 'owner');
  v_user uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  if v_role not in ('owner', 'manager') then raise exception 'invalid_role'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if not exists (select 1 from public.locations where id = p_location_id) then raise exception 'location_not_found'; end if;

  select u.id into v_user from auth.users u
   where lower(u.email) = v_email and u.email_confirmed_at is not null
   limit 1;

  if v_user is not null then
    perform public._assign_store_owner(p_location_id, v_user, v_role);
    return 'added';
  end if;

  insert into public.pending_location_owners (location_id, email, role, created_by)
  values (p_location_id, v_email, v_role, auth.uid())
  on conflict (location_id, email) where claimed_at is null do update set role = excluded.role;
  return 'invited';
end;
$$;
revoke all on function public.admin_add_location_owner(integer, text, text) from public, anon;
grant execute on function public.admin_add_location_owner(integer, text, text) to authenticated;

-- Called after login: applies any invites for the signed-in, CONFIRMED email.
create or replace function public.accept_my_pending_owner_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  r record;
  v_n integer := 0;
begin
  if v_uid is null then return 0; end if;
  select lower(u.email) into v_email from auth.users u
   where u.id = v_uid and u.email_confirmed_at is not null and u.email is not null;
  if v_email is null then return 0; end if;

  for r in select * from public.pending_location_owners p
            where p.claimed_at is null and p.email = v_email loop
    perform public._assign_store_owner(r.location_id, v_uid, r.role);
    update public.pending_location_owners set claimed_at = now(), claimed_by = v_uid where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.accept_my_pending_owner_invites() from public, anon;
grant execute on function public.accept_my_pending_owner_invites() to authenticated;

-- Admin: who owns a store (with emails) plus open invites.
create or replace function public.admin_list_location_owners(p_location_id integer)
returns table (kind text, user_id uuid, email text, display_name text, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return query
    select 'owner'::text, lo.user_id, u.email::text, up.display_name, lo.role::text, lo.created_at
      from public.location_owners lo
      left join auth.users u on u.id = lo.user_id
      left join public.user_profiles up on up.id = lo.user_id
     where lo.location_id = p_location_id
    union all
    select 'invite'::text, null::uuid, p.email, null::text, p.role, p.created_at
      from public.pending_location_owners p
     where p.location_id = p_location_id and p.claimed_at is null
    order by 1, 6;
end;
$$;
revoke all on function public.admin_list_location_owners(integer) from public, anon;
grant execute on function public.admin_list_location_owners(integer) to authenticated;

-- Admin: cancel an open invite.
create or replace function public.admin_cancel_owner_invite(p_location_id integer, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  delete from public.pending_location_owners
   where location_id = p_location_id and email = lower(btrim(coalesce(p_email, ''))) and claimed_at is null;
end;
$$;
revoke all on function public.admin_cancel_owner_invite(integer, text) from public, anon;
grant execute on function public.admin_cancel_owner_invite(integer, text) to authenticated;
