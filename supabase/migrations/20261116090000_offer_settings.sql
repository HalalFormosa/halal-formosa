-- Offer settings an admin can set from the app: start/end dates, how long a
-- code stays valid, and a maximum number of codes (stock).
--
-- max_codes counts every code ever issued for the offer (claimed, redeemed or
-- expired-unused that has not been retired), and is enforced on the server when
-- a NEW code is issued. The free-once / Pro-unlimited rule stays fixed.

alter table public.location_offers add column if not exists max_codes integer;
alter table public.location_offers drop constraint if exists location_offers_max_codes_positive;
alter table public.location_offers add constraint location_offers_max_codes_positive
  check (max_codes is null or max_codes >= 1);

-- 1) Issue: sold-out check before the follow step and before generating a code.
create or replace function public.get_my_offer_code(p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.location_offers;
  v_code public.offer_codes;
  v_used integer;
  v_try int := 0;
  v_platform text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_offer from public.location_offers where id = p_offer_id and is_active;
  if not found then raise exception 'offer_not_found'; end if;
  if v_offer.valid_from is not null and now() < v_offer.valid_from then raise exception 'offer_not_started'; end if;
  if v_offer.valid_until is not null and now() > v_offer.valid_until then raise exception 'offer_ended'; end if;

  select * into v_code from public.offer_codes
   where offer_id = p_offer_id and user_id = v_uid and redeemed_at is null and expires_at > now();
  if found then
    return jsonb_build_object('code', v_code.code, 'issued_at', v_code.issued_at,
                              'expires_at', v_code.expires_at, 'is_new', false);
  end if;

  if not public.is_pro_user(v_uid) then
    select count(*) into v_used from public.offer_codes
     where offer_id = p_offer_id and user_id = v_uid and redeemed_at is not null;
    if v_offer.free_uses <= 0 then raise exception 'pro_required'; end if;
    if v_used >= v_offer.free_uses then raise exception 'free_limit_reached'; end if;
  end if;

  if v_offer.max_codes is not null
     and (select count(*) from public.offer_codes where offer_id = p_offer_id) >= v_offer.max_codes then
    raise exception 'offer_sold_out';
  end if;

  foreach v_platform in array array['instagram', 'tiktok', 'facebook'] loop
    if public.offer_follow_account(p_offer_id, v_platform) is not null and not exists (
         select 1 from public.offer_follow_taps t
          where t.offer_id = p_offer_id and t.user_id = v_uid and t.platform = v_platform) then
      raise exception 'follow_required';
    end if;
  end loop;

  delete from public.offer_codes
   where offer_id = p_offer_id and user_id = v_uid and redeemed_at is null and expires_at <= now();

  loop
    v_try := v_try + 1;
    begin
      insert into public.offer_codes (offer_id, user_id, code, expires_at)
      values (p_offer_id, v_uid, public.generate_offer_code(v_offer.code_prefix),
              now() + make_interval(days => v_offer.code_ttl_days))
      returning * into v_code;
      exit;
    exception when unique_violation then
      select * into v_code from public.offer_codes
       where offer_id = p_offer_id and user_id = v_uid and redeemed_at is null;
      if found then
        return jsonb_build_object('code', v_code.code, 'issued_at', v_code.issued_at,
                                  'expires_at', v_code.expires_at, 'is_new', false);
      end if;
      if v_try >= 5 then raise exception 'code_generation_failed'; end if;
    end;
  end loop;

  return jsonb_build_object('code', v_code.code, 'issued_at', v_code.issued_at,
                            'expires_at', v_code.expires_at, 'is_new', true);
end;
$$;
revoke all on function public.get_my_offer_code(uuid) from public, anon;
grant execute on function public.get_my_offer_code(uuid) to authenticated;

-- 2) Status: adds sold_out so the card can say so instead of asking to follow.
create or replace function public.get_my_offer_status(p_offer_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.location_offers;
  v_pro boolean;
  v_used integer;
  v_open public.offer_codes;
  v_follow jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_offer from public.location_offers where id = p_offer_id and is_active;
  if not found then raise exception 'offer_not_found'; end if;

  v_pro := public.is_pro_user(v_uid);
  select count(*) into v_used from public.offer_codes
   where offer_id = p_offer_id and user_id = v_uid and redeemed_at is not null;
  select * into v_open from public.offer_codes
   where offer_id = p_offer_id and user_id = v_uid and redeemed_at is null and expires_at > now();

  select coalesce(jsonb_agg(jsonb_build_object(
           'platform', x.p, 'account', x.a,
           'done', exists (select 1 from public.offer_follow_taps t
                            where t.offer_id = p_offer_id and t.user_id = v_uid and t.platform = x.p)
         ) order by x.ord), '[]'::jsonb)
    into v_follow
    from (select p, public.offer_follow_account(p_offer_id, p) as a, ord
            from unnest(array['instagram', 'tiktok', 'facebook']) with ordinality as u(p, ord)) x
   where x.a is not null;

  return jsonb_build_object(
    'is_pro', v_pro,
    'free_uses', v_offer.free_uses,
    'redeemed_count', v_used,
    'has_open_code', v_open.id is not null,
    'can_get_code', v_pro or v_open.id is not null or v_used < v_offer.free_uses,
    'follow', v_follow,
    'sold_out', (v_open.id is null and v_offer.max_codes is not null
                 and (select count(*) from public.offer_codes where offer_id = p_offer_id) >= v_offer.max_codes)
  );
end;
$$;
revoke all on function public.get_my_offer_status(uuid) from public, anon;
grant execute on function public.get_my_offer_status(uuid) to authenticated;

-- 3) Owners/admins see the settings too (read-only for owners).
drop function if exists public.list_my_offers(integer);
create or replace function public.list_my_offers(p_location_id integer)
returns table (
  id uuid, location_id integer, kind text, title text, description text, discount_label text,
  free_uses integer, is_active boolean, code_prefix text, issued_count bigint, redeemed_count bigint,
  valid_from timestamptz, valid_until timestamptz, code_ttl_days integer, max_codes integer,
  require_follow boolean, follow_instagram text, follow_tiktok text, follow_facebook text
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not (public.is_admin() or exists (
        select 1 from public.location_owners lo2
         where lo2.location_id = p_location_id and lo2.user_id = auth.uid())) then
    raise exception 'not_allowed';
  end if;

  return query
    select o.id, o.location_id, o.kind, o.title, o.description, o.discount_label,
           o.free_uses, o.is_active, o.code_prefix,
           (select count(*) from public.offer_codes c where c.offer_id = o.id),
           (select count(*) from public.offer_codes c where c.offer_id = o.id and c.redeemed_at is not null),
           o.valid_from, o.valid_until, o.code_ttl_days, o.max_codes,
           o.require_follow, o.follow_instagram, o.follow_tiktok, o.follow_facebook
      from public.location_offers o
     where o.location_id = p_location_id
     order by o.created_at;
end;
$$;
revoke all on function public.list_my_offers(integer) from public, anon;
grant execute on function public.list_my_offers(integer) to authenticated;

-- 4) Admin: create with the extra settings (replaces the 12-argument version).
drop function if exists public.admin_create_offer(integer, text, text, text, text, text, integer, boolean, boolean, text, text, text);
create or replace function public.admin_create_offer(
  p_location_id      integer,
  p_code_prefix      text,
  p_kind             text,
  p_title            text,
  p_description      text,
  p_discount_label   text,
  p_free_uses        integer,
  p_is_active        boolean,
  p_require_follow   boolean,
  p_follow_instagram text,
  p_follow_tiktok    text,
  p_follow_facebook  text,
  p_valid_from       timestamptz default null,
  p_valid_until      timestamptz default null,
  p_code_ttl_days    integer default 30,
  p_max_codes        integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := upper(btrim(coalesce(p_code_prefix, '')));
  v_title  text := btrim(coalesce(p_title, ''));
  v_desc   text := nullif(btrim(coalesce(p_description, '')), '');
  v_label  text := nullif(btrim(coalesce(p_discount_label, '')), '');
  v_ig     text := nullif(ltrim(btrim(coalesce(p_follow_instagram, '')), '@'), '');
  v_tt     text := nullif(ltrim(btrim(coalesce(p_follow_tiktok, '')), '@'), '');
  v_fb     text := nullif(btrim(coalesce(p_follow_facebook, '')), '');
  v_row    public.location_offers;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin() then raise exception 'not_allowed'; end if;

  if not exists (select 1 from public.locations where id = p_location_id) then raise exception 'location_not_found'; end if;
  if v_prefix !~ '^[A-Z0-9]{2,12}$' then raise exception 'invalid_prefix'; end if;
  if exists (select 1 from public.location_offers where code_prefix = v_prefix) then raise exception 'prefix_taken'; end if;
  if coalesce(p_kind, '') not in ('menu', 'meat', 'other') then raise exception 'invalid_kind'; end if;
  if char_length(v_title) < 1 or char_length(v_title) > 80 then raise exception 'invalid_title'; end if;
  if v_desc is not null and char_length(v_desc) > 300 then raise exception 'invalid_description'; end if;
  if v_label is not null and char_length(v_label) > 24 then raise exception 'invalid_label'; end if;
  if coalesce(p_free_uses, -1) < 0 or p_free_uses > 100 then raise exception 'invalid_free_uses'; end if;
  if coalesce(p_code_ttl_days, 30) < 1 or coalesce(p_code_ttl_days, 30) > 365 then raise exception 'invalid_ttl'; end if;
  if p_max_codes is not null and p_max_codes < 1 then raise exception 'invalid_max_codes'; end if;
  if p_valid_from is not null and p_valid_until is not null and p_valid_until <= p_valid_from then raise exception 'invalid_dates'; end if;

  begin
    insert into public.location_offers
      (location_id, code_prefix, kind, title, description, discount_label, free_uses, is_active,
       require_follow, follow_instagram, follow_tiktok, follow_facebook,
       valid_from, valid_until, code_ttl_days, max_codes)
    values
      (p_location_id, v_prefix, p_kind, v_title, v_desc, v_label, p_free_uses, coalesce(p_is_active, true),
       coalesce(p_require_follow, true), v_ig, v_tt, v_fb,
       p_valid_from, p_valid_until, coalesce(p_code_ttl_days, 30), p_max_codes)
    returning * into v_row;
  exception when check_violation then
    raise exception 'invalid_follow';
  end;

  return jsonb_build_object('id', v_row.id, 'code_prefix', v_row.code_prefix, 'title', v_row.title,
                            'is_active', v_row.is_active);
end;
$$;
revoke all on function public.admin_create_offer(integer, text, text, text, text, text, integer, boolean, boolean, text, text, text, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.admin_create_offer(integer, text, text, text, text, text, integer, boolean, boolean, text, text, text, timestamptz, timestamptz, integer, integer) to authenticated;

-- 5) Admin: change the settings of an existing offer.
create or replace function public.admin_update_offer_settings(
  p_offer_id         uuid,
  p_valid_from       timestamptz,
  p_valid_until      timestamptz,
  p_code_ttl_days    integer,
  p_max_codes        integer,
  p_require_follow   boolean,
  p_follow_instagram text,
  p_follow_tiktok    text,
  p_follow_facebook  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ig text := nullif(ltrim(btrim(coalesce(p_follow_instagram, '')), '@'), '');
  v_tt text := nullif(ltrim(btrim(coalesce(p_follow_tiktok, '')), '@'), '');
  v_fb text := nullif(btrim(coalesce(p_follow_facebook, '')), '');
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.location_offers where id = p_offer_id) then raise exception 'offer_not_found'; end if;
  if coalesce(p_code_ttl_days, 30) < 1 or coalesce(p_code_ttl_days, 30) > 365 then raise exception 'invalid_ttl'; end if;
  if p_max_codes is not null and p_max_codes < 1 then raise exception 'invalid_max_codes'; end if;
  if p_valid_from is not null and p_valid_until is not null and p_valid_until <= p_valid_from then raise exception 'invalid_dates'; end if;

  begin
    update public.location_offers
       set valid_from = p_valid_from, valid_until = p_valid_until,
           code_ttl_days = coalesce(p_code_ttl_days, 30), max_codes = p_max_codes,
           require_follow = coalesce(p_require_follow, true),
           follow_instagram = v_ig, follow_tiktok = v_tt, follow_facebook = v_fb
     where id = p_offer_id;
  exception when check_violation then
    raise exception 'invalid_follow';
  end;
end;
$$;
revoke all on function public.admin_update_offer_settings(uuid, timestamptz, timestamptz, integer, integer, boolean, text, text, text) from public, anon;
grant execute on function public.admin_update_offer_settings(uuid, timestamptz, timestamptz, integer, integer, boolean, text, text, text) to authenticated;
