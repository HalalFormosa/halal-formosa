-- Give Silver the 'advanced' analytics level (audience demographics + peaks).
update public.app_config
set value = (
  value::jsonb || jsonb_build_object('silver', (value::jsonb->'silver') || '{"analytics":"advanced"}'::jsonb)
)::text
where key = 'business_plan_features';

-- Aggregated analytics for a location, gated server-side by the location's plan
-- analytics level (basic / standard / advanced). Only the owner/manager or an
-- admin may call it. Reads across all users' activity (SECURITY DEFINER) but
-- returns only aggregates.
create or replace function public.get_business_analytics(p_location_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tier text; v_level text; v_features jsonb;
  v_since timestamptz := now() - interval '30 days';
  v_eid text := p_location_id::text;
  v_result jsonb; v_intents jsonb; v_nat jsonb; v_gender jsonb; v_dow jsonb; v_hod jsonb; v_ts jsonb;
begin
  if not (public.is_location_manager(p_location_id) or public.is_admin()) then
    raise exception 'Not authorized for this location';
  end if;

  select coalesce(tier,'free') into v_tier from public.location_plans where location_id = p_location_id;
  v_tier := coalesce(v_tier,'free');
  select (value::jsonb) -> v_tier into v_features from public.app_config where key='business_plan_features';
  v_level := coalesce(v_features->>'analytics','basic');

  -- BASIC (all tiers)
  v_result := jsonb_build_object(
    'level', v_level,
    'total_views',       (select coalesce(view_count,0) from public.locations where id=p_location_id),
    'detail_opens_30d',  (select count(*) from public.activity_log where entity_type='place' and entity_id=v_eid and activity_type='explore_place_detail_view' and created_at>=v_since),
    'unique_viewers_30d',(select count(distinct user_id) from public.activity_log where entity_type='place' and entity_id=v_eid and activity_type='explore_place_detail_view' and created_at>=v_since and user_id is not null),
    'card_clicks_30d',   (select count(*) from public.activity_log where entity_type='place' and entity_id=v_eid and activity_type='explore_place_card_click' and created_at>=v_since),
    'marker_clicks_30d', (select count(*) from public.activity_log where entity_type='place' and entity_id=v_eid and activity_type='explore_marker_click' and created_at>=v_since)
  );

  -- STANDARD+ : saves + intent actions (30d)
  if v_level in ('standard','advanced') then
    select jsonb_build_object(
      'directions', count(*) filter (where activity_type in ('explore_detail_open_maps','explore_navigate_click')),
      'call',       count(*) filter (where activity_type='explore_detail_call'),
      'instagram',  count(*) filter (where activity_type='explore_detail_instagram'),
      'foodpanda',  count(*) filter (where activity_type='explore_detail_foodpanda'),
      'ubereats',   count(*) filter (where activity_type='explore_detail_ubereats'),
      'share',      count(*) filter (where activity_type in ('explore_share_place','explore_detail_share')),
      'photo_views',count(*) filter (where activity_type='explore_detail_open_image')
    ) into v_intents
    from public.activity_log where entity_type='place' and entity_id=v_eid and created_at>=v_since;

    v_result := v_result || jsonb_build_object(
      'saves', (select count(*) from public.saved_locations where location_id=p_location_id),
      'intents', v_intents
    );
  end if;

  -- ADVANCED : audience demographics + peak times + timeseries
  if v_level = 'advanced' then
    select coalesce(jsonb_agg(jsonb_build_object('code', nationality, 'count', c) order by c desc), '[]'::jsonb) into v_nat
    from (
      select up.nationality, count(distinct al.user_id) c
      from public.activity_log al join public.user_profiles up on up.id=al.user_id
      where al.entity_type='place' and al.entity_id=v_eid and up.nationality is not null
      group by up.nationality
    ) s;

    select coalesce(jsonb_agg(jsonb_build_object('gender', gender, 'count', c) order by c desc), '[]'::jsonb) into v_gender
    from (
      select up.gender, count(distinct al.user_id) c
      from public.activity_log al join public.user_profiles up on up.id=al.user_id
      where al.entity_type='place' and al.entity_id=v_eid and up.gender is not null
      group by up.gender
    ) s;

    select coalesce(jsonb_object_agg(dow, c), '{}'::jsonb) into v_dow from (
      select extract(dow from created_at at time zone 'Asia/Taipei')::int dow, count(*) c
      from public.activity_log where entity_type='place' and entity_id=v_eid and created_at>=v_since group by 1
    ) s;

    select coalesce(jsonb_object_agg(hod, c), '{}'::jsonb) into v_hod from (
      select extract(hour from created_at at time zone 'Asia/Taipei')::int hod, count(*) c
      from public.activity_log where entity_type='place' and entity_id=v_eid and created_at>=v_since group by 1
    ) s;

    select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', c) order by d), '[]'::jsonb) into v_ts from (
      select (created_at at time zone 'Asia/Taipei')::date d, count(*) c
      from public.activity_log where entity_type='place' and entity_id=v_eid and activity_type='explore_place_detail_view' and created_at>=v_since group by 1
    ) s;

    v_result := v_result || jsonb_build_object(
      'nationalities', v_nat, 'gender', v_gender,
      'peak_dow', v_dow, 'peak_hour', v_hod, 'timeseries', v_ts
    );
  end if;

  return v_result;
end;
$$;

grant execute on function public.get_business_analytics(integer) to authenticated;
