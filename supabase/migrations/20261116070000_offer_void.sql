-- Undo a mistaken redemption.
--
-- A store's owner/manager can void a redemption for 10 minutes after it
-- happened; admins any time. The code goes back to "unused" (same code, same
-- expiry) and the void is logged. If the customer has meanwhile been issued a
-- different open code for the same offer, the void is refused (one open code
-- per user per offer).

create table if not exists public.offer_code_voids (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  offer_id    uuid not null references public.location_offers(id) on delete cascade,
  voided_by   uuid references auth.users(id) on delete set null,
  voided_at   timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid
);
alter table public.offer_code_voids enable row level security;
drop policy if exists "admins read offer voids" on public.offer_code_voids;
create policy "admins read offer voids" on public.offer_code_voids
  for select to authenticated using (public.is_admin());

-- Same list as before plus `can_void` (inside the window, or admin).
drop function if exists public.list_offer_redemptions(integer, integer);
create or replace function public.list_offer_redemptions(p_location_id integer, p_limit integer default 50)
returns table (code text, offer_title text, issued_at timestamptz, redeemed_at timestamptz, can_void boolean)
language plpgsql
security definer
set search_path = public
as $$
declare v_admin boolean := public.is_admin();
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not (v_admin or exists (
        select 1 from public.location_owners lo
         where lo.location_id = p_location_id and lo.user_id = auth.uid())) then
    raise exception 'not_allowed';
  end if;

  return query
    select c.code, o.title, c.issued_at, c.redeemed_at,
           (v_admin or c.redeemed_at > now() - interval '10 minutes')
      from public.offer_codes c
      join public.location_offers o on o.id = c.offer_id
     where o.location_id = p_location_id and c.redeemed_at is not null
     order by c.redeemed_at desc
     limit greatest(least(coalesce(p_limit, 50), 200), 1);
end;
$$;
revoke all on function public.list_offer_redemptions(integer, integer) from public, anon;
grant execute on function public.list_offer_redemptions(integer, integer) to authenticated;

create or replace function public.void_offer_redemption(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_norm text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_code public.offer_codes;
  v_offer public.location_offers;
  v_admin boolean := public.is_admin();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_code from public.offer_codes where code = v_norm for update;
  if not found then raise exception 'invalid_code'; end if;
  select * into v_offer from public.location_offers where id = v_code.offer_id;

  -- Same error as an unknown code so outsiders cannot probe which codes exist.
  if not (v_admin or exists (
        select 1 from public.location_owners lo
         where lo.location_id = v_offer.location_id and lo.user_id = v_uid)) then
    raise exception 'invalid_code';
  end if;

  if v_code.redeemed_at is null then raise exception 'not_redeemed'; end if;
  if not v_admin and v_code.redeemed_at <= now() - interval '10 minutes' then
    raise exception 'void_window_passed';
  end if;
  if exists (select 1 from public.offer_codes c
              where c.offer_id = v_code.offer_id and c.user_id = v_code.user_id
                and c.redeemed_at is null and c.id <> v_code.id) then
    raise exception 'customer_has_open_code';
  end if;

  insert into public.offer_code_voids (code, offer_id, voided_by, redeemed_at, redeemed_by)
  values (v_code.code, v_code.offer_id, v_uid, v_code.redeemed_at, v_code.redeemed_by);

  update public.offer_codes set redeemed_at = null, redeemed_by = null where id = v_code.id;

  return jsonb_build_object('code', v_code.code, 'offer_title', v_offer.title);
end;
$$;
revoke all on function public.void_offer_redemption(text) from public, anon;
grant execute on function public.void_offer_redemption(text) to authenticated;
