-- Gold gets a distinct 'pro' analytics level (funnel + benchmarking + search terms).
-- Silver stays 'advanced' (audience + peaks). Requires impression logging
-- (activity_type 'explore_place_impression', with activity_detail->>'q' = search query).
update public.app_config
set value = (
  value::jsonb || jsonb_build_object('gold', (value::jsonb->'gold') || '{"analytics":"pro"}'::jsonb)
)::text
where key = 'business_plan_features';

create or replace function public.get_business_analytics(p_location_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tier text; v_level text; v_features jsonb;
  v_since timestamptz := now() - interval '30 days';
  v_eid text := p_location_id::text;
  v_type int;
  v_result jsonb; v_intents jsonb; v_nat jsonb; v_gender jsonb; v_dow jsonb; v_hod jsonb; v_ts jsonb;
  v_impr int; v_opens int; v_actions int; v_terms jsonb;
  v_my_opens int; v_cat_total int; v_cat_avg numeric; v_beat int;
begin
  if not (public.is_location_manager(p_location_id) or public.is_admin()) then
    raise exception 'Not authorized for this location';
  end if;

  select coalesce(tier,'free') into v_tier from public.location_plans where location_id = p_location_id;
  v_tier := coalesce(v_tier,'free');
  select (value::jsonb) -> v_tier into v_features from public.app_config where key='business_plan_features';
  v_level := coalesce(v_features->>'analytics','basic');

  -- BASIC (all)
  v_result := jsonb_build_object(
    'level', v_level,
    'total_views',       (select coalesce(view_count,0) from public.locations where id=p_location_id),
    'detail_opens_30d',  (select count(*) from public.activity_log where entity_type='place' and entity_id=v_eid and activity_type='explore_place_detail_view' and created_at>=v_since),
    'unique_viewers_30d',(select count(distinct user_id) from public.activity_log where entity_type='place' and entity_id=v_eid and activity_type='explore_place_detail_view' and created_at>=v_since and user_id is not null),
    'card_clicks_30d',   (select count(*) from public.activity_log where entity_type='place' and entity_id=v_eid and activity_type='explore_place_card_click' and created_at>=v_since),
    'marker_clicks_30d', (select count(*) from public.activity_log where entity_type='place' and entity_id=v_eid and activity_type='explore_marker_click' and created_at>=v_since)
  );

  -- STANDARD+
  if v_level in ('standard','advanced','pro') then
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

  -- ADVANCED+ : audience + peaks + trend
  if v_level in ('advanced','pro') then
    select coalesce(jsonb_agg(jsonb_build_object('code', nationality, 'count', c) order by c desc), '[]'::jsonb) into v_nat
    from (select up.nationality, count(distinct al.user_id) c
          from public.activity_log al join public.user_profiles up on up.id=al.user_id
          where al.entity_type='place' and al.entity_id=v_eid and up.nationality is not null group by up.nationality) s;
    select coalesce(jsonb_agg(jsonb_build_object('gender', gender, 'count', c) order by c desc), '[]'::jsonb) into v_gender
    from (select up.gender, count(distinct al.user_id) c
          from public.activity_log al join public.user_profiles up on up.id=al.user_id
          where al.entity_type='place' and al.entity_id=v_eid and up.gender is not null group by up.gender) s;
    select coalesce(jsonb_object_agg(dow, c), '{}'::jsonb) into v_dow from (
      select extract(dow from created_at at time zone 'Asia/Taipei')::int dow, count(*) c
      from public.activity_log where entity_type='place' and entity_id=v_eid and created_at>=v_since group by 1) s;
    select coalesce(jsonb_object_agg(hod, c), '{}'::jsonb) into v_hod from (
      select extract(hour from created_at at time zone 'Asia/Taipei')::int hod, count(*) c
      from public.activity_log where entity_type='place' and entity_id=v_eid and created_at>=v_since group by 1) s;
    select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', c) order by d), '[]'::jsonb) into v_ts from (
      select (created_at at time zone 'Asia/Taipei')::date d, count(*) c
      from public.activity_log where entity_type='place' and entity_id=v_eid and activity_type='explore_place_detail_view' and created_at>=v_since group by 1) s;
    v_result := v_result || jsonb_build_object('nationalities', v_nat, 'gender', v_gender, 'peak_dow', v_dow, 'peak_hour', v_hod, 'timeseries', v_ts);
  end if;

  -- PRO (Gold) : funnel + benchmarking + search terms
  if v_level = 'pro' then
    v_impr := (select count(*) from public.activity_log where entity_type='place' and entity_id=v_eid and activity_type='explore_place_impression' and created_at>=v_since);
    v_opens := (v_result->>'detail_opens_30d')::int;
    v_actions := coalesce((v_intents->>'directions')::int,0) + coalesce((v_intents->>'call')::int,0)
               + coalesce((v_intents->>'instagram')::int,0) + coalesce((v_intents->>'foodpanda')::int,0)
               + coalesce((v_intents->>'ubereats')::int,0) + coalesce((v_intents->>'share')::int,0);
    v_result := v_result || jsonb_build_object('funnel', jsonb_build_object(
      'impressions', v_impr, 'opens', v_opens, 'actions', v_actions,
      'open_rate',   case when v_impr>0 then round(100.0*v_opens/v_impr,1) else 0 end,
      'action_rate', case when v_opens>0 then round(100.0*v_actions/v_opens,1) else 0 end
    ));

    select coalesce(jsonb_agg(jsonb_build_object('q', q, 'count', c) order by c desc), '[]'::jsonb) into v_terms
    from (
      select activity_detail->>'q' q, count(*) c
      from public.activity_log
      where entity_type='place' and entity_id=v_eid and activity_type='explore_place_impression'
        and coalesce(activity_detail->>'q','') <> '' and created_at>=v_since
      group by 1 order by c desc limit 8
    ) s;
    v_result := v_result || jsonb_build_object('search_terms', v_terms);

    select type_id into v_type from public.locations where id=p_location_id;
    if v_type is not null then
      with cat as (select id from public.locations where type_id=v_type and approved and not is_archived),
      opens as (
        select c.id lid, coalesce(o.c,0) c from cat c
        left join (
          select entity_id::int lid, count(*) c from public.activity_log
          where entity_type='place' and activity_type='explore_place_detail_view' and created_at>=v_since and entity_id ~ '^[0-9]+$'
          group by 1
        ) o on o.lid=c.id
      )
      select
        (select c from opens where lid=p_location_id),
        (select count(*) from cat),
        (select round(avg(c)::numeric,1) from opens),
        (select count(*) from opens where c < (select c from opens where lid=p_location_id))
      into v_my_opens, v_cat_total, v_cat_avg, v_beat;

      v_result := v_result || jsonb_build_object('benchmark', jsonb_build_object(
        'category', (select name from public.location_types where id=v_type),
        'my_opens_30d', coalesce(v_my_opens,0),
        'category_total', coalesce(v_cat_total,0),
        'category_avg_30d', coalesce(v_cat_avg,0),
        'percentile', case when coalesce(v_cat_total,0)>0 then round(100.0*coalesce(v_beat,0)/v_cat_total)::int else 0 end,
        'rank', coalesce(v_cat_total,0) - coalesce(v_beat,0)
      ));
    end if;
  end if;

  return v_result;
end;
$$;

grant execute on function public.get_business_analytics(integer) to authenticated;
