-- Supabase Migration: Location-Aware Muslim Facility Reviews

-- 1. Add avg_rating and review_count to locations table if they do not exist
alter table public.locations add column if not exists avg_rating double precision default 0;
alter table public.locations add column if not exists review_count int default 0;

-- 2. Add nearby_prompts_enabled to user_profiles table if it does not exist
alter table public.user_profiles add column if not exists nearby_prompts_enabled boolean default true;

-- 3. Create location_reviews table
create table if not exists public.location_reviews (
  id uuid primary key default gen_random_uuid(),
  location_id int not null references public.locations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int check (rating between 1 and 5),
  comment text,
  facilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, user_id)
);

-- Enable RLS on location_reviews
alter table public.location_reviews enable row level security;

create policy select_location_reviews on public.location_reviews
  for select using (true);

create policy insert_location_reviews on public.location_reviews
  for insert with check (auth.uid() = user_id);

create policy update_location_reviews on public.location_reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy delete_location_reviews on public.location_reviews
  for delete using (auth.uid() = user_id);

-- 4. Trigger to automatically recompute locations avg_rating and review_count
create or replace function public.recompute_location_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_id int;
  v_avg_rating double precision;
  v_review_count int;
begin
  if (tg_op = 'DELETE') then
    v_location_id := old.location_id;
  else
    v_location_id := new.location_id;
  end if;

  -- Average rating is calculated over reviews that actually have a rating
  select coalesce(avg(rating), 0)
  into v_avg_rating
  from public.location_reviews
  where location_id = v_location_id and rating is not null;

  -- Review count is the count of all reviews (including comment/facility-only ones)
  select count(*)::int
  into v_review_count
  from public.location_reviews
  where location_id = v_location_id;

  update public.locations
  set
    avg_rating = v_avg_rating,
    review_count = v_review_count
  where id = v_location_id;

  return null;
end;
$$;

create or replace trigger trigger_recompute_location_rating
after insert or update or delete on public.location_reviews
for each row
execute function public.recompute_location_rating();

-- 5. Create location_visits table
create table if not exists public.location_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id int not null references public.locations(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  dwell_confirmed bool not null default false,
  prompt_sent_at timestamptz,
  dismissed bool not null default false,
  reviewed bool not null default false,
  unique (user_id, location_id)
);

-- Enable RLS on location_visits
alter table public.location_visits enable row level security;

create policy select_own_location_visits on public.location_visits
  for select using (auth.uid() = user_id);

-- 6. RPC: record_visit
create or replace function public.record_visit(p_location_id int)
returns public.location_visits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_visit public.location_visits;
  v_dwell_threshold interval := interval '3 minutes';
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  insert into public.location_visits (user_id, location_id, first_seen_at, last_seen_at, dwell_confirmed)
  values (v_user_id, p_location_id, now(), now(), false)
  on conflict (user_id, location_id) do update
  set
    last_seen_at = now(),
    dwell_confirmed = case 
      when location_visits.dwell_confirmed = true then true
      when now() - location_visits.first_seen_at >= v_dwell_threshold then true
      else false
    end
  returning * into v_visit;

  return v_visit;
end;
$$;

-- 7. RPC: find_reviewable_locations_near
create or replace function public.find_reviewable_locations_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int
)
returns table (
  id int,
  name text,
  lat double precision,
  lng double precision,
  type_id int,
  distance_m int
) language sql security definer set search_path = public as $$
  select
    l.id,
    l.name,
    l.lat,
    l.lng,
    l.type_id,
    round(
      sqrt(
        power(l.lat - p_lat, 2) +
        power(l.lng - p_lng, 2)
      ) * 111139
    )::int as distance_m
  from locations l
  where
    l.approved = true
    and l.is_archived = false
    and (
      l.type_id in (2, 3, 4, 6, 7, 11, 12, 15)
      or l.halal_status in ('certified', 'self_reported', 'muslim_friendly')
    )
    and (
      sqrt(
        power(l.lat - p_lat, 2) +
        power(l.lng - p_lng, 2)
      ) * 111139 <= p_radius_m
    )
  order by distance_m asc;
$$;

-- 8. RPC: get_location_facility_summary
create or replace function public.get_location_facility_summary(p_location_id int)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(key, counts), '{}'::jsonb)
  from (
    select
      key,
      jsonb_object_agg(value, count) as counts
    from (
      select
        f.key,
        f.value,
        count(*)::int as count
      from public.location_reviews lr,
      jsonb_each_text(lr.facilities) f
      where lr.location_id = p_location_id
      group by f.key, f.value
    ) sub
    group by key
  ) sub2;
$$;

-- 9. RPC: get_pending_visit_prompts (service-role only)
create or replace function public.get_pending_visit_prompts(p_hours int default 2)
returns table (
  visit_id uuid,
  user_id uuid,
  location_id int,
  location_name text
) language sql security definer set search_path = public as $$
  select
    v.id as visit_id,
    v.user_id,
    v.location_id,
    l.name as location_name
  from public.location_visits v
  join public.locations l on l.id = v.location_id
  join public.user_profiles up on up.id = v.user_id
  where v.dwell_confirmed = true
    and v.reviewed = false
    and v.dismissed = false
    and v.prompt_sent_at is null
    and v.first_seen_at < now() - (p_hours || ' hours')::interval
    and up.nearby_prompts_enabled = true;
$$;

revoke execute on function public.get_pending_visit_prompts(int) from public, anon, authenticated;

-- 10. RPC: mark_visit_prompted (service-role only)
create or replace function public.mark_visit_prompted(p_visit_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.location_visits
  set prompt_sent_at = now()
  where id = p_visit_id;
$$;

revoke execute on function public.mark_visit_prompted(uuid) from public, anon, authenticated;
