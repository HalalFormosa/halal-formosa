-- Store owners can edit the wording of their own offers.
--
-- Owners (location_owners) and admins may change ONLY title, description,
-- badge text and the on/off switch of an offer at their store. Everything that
-- carries Halal Formosa's Pro rules (code prefix, free_uses, code_ttl_days,
-- location, validity window) stays admin-only: the table's RLS policy still
-- blocks direct writes, and these SECURITY DEFINER functions are the only path.

create or replace function public.list_my_offers(p_location_id integer)
returns table (
  id uuid,
  location_id integer,
  kind text,
  title text,
  description text,
  discount_label text,
  free_uses integer,
  is_active boolean,
  code_prefix text,
  issued_count bigint,
  redeemed_count bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not (public.is_admin() or exists (
        select 1 from public.location_owners lo2
         where lo2.location_id = p_location_id and lo2.user_id = auth.uid())) then
    raise exception 'not_allowed';
  end if;

  return query
    select o.id, o.location_id, o.kind, o.title, o.description, o.discount_label,
           o.free_uses, o.is_active, o.code_prefix,
           (select count(*) from public.offer_codes c where c.offer_id = o.id),
           (select count(*) from public.offer_codes c where c.offer_id = o.id and c.redeemed_at is not null)
      from public.location_offers o
     where o.location_id = p_location_id
     order by o.created_at;
end;
$$;
revoke all on function public.list_my_offers(integer) from public, anon;
grant execute on function public.list_my_offers(integer) to authenticated;

create or replace function public.update_my_offer(
  p_offer_id uuid,
  p_title text,
  p_description text,
  p_discount_label text,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loc integer;
  v_title text := btrim(coalesce(p_title, ''));
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_label text := nullif(btrim(coalesce(p_discount_label, '')), '');
  v_row public.location_offers;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select o.location_id into v_loc from public.location_offers o where o.id = p_offer_id;
  if not found then raise exception 'offer_not_found'; end if;

  if not (public.is_admin() or exists (
        select 1 from public.location_owners lo2
         where lo2.location_id = v_loc and lo2.user_id = auth.uid())) then
    raise exception 'not_allowed';
  end if;

  if char_length(v_title) < 1 or char_length(v_title) > 80 then raise exception 'invalid_title'; end if;
  if v_desc is not null and char_length(v_desc) > 300 then raise exception 'invalid_description'; end if;
  if v_label is not null and char_length(v_label) > 24 then raise exception 'invalid_label'; end if;

  update public.location_offers o
     set title = v_title,
         description = v_desc,
         discount_label = v_label,
         is_active = coalesce(p_is_active, o.is_active)
   where o.id = p_offer_id
   returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'title', v_row.title, 'description', v_row.description,
                            'discount_label', v_row.discount_label, 'is_active', v_row.is_active);
end;
$$;
revoke all on function public.update_my_offer(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.update_my_offer(uuid, text, text, text, boolean) to authenticated;
