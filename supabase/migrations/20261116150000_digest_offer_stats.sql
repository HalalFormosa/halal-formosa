-- Weekly business digest: add discount-code stats (claimed / redeemed this week, open codes).
-- The return type changes, so the function is dropped and recreated; grants are restored to
-- service_role only (the digest edge function), as before.

drop function if exists public.get_business_weekly_digests();

create function public.get_business_weekly_digests()
returns table(
  user_id uuid, email text, display_name text, location_id integer, location_name text,
  views_7d integer, views_prev_7d integer, saves_7d integer, directions_7d integer, order_taps_7d integer,
  top_nationality text, top_search_term text,
  offer_title text, codes_claimed_7d integer, codes_redeemed_7d integer, codes_open integer
)
language sql
security definer
set search_path to 'public'
as $function$
  with owned as (
    select o.user_id, o.location_id, l.name loc_name
    from public.location_owners o
    join public.locations l on l.id = o.location_id
    join public.location_plans p on p.location_id = o.location_id
    where o.role = 'owner' and p.tier = 'gold' and p.status = 'active'
  )
  select
    ow.user_id, au.email, up.display_name, ow.location_id, ow.loc_name,
    (select count(*)::int from public.activity_log a where a.entity_type='place' and a.entity_id=ow.location_id::text and a.activity_type='explore_place_detail_view' and a.created_at >= now()-interval '7 days'),
    (select count(*)::int from public.activity_log a where a.entity_type='place' and a.entity_id=ow.location_id::text and a.activity_type='explore_place_detail_view' and a.created_at >= now()-interval '14 days' and a.created_at < now()-interval '7 days'),
    (select count(*)::int from public.saved_locations s where s.location_id=ow.location_id and s.created_at >= now()-interval '7 days'),
    (select count(*)::int from public.activity_log a where a.entity_type='place' and a.entity_id=ow.location_id::text and a.activity_type in ('explore_detail_open_maps','explore_navigate_click') and a.created_at >= now()-interval '7 days'),
    (select count(*)::int from public.activity_log a where a.entity_type='place' and a.entity_id=ow.location_id::text and a.activity_type in ('explore_detail_foodpanda','explore_detail_ubereats') and a.created_at >= now()-interval '7 days'),
    (select up2.nationality from public.activity_log a join public.user_profiles up2 on up2.id=a.user_id where a.entity_type='place' and a.entity_id=ow.location_id::text and up2.nationality is not null and a.created_at >= now()-interval '7 days' group by up2.nationality order by count(distinct a.user_id) desc limit 1),
    (select a.activity_detail->>'q' from public.activity_log a where a.entity_type='place' and a.entity_id=ow.location_id::text and a.activity_type='explore_place_impression' and coalesce(a.activity_detail->>'q','')<>'' and a.created_at >= now()-interval '7 days' group by a.activity_detail->>'q' order by count(*) desc limit 1),
    -- discount codes: null title = the store has no active offer (the email then skips the section)
    (select f.title from public.location_offers f where f.location_id = ow.location_id and f.is_active order by f.created_at limit 1),
    (select count(*)::int from public.offer_codes c join public.location_offers f on f.id = c.offer_id
       where f.location_id = ow.location_id and c.issued_at >= now()-interval '7 days'),
    (select count(*)::int from public.offer_codes c join public.location_offers f on f.id = c.offer_id
       where f.location_id = ow.location_id and c.redeemed_at is not null and c.redeemed_at >= now()-interval '7 days'),
    (select count(*)::int from public.offer_codes c join public.location_offers f on f.id = c.offer_id
       where f.location_id = ow.location_id and c.redeemed_at is null and c.expires_at > now())
  from owned ow
  join auth.users au on au.id = ow.user_id
  left join public.user_profiles up on up.id = ow.user_id;
$function$;

revoke all on function public.get_business_weekly_digests() from public, anon, authenticated;
grant execute on function public.get_business_weekly_digests() to service_role;
