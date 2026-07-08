-- Draft/publish for business listing edits.
-- Owners save edits privately (draft), preview, then publish to go live.
-- Publish reuses update_location_as_owner so high-risk fields still route to
-- admin review.

create table if not exists public.location_drafts (
  location_id integer primary key references public.locations(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now()
);

alter table public.location_drafts enable row level security;

create policy location_drafts_rw on public.location_drafts for all
  using (public.is_location_manager(location_id) or public.is_admin())
  with check (public.is_location_manager(location_id) or public.is_admin());

grant select, insert, update, delete on public.location_drafts to authenticated;

-- Save (merge) draft fields. Nothing goes live.
create or replace function public.save_location_draft(p_location_id integer, p_patch jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_location_manager(p_location_id) or public.is_admin()) then
    raise exception 'Not authorized for this location';
  end if;
  insert into public.location_drafts(location_id, data, updated_by, updated_at)
  values (p_location_id, p_patch, auth.uid(), now())
  on conflict (location_id) do update
    set data = public.location_drafts.data || excluded.data,
        updated_by = excluded.updated_by,
        updated_at = now();
end; $$;

-- Publish the draft: applies low-risk fields live, queues high-risk fields for
-- admin review (reusing update_location_as_owner), then clears the draft.
create or replace function public.publish_location_draft(p_location_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_data jsonb; v_result jsonb;
begin
  if not (public.is_location_manager(p_location_id) or public.is_admin()) then
    raise exception 'Not authorized for this location';
  end if;
  select data into v_data from public.location_drafts where location_id = p_location_id;
  if v_data is null or v_data = '{}'::jsonb then
    return jsonb_build_object('applied', '{}'::jsonb, 'queued', '{}'::jsonb);
  end if;
  v_result := public.update_location_as_owner(p_location_id, v_data);
  delete from public.location_drafts where location_id = p_location_id;
  return v_result;
end; $$;

grant execute on function
  public.save_location_draft(integer, jsonb),
  public.publish_location_draft(integer)
  to authenticated;
