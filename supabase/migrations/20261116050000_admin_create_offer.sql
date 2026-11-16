-- Admins can create discount-code offers from the app (no SQL needed).
--
-- Creation stays admin-only: an offer carries Halal Formosa's Pro rules (code
-- prefix, free_uses, follow settings). Owners can then edit the wording of
-- their own offers via update_my_offer (20261116010000_owner_offer_edit.sql).

create or replace function public.admin_create_offer(
  p_location_id     integer,
  p_code_prefix     text,
  p_kind            text,
  p_title           text,
  p_description     text,
  p_discount_label  text,
  p_free_uses       integer,
  p_is_active       boolean,
  p_require_follow  boolean,
  p_follow_instagram text,
  p_follow_tiktok   text,
  p_follow_facebook text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := upper(btrim(coalesce(p_code_prefix, '')));
  v_title  text := btrim(coalesce(p_title, ''));
  v_desc   text := nullif(btrim(coalesce(p_description, '')), '');
  v_label  text := nullif(btrim(coalesce(p_discount_label, '')), '');
  v_ig     text := nullif(ltrim(btrim(coalesce(p_follow_instagram, '')), '@'), '');
  v_tt     text := nullif(ltrim(btrim(coalesce(p_follow_tiktok, '')), '@'), '');
  v_fb     text := nullif(btrim(coalesce(p_follow_facebook, '')), '');
  v_row    public.location_offers;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin() then raise exception 'not_allowed'; end if;

  if not exists (select 1 from public.locations where id = p_location_id) then raise exception 'location_not_found'; end if;
  if v_prefix !~ '^[A-Z0-9]{2,12}$' then raise exception 'invalid_prefix'; end if;
  if exists (select 1 from public.location_offers where code_prefix = v_prefix) then raise exception 'prefix_taken'; end if;
  if coalesce(p_kind, '') not in ('menu', 'meat', 'other') then raise exception 'invalid_kind'; end if;
  if char_length(v_title) < 1 or char_length(v_title) > 80 then raise exception 'invalid_title'; end if;
  if v_desc is not null and char_length(v_desc) > 300 then raise exception 'invalid_description'; end if;
  if v_label is not null and char_length(v_label) > 24 then raise exception 'invalid_label'; end if;
  if coalesce(p_free_uses, -1) < 0 or p_free_uses > 100 then raise exception 'invalid_free_uses'; end if;

  begin
    insert into public.location_offers
      (location_id, code_prefix, kind, title, description, discount_label, free_uses, is_active,
       require_follow, follow_instagram, follow_tiktok, follow_facebook)
    values
      (p_location_id, v_prefix, p_kind, v_title, v_desc, v_label, p_free_uses, coalesce(p_is_active, true),
       coalesce(p_require_follow, true), v_ig, v_tt, v_fb)
    returning * into v_row;
  exception when check_violation then
    raise exception 'invalid_follow';
  end;

  return jsonb_build_object('id', v_row.id, 'code_prefix', v_row.code_prefix, 'title', v_row.title,
                            'is_active', v_row.is_active);
end;
$$;
revoke all on function public.admin_create_offer(integer, text, text, text, text, text, integer, boolean, boolean, text, text, text) from public, anon;
grant execute on function public.admin_create_offer(integer, text, text, text, text, text, integer, boolean, boolean, text, text, text) to authenticated;
