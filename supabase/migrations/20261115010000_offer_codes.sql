-- Partner-store discount codes (Pro perk).
--
-- A store (location) can publish an offer, e.g. "10% off the menu". A Pro
-- user "shows" the offer and receives a personal, single-use code that starts
-- with the offer's readable prefix (MRMO-7K4Q-X9ML). The same unredeemed code
-- is returned on every tap until the store redeems it; the next tap after
-- that issues a fresh one. The store's owners redeem codes (typed or scanned),
-- which stamps redeemed_at / redeemed_by so usage can be tracked per user.
--
-- Security model: codes are NEVER readable straight from the table (RLS on,
-- no policies). Issuing and redeeming go through SECURITY DEFINER RPCs that
-- check Pro status / store ownership server-side.

create table if not exists public.location_offers (
  id            uuid primary key default gen_random_uuid(),
  location_id   integer not null references public.locations(id) on delete cascade,
  code_prefix   text not null,
  kind          text not null default 'menu' check (kind in ('menu', 'meat', 'other')),
  title         text not null,
  description   text,
  discount_label text,
  requires_pro  boolean not null default true,
  is_active     boolean not null default true,
  valid_from    timestamptz,
  valid_until   timestamptz,
  code_ttl_days integer not null default 30 check (code_ttl_days between 1 and 365),
  created_at    timestamptz not null default now(),
  constraint location_offers_prefix_format check (code_prefix ~ '^[A-Z0-9]{2,12}$')
);

create unique index if not exists location_offers_prefix_key on public.location_offers (code_prefix);
create index if not exists location_offers_location_idx on public.location_offers (location_id);

create table if not exists public.offer_codes (
  id           uuid primary key default gen_random_uuid(),
  offer_id     uuid not null references public.location_offers(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  code         text not null,
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  redeemed_at  timestamptz,
  redeemed_by  uuid references auth.users(id) on delete set null
);

create unique index if not exists offer_codes_code_key on public.offer_codes (code);
-- At most one open (unredeemed) code per user per offer: tapping again reuses it.
create unique index if not exists offer_codes_one_open_per_user
  on public.offer_codes (offer_id, user_id) where redeemed_at is null;
create index if not exists offer_codes_user_idx on public.offer_codes (user_id);

alter table public.location_offers enable row level security;
alter table public.offer_codes enable row level security;

-- Offers are public marketing info (no secrets); codes have no policies at all.
drop policy if exists "offers are readable when active" on public.location_offers;
create policy "offers are readable when active" on public.location_offers
  for select to anon, authenticated using (is_active);

drop policy if exists "admins manage offers" on public.location_offers;
create policy "admins manage offers" on public.location_offers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Same Pro rule the app uses client-side (donor tier). Internal helper only.
create or replace function public.is_pro_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles up
    where up.id = p_user
      and lower(coalesce(up.donor_type, '')) in
          ('pro', 'supporter', 'founding supporter', 'developer', 'contributor')
  ) or exists (
    select 1 from public.user_subscriptions us
    where us.user_id = p_user and us.entitlement_active = true
  );
$$;
revoke all on function public.is_pro_user(uuid) from public, anon, authenticated;

-- 8 unambiguous chars (no 0/O/1/I/L), grouped 4-4 and prefixed: MRMO-7K4Q-X9MP.
create or replace function public.generate_offer_code(p_prefix text)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 chars
  raw bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  part text := '';
  i int;
begin
  for i in 0..7 loop
    part := part || substr(alphabet, (get_byte(raw, i) % 31) + 1, 1);
  end loop;
  return p_prefix || '-' || substr(part, 1, 4) || '-' || substr(part, 5, 4);
end;
$$;
revoke all on function public.generate_offer_code(text) from public, anon, authenticated;

-- Show/issue: returns the caller's open code for the offer, issuing one if needed.
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
  v_try int := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_offer from public.location_offers where id = p_offer_id and is_active;
  if not found then raise exception 'offer_not_found'; end if;
  if v_offer.valid_from is not null and now() < v_offer.valid_from then raise exception 'offer_not_started'; end if;
  if v_offer.valid_until is not null and now() > v_offer.valid_until then raise exception 'offer_ended'; end if;
  if v_offer.requires_pro and not public.is_pro_user(v_uid) then raise exception 'pro_required'; end if;

  -- Reuse the open, unexpired code.
  select * into v_code from public.offer_codes
   where offer_id = p_offer_id and user_id = v_uid and redeemed_at is null and expires_at > now();
  if found then
    return jsonb_build_object('code', v_code.code, 'issued_at', v_code.issued_at,
                              'expires_at', v_code.expires_at, 'is_new', false);
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
      -- Either a code collision (retry) or a concurrent tap that already issued one (reuse it).
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

-- Redeem: only an owner/manager of the offer's store (or an admin) may do this.
create or replace function public.redeem_offer_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code public.offer_codes;
  v_offer public.location_offers;
  v_norm text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_code from public.offer_codes where code = v_norm for update;
  if not found then raise exception 'invalid_code'; end if;

  select * into v_offer from public.location_offers where id = v_code.offer_id;

  -- Same error as an unknown code so non-owners can't probe which codes exist.
  if not (public.is_admin() or exists (
        select 1 from public.location_owners lo
         where lo.location_id = v_offer.location_id and lo.user_id = v_uid)) then
    raise exception 'invalid_code';
  end if;

  if v_code.redeemed_at is not null then
    raise exception 'already_used:%', to_char(v_code.redeemed_at at time zone 'Asia/Taipei', 'YYYY-MM-DD HH24:MI');
  end if;
  if v_code.expires_at <= now() then raise exception 'expired'; end if;
  if not v_offer.is_active then raise exception 'offer_not_active'; end if;

  update public.offer_codes set redeemed_at = now(), redeemed_by = v_uid where id = v_code.id;

  return jsonb_build_object('code', v_code.code, 'offer_title', v_offer.title,
                            'discount_label', v_offer.discount_label, 'redeemed_at', now());
end;
$$;
revoke all on function public.redeem_offer_code(text) from public, anon;
grant execute on function public.redeem_offer_code(text) to authenticated;

-- Store-side history: codes and times only. User identity stays admin-only.
create or replace function public.list_offer_redemptions(p_location_id integer, p_limit integer default 50)
returns table (code text, offer_title text, issued_at timestamptz, redeemed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not (public.is_admin() or exists (
        select 1 from public.location_owners lo
         where lo.location_id = p_location_id and lo.user_id = auth.uid())) then
    raise exception 'not_allowed';
  end if;

  return query
    select c.code, o.title, c.issued_at, c.redeemed_at
      from public.offer_codes c
      join public.location_offers o on o.id = c.offer_id
     where o.location_id = p_location_id and c.redeemed_at is not null
     order by c.redeemed_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;
revoke all on function public.list_offer_redemptions(integer, integer) from public, anon;
grant execute on function public.list_offer_redemptions(integer, integer) to authenticated;
