-- Public-safe lookup of a claimed location's owner display name (location_owners
-- RLS otherwise hides ownership rows from non-owners). Returns only the name.
create or replace function public.location_owner_name(p_location_id integer)
returns text
language sql stable security definer set search_path = public
as $$
  select p.display_name
  from public.location_owners o
  join public.user_profiles p on p.id = o.user_id
  where o.location_id = p_location_id and o.role = 'owner'
  order by o.created_at asc
  limit 1;
$$;

grant execute on function public.location_owner_name(integer) to anon, authenticated;
