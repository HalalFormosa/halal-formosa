-- Offer codes: free users get a limited number of redemptions per offer
-- (default 1); Pro users can redeem the offer again and again.
--
-- Replaces the all-or-nothing `requires_pro` flag with `free_uses`:
--   free_uses = 1  -> a free user can redeem the offer once, ever
--   free_uses = 0  -> Pro only
-- Pro users are never limited. Only REDEEMED codes count towards the limit,
-- so an unused or expired code doesn't burn a free user's one use.

alter table public.location_offers
  add column if not exists free_uses integer not null default 1 check (free_uses >= 0);

-- Anything that was Pro-only keeps behaving that way.
update public.location_offers set free_uses = 0 where requires_pro;
alter table public.location_offers drop column if exists requires_pro;

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
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_offer from public.location_offers where id = p_offer_id and is_active;
  if not found then raise exception 'offer_not_found'; end if;
  if v_offer.valid_from is not null and now() < v_offer.valid_from then raise exception 'offer_not_started'; end if;
  if v_offer.valid_until is not null and now() > v_offer.valid_until then raise exception 'offer_ended'; end if;

  -- An open, unexpired code is always shown again, whatever the user's plan.
  select * into v_code from public.offer_codes
   where offer_id = p_offer_id and user_id = v_uid and redeemed_at is null and expires_at > now();
  if found then
    return jsonb_build_object('code', v_code.code, 'issued_at', v_code.issued_at,
                              'expires_at', v_code.expires_at, 'is_new', false);
  end if;

  -- Free users: limited number of redemptions per offer; Pro: unlimited.
  if not public.is_pro_user(v_uid) then
    select count(*) into v_used from public.offer_codes
     where offer_id = p_offer_id and user_id = v_uid and redeemed_at is not null;
    if v_offer.free_uses <= 0 then raise exception 'pro_required'; end if;
    if v_used >= v_offer.free_uses then raise exception 'free_limit_reached'; end if;
  end if;

  -- An expired, unredeemed code would block the one-open-per-user index: retire it.
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

-- What the offer card needs to know before the user taps: can they get a code,
-- or have they used their free redemption(s)?
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
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_offer from public.location_offers where id = p_offer_id and is_active;
  if not found then raise exception 'offer_not_found'; end if;

  v_pro := public.is_pro_user(v_uid);
  select count(*) into v_used from public.offer_codes
   where offer_id = p_offer_id and user_id = v_uid and redeemed_at is not null;
  select * into v_open from public.offer_codes
   where offer_id = p_offer_id and user_id = v_uid and redeemed_at is null and expires_at > now();

  return jsonb_build_object(
    'is_pro', v_pro,
    'free_uses', v_offer.free_uses,
    'redeemed_count', v_used,
    'has_open_code', v_open.id is not null,
    'can_get_code', v_pro or v_open.id is not null or v_used < v_offer.free_uses
  );
end;
$$;
revoke all on function public.get_my_offer_status(uuid) from public, anon;
grant execute on function public.get_my_offer_status(uuid) to authenticated;
