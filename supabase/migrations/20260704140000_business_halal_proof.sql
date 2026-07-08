-- Halal proof: certificate (for 'certified') and raw-material photos (for 'self_reported').
-- Stored on the listing as low-risk fields so they publish immediately; halal_status
-- itself stays high-risk and continues to route to admin review with this proof attached.

alter table public.locations
  add column if not exists halal_cert_url        text,
  add column if not exists halal_material_photos jsonb not null default '[]'::jsonb;

create or replace function public.update_location_as_owner(p_location_id integer, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_low jsonb := '{}'::jsonb; v_high jsonb := '{}'::jsonb; v_key text; v_val jsonb;
  low_fields  text[] := array['phone','instagram','line_id','foodpanda_url','description',
                              'opening_hours','price_range','image',
                              'has_prayer_room','has_wudu','is_alcohol_free',
                              'halal_cert_url','halal_material_photos'];
  high_fields text[] := array['name','address','lat','lng','type_id','halal_status'];
begin
  if not (public.is_location_manager(p_location_id) or public.is_admin()) then
    raise exception 'Not authorized for this location';
  end if;
  for v_key, v_val in select key, value from jsonb_each(p_patch) loop
    if v_key = any(low_fields) then v_low := v_low || jsonb_build_object(v_key, v_val);
    elsif v_key = any(high_fields) then v_high := v_high || jsonb_build_object(v_key, v_val);
    end if;
  end loop;
  if v_low <> '{}'::jsonb then
    update public.locations set
      phone                 = case when v_low ? 'phone'                 then v_low->>'phone'                 else phone end,
      instagram             = case when v_low ? 'instagram'             then v_low->>'instagram'             else instagram end,
      line_id               = case when v_low ? 'line_id'               then v_low->>'line_id'               else line_id end,
      foodpanda_url         = case when v_low ? 'foodpanda_url'         then v_low->>'foodpanda_url'         else foodpanda_url end,
      description           = case when v_low ? 'description'           then v_low->>'description'           else description end,
      price_range           = case when v_low ? 'price_range'           then v_low->>'price_range'           else price_range end,
      image                 = case when v_low ? 'image'                 then v_low->>'image'                 else image end,
      opening_hours         = case when v_low ? 'opening_hours'         then v_low->'opening_hours'          else opening_hours end,
      has_prayer_room       = case when v_low ? 'has_prayer_room'       then (v_low->>'has_prayer_room')::boolean else has_prayer_room end,
      has_wudu              = case when v_low ? 'has_wudu'              then (v_low->>'has_wudu')::boolean        else has_wudu end,
      is_alcohol_free       = case when v_low ? 'is_alcohol_free'       then (v_low->>'is_alcohol_free')::boolean else is_alcohol_free end,
      halal_cert_url        = case when v_low ? 'halal_cert_url'        then v_low->>'halal_cert_url'        else halal_cert_url end,
      halal_material_photos = case when v_low ? 'halal_material_photos' then v_low->'halal_material_photos'  else halal_material_photos end,
      updated_at            = now(),
      updated_by            = auth.uid()
    where id = p_location_id;
  end if;
  if v_high <> '{}'::jsonb then
    insert into public.location_edit_requests (location_id, submitted_by, changes)
    values (p_location_id, auth.uid(), v_high);
  end if;
  return jsonb_build_object('applied', v_low, 'queued', v_high);
end;
$$;
