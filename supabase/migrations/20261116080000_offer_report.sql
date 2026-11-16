-- Results report for discount codes.
--
-- get_offer_report: per-offer funnel for a store's owner/manager or an admin:
--   issued (claimed), redeemed, still open, expired unused, voided, how many
--   people followed each social account, and a daily series.
-- No customer identity here. admin_offer_codes is the admin-only drill-down
-- (names, times) used to follow up with customers.

create or replace function public.get_offer_report(p_location_id integer, p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(least(coalesce(p_days, 30), 365), 1);
  v_since timestamptz := now() - make_interval(days => v_days);
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not (public.is_admin() or exists (
        select 1 from public.location_owners lo
         where lo.location_id = p_location_id and lo.user_id = auth.uid())) then
    raise exception 'not_allowed';
  end if;

  select coalesce(jsonb_agg(x order by x->>'title'), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'offer_id', o.id,
      'title', o.title,
      'code_prefix', o.code_prefix,
      'is_active', o.is_active,
      'days', v_days,
      'issued',   (select count(*) from public.offer_codes c where c.offer_id = o.id and c.issued_at >= v_since),
      'people',   (select count(distinct c.user_id) from public.offer_codes c where c.offer_id = o.id and c.issued_at >= v_since),
      'redeemed', (select count(*) from public.offer_codes c where c.offer_id = o.id and c.redeemed_at >= v_since),
      'open',     (select count(*) from public.offer_codes c where c.offer_id = o.id and c.redeemed_at is null and c.expires_at > now()),
      'expired',  (select count(*) from public.offer_codes c where c.offer_id = o.id and c.redeemed_at is null and c.expires_at <= now()),
      'voided',   (select count(*) from public.offer_code_voids v where v.offer_id = o.id and v.voided_at >= v_since),
      'followed', jsonb_build_object(
        'instagram', (select count(*) from public.offer_follow_taps t where t.offer_id = o.id and t.platform = 'instagram' and t.tapped_at >= v_since),
        'tiktok',    (select count(*) from public.offer_follow_taps t where t.offer_id = o.id and t.platform = 'tiktok' and t.tapped_at >= v_since),
        'facebook',  (select count(*) from public.offer_follow_taps t where t.offer_id = o.id and t.platform = 'facebook' and t.tapped_at >= v_since)
      ),
      'last_redeemed_at', (select max(c.redeemed_at) from public.offer_codes c where c.offer_id = o.id),
      'series', (
        select coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'issued', d.i, 'redeemed', d.r) order by d.day), '[]'::jsonb)
        from (
          select g.day::date as day,
                 (select count(*) from public.offer_codes c where c.offer_id = o.id and (c.issued_at at time zone 'Asia/Taipei')::date = g.day::date) as i,
                 (select count(*) from public.offer_codes c where c.offer_id = o.id and (c.redeemed_at at time zone 'Asia/Taipei')::date = g.day::date) as r
            from generate_series(((now() at time zone 'Asia/Taipei')::date - (least(v_days, 30) - 1)),
                                 (now() at time zone 'Asia/Taipei')::date, interval '1 day') as g(day)
        ) d
      )
    ) as x
    from public.location_offers o
    where o.location_id = p_location_id
  ) s;

  return v_result;
end;
$$;
revoke all on function public.get_offer_report(integer, integer) from public, anon;
grant execute on function public.get_offer_report(integer, integer) to authenticated;

-- Admin only: who claimed / redeemed (to follow up with customers).
create or replace function public.admin_offer_codes(p_offer_id uuid, p_limit integer default 100)
returns table (
  code text, user_id uuid, display_name text,
  issued_at timestamptz, redeemed_at timestamptz, expires_at timestamptz,
  followed text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select c.code, c.user_id, up.display_name, c.issued_at, c.redeemed_at, c.expires_at,
           coalesce((select array_agg(t.platform order by t.platform)
                       from public.offer_follow_taps t
                      where t.offer_id = c.offer_id and t.user_id = c.user_id), '{}'::text[])
      from public.offer_codes c
      left join public.user_profiles up on up.id = c.user_id
     where c.offer_id = p_offer_id
     order by c.issued_at desc
     limit greatest(least(coalesce(p_limit, 100), 500), 1);
end;
$$;
revoke all on function public.admin_offer_codes(uuid, integer) from public, anon;
grant execute on function public.admin_offer_codes(uuid, integer) to authenticated;
