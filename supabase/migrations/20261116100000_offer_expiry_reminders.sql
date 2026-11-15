-- Expiry reminders for discount codes.
--
-- A push goes out once per code, 3 days before it expires, if it has not been
-- used. The edge function `send-offer-code-reminders` (called daily by pg_cron)
-- reads get_pending_offer_reminders() with the service role and calls
-- mark_offer_code_reminded() after each successful push. Not reachable by
-- app users (service role only).

alter table public.offer_codes add column if not exists reminded_at timestamptz;

create or replace function public.get_pending_offer_reminders(p_days integer default 3)
returns table (
  code_id uuid, user_id uuid, code text, offer_title text,
  location_id integer, location_name text, expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.user_id, c.code, o.title, o.location_id, l.name, c.expires_at
    from public.offer_codes c
    join public.location_offers o on o.id = c.offer_id
    join public.locations l on l.id = o.location_id
   where c.redeemed_at is null
     and c.reminded_at is null
     and c.expires_at > now()
     and c.expires_at <= now() + make_interval(days => greatest(coalesce(p_days, 3), 1))
     and o.is_active
     and (o.valid_until is null or o.valid_until > now())
   order by c.expires_at;
$$;
revoke all on function public.get_pending_offer_reminders(integer) from public, anon, authenticated;

create or replace function public.mark_offer_code_reminded(p_code_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.offer_codes set reminded_at = now() where id = p_code_id;
$$;
revoke all on function public.mark_offer_code_reminded(uuid) from public, anon, authenticated;
