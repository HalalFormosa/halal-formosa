-- Weekly digest data for Gold-tier claimed businesses. SECURITY DEFINER and
-- restricted to service_role (the weekly-business-digest edge function) since it
-- exposes owner emails.
create or replace function public.get_business_weekly_digests()
returns table (
  user_id uuid, email text, display_name text,
  location_id int, location_name text,
  views_7d int, views_prev_7d int,
  saves_7d int, directions_7d int, order_taps_7d int,
  top_nationality text, top_search_term text
) language sql security definer set search_path = public as $$
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
    (select a.activity_detail->>'q' from public.activity_log a where a.entity_type='place' and a.entity_id=ow.location_id::text and a.activity_type='explore_place_impression' and coalesce(a.activity_detail->>'q','')<>'' and a.created_at >= now()-interval '7 days' group by a.activity_detail->>'q' order by count(*) desc limit 1)
  from owned ow
  join auth.users au on au.id = ow.user_id
  left join public.user_profiles up on up.id = ow.user_id;
$$;

revoke execute on function public.get_business_weekly_digests() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Weekly cron (pg_cron + pg_net) that POSTs to the weekly-business-digest edge
-- function every Monday 01:00 UTC. The x-cron-secret must match the edge
-- function's CRON_SECRET env secret. Re-run with your own secret if rotating.
-- ---------------------------------------------------------------------------
-- do $$
-- declare v_secret text := encode(gen_random_bytes(16),'hex');  -- or a fixed value
-- begin
--   if exists (select 1 from cron.job where jobname='weekly-business-digest') then
--     perform cron.unschedule('weekly-business-digest');
--   end if;
--   perform cron.schedule('weekly-business-digest', '0 1 * * 1',
--     format('select net.http_post(url:=%L, headers:=jsonb_build_object(%L,%L,%L,%L), body:=%L::jsonb)',
--       'https://<PROJECT_REF>.functions.supabase.co/weekly-business-digest',
--       'Content-Type','application/json', 'x-cron-secret', v_secret, '{}'));
--   raise notice 'Set the edge function CRON_SECRET to: %', v_secret;
-- end $$;
