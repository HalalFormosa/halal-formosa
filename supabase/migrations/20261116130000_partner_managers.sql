-- Partner page managers: a partner (e.g. Mr. Mo BBQ) can edit the public text of
-- its own partner page. Managers may change ONLY about, address, phone, email and
-- website. Name, logo, tier, type, verified and scopes stay admin-only (the
-- partners table still has no write policy; the function below is the only path).

create table if not exists public.partner_managers (
  partner_id uuid not null references public.partners(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (partner_id, user_id)
);
alter table public.partner_managers enable row level security;
drop policy if exists "managers see own rows, admins see all" on public.partner_managers;
create policy "managers see own rows, admins see all" on public.partner_managers
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admins manage partner managers" on public.partner_managers;
create policy "admins manage partner managers" on public.partner_managers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.can_manage_partner(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.partner_managers m
     where m.partner_id = p_partner_id and m.user_id = auth.uid());
$$;
revoke all on function public.can_manage_partner(uuid) from public, anon;
grant execute on function public.can_manage_partner(uuid) to authenticated;

create or replace function public.update_my_partner(
  p_partner_id uuid,
  p_about      text,
  p_address    text,
  p_phone      text,
  p_email      text,
  p_website    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_about   text := nullif(btrim(coalesce(p_about, '')), '');
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
  v_phone   text := nullif(btrim(coalesce(p_phone, '')), '');
  v_email   text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_website text := nullif(btrim(coalesce(p_website, '')), '');
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.can_manage_partner(p_partner_id) then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.partners where id = p_partner_id) then raise exception 'partner_not_found'; end if;

  if v_about is not null and char_length(v_about) > 2000 then raise exception 'invalid_about'; end if;
  if v_address is not null and char_length(v_address) > 250 then raise exception 'invalid_address'; end if;
  if v_phone is not null and char_length(v_phone) > 40 then raise exception 'invalid_phone'; end if;
  if v_email is not null and (char_length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'invalid_email'; end if;
  if v_website is not null and (char_length(v_website) > 250 or v_website !~* '^https?://[^\s]+$') then raise exception 'invalid_website'; end if;

  update public.partners
     set about = v_about, address = v_address, phone = v_phone, email = v_email, website = v_website
   where id = p_partner_id;
end;
$$;
revoke all on function public.update_my_partner(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.update_my_partner(uuid, text, text, text, text, text) to authenticated;
