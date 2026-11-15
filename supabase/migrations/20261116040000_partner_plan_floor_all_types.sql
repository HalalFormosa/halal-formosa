-- Widen the partner plan floor from "merchant" partners to every partner type
-- except certifying bodies (halal_body): the stores a certifier certifies did
-- not pay, but organization / merchant / vendor / campus / government partners
-- own or bring their own stores (e.g. Kedai Sri Rahayu, an "organization" with
-- four branches). See 20261116020000_partner_tier_plan_floor.sql.

create or replace function public.partner_plan_floor(p_location_id integer)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.partner_tier
    from public.locations l
    join public.partners p on p.id = l.partner_id
   where l.id = p_location_id
     and p.is_active
     and p.partner_type <> 'halal_body'
     and p.partner_tier in ('bronze', 'silver', 'gold');
$$;
revoke all on function public.partner_plan_floor(integer) from public, anon, authenticated;

-- The partner-change trigger only watched tier/active/type; keep it as is and
-- re-apply the rule to every location that already has a partner.
do $$
declare r record;
begin
  for r in select id from public.locations where partner_id is not null loop
    perform public.sync_partner_plan(r.id);
  end loop;
end $$;
