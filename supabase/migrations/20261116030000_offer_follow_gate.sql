-- "Follow us first" gate for offer codes.
--
-- Before a user is issued a NEW code they must have tapped through to each
-- social account the store actually has: Instagram, TikTok and/or Facebook.
-- The accounts come from the store's own listing (locations.instagram / tiktok /
-- facebook), optionally overridden per offer (follow_instagram / follow_tiktok /
-- follow_facebook, e.g. the butcher shop pointing at Mr. Mo BBQ's account).
-- If an account does not exist (or is not a valid handle/URL) there is nothing
-- to follow, so no step is shown or required for it. `require_follow = false`
-- turns the gate off for an offer.
--
-- Instagram/TikTok/Facebook do not allow third-party apps to verify a follow,
-- so this is an honour-system step enforced server-side (the code function
-- refuses to issue until the taps are recorded); stores can still ask to see
-- the follow at the counter.

alter table public.location_offers add column if not exists require_follow boolean not null default true;
alter table public.location_offers add column if not exists follow_instagram text;
alter table public.location_offers add column if not exists follow_tiktok text;
alter table public.location_offers add column if not exists follow_facebook text;

alter table public.location_offers drop constraint if exists location_offers_follow_format;
alter table public.location_offers add constraint location_offers_follow_format check (
  (follow_instagram is null or follow_instagram ~ '^[A-Za-z0-9._]{1,30}$')
  and (follow_tiktok is null or follow_tiktok ~ '^[A-Za-z0-9._]{1,24}$')
  and (follow_facebook is null or follow_facebook ~* '^https://(www\.|m\.)?facebook\.com/[^[:space:]]+$')
);

-- Who tapped through to which account (no policies at all: only the
-- SECURITY DEFINER functions below touch it).
create table if not exists public.offer_follow_taps (
  offer_id  uuid not null references public.location_offers(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  platform  text not null check (platform in ('instagram', 'tiktok', 'facebook')),
  tapped_at timestamptz not null default now(),
  primary key (offer_id, user_id, platform)
);
alter table public.offer_follow_taps enable row level security;

-- The account a user must follow for this offer on this platform, or null if
-- there is nothing (valid) to follow. Offer override first, then the store's own.
create or replace function public.offer_follow_account(p_offer_id uuid, p_platform text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare o public.location_offers; l public.locations; v text;
begin
  select * into o from public.location_offers where id = p_offer_id;
  if not found or not o.require_follow then return null; end if;
  select * into l from public.locations where id = o.location_id;

  if p_platform = 'instagram' then
    v := ltrim(btrim(coalesce(o.follow_instagram, l.instagram, '')), '@');
    return case when v ~ '^[A-Za-z0-9._]{1,30}$' then v end;
  elsif p_platform = 'tiktok' then
    v := ltrim(btrim(coalesce(o.follow_tiktok, l.tiktok, '')), '@');
    return case when v ~ '^[A-Za-z0-9._]{1,24}$' then v end;
  elsif p_platform = 'facebook' then
    v := btrim(coalesce(o.follow_facebook, l.facebook, ''));
    return case when v ~* '^https://(www\.|m\.)?facebook\.com/[^[:space:]]+$' then v end;
  end if;
  return null;
end;
$$;
revoke all on function public.offer_follow_account(uuid, text) from public, anon, authenticated;

create or replace function public.record_offer_follow(p_offer_id uuid, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.location_offers where id = p_offer_id and is_active) then
    raise exception 'offer_not_found';
  end if;
  if p_platform not in ('instagram', 'tiktok', 'facebook')
     or public.offer_follow_account(p_offer_id, p_platform) is null then
    raise exception 'invalid_platform';
  end if;

  insert into public.offer_follow_taps (offer_id, user_id, platform)
  values (p_offer_id, v_uid, p_platform)
  on conflict do nothing;
end;
$$;
revoke all on function public.record_offer_follow(uuid, text) from public, anon;
grant execute on function public.record_offer_follow(uuid, text) to authenticated;

-- Issue: a NEW code also requires the follow taps for every account that exists.
-- An already-open code is still shown again without re-checking.
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

-- Status for the card, now with the follow steps that apply (account + done?).
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
    'follow', v_follow
  );
end;
$$;
revoke all on function public.get_my_offer_status(uuid) from public, anon;
grant execute on function public.get_my_offer_status(uuid) to authenticated;
