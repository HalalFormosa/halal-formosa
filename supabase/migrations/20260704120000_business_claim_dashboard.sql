-- ============================================================================
-- Business Claim & Dashboard
-- Lets a business claim its establishment (locations row), get verified by an
-- admin, and self-manage the listing through a tiered dashboard.
--
-- Grounded in real schema:
--   - locations.id is integer (serial)
--   - admin check convention: EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role='admin')
--   - locations currently has NO user-facing UPDATE policy (owner writes go via RPC)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- locations: halal-transparency attributes + claimed flag
-- ---------------------------------------------------------------------------
alter table public.locations
  add column if not exists halal_status    text check (halal_status in ('certified','self_reported','muslim_friendly')),
  add column if not exists has_prayer_room  boolean not null default false,
  add column if not exists has_wudu         boolean not null default false,
  add column if not exists is_alcohol_free  boolean not null default false,
  add column if not exists is_claimed       boolean not null default false;

-- ---------------------------------------------------------------------------
-- location_owners: authoritative ownership link (the dashboard reads this)
-- ---------------------------------------------------------------------------
create table if not exists public.location_owners (
  id          uuid primary key default gen_random_uuid(),
  location_id integer not null references public.locations(id) on delete cascade,
  user_id     uuid    not null references auth.users(id) on delete cascade,
  role        text    not null default 'owner' check (role in ('owner','manager')),
  created_at  timestamptz not null default now(),
  unique (location_id, user_id)
);
create index if not exists location_owners_user_idx on public.location_owners(user_id);

-- ---------------------------------------------------------------------------
-- location_claims: claim requests (mirrors merchant_applications pattern)
-- ---------------------------------------------------------------------------
create table if not exists public.location_claims (
  id                      uuid primary key default gen_random_uuid(),
  location_id             integer not null references public.locations(id) on delete cascade,
  user_id                 uuid    not null references auth.users(id) on delete cascade,
  status                  text    not null default 'pending' check (status in ('pending','approved','rejected')),
  claimant_role           text    not null default 'owner'   check (claimant_role in ('owner','manager','staff')),
  contact_name            text,
  contact_phone           text    not null,
  contact_email           text,
  unified_business_number text,
  proof_urls              jsonb   not null default '[]'::jsonb,
  note                    text,
  rejection_reason        text,
  reviewed_by             uuid references auth.users(id),
  reviewed_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
-- one open claim per (location, user)
create unique index if not exists location_claims_pending_uniq
  on public.location_claims (location_id, user_id) where status = 'pending';
create index if not exists location_claims_status_idx on public.location_claims(status);

-- ---------------------------------------------------------------------------
-- location_edit_requests: high-risk owner edits awaiting admin review
-- ---------------------------------------------------------------------------
create table if not exists public.location_edit_requests (
  id               uuid primary key default gen_random_uuid(),
  location_id      integer not null references public.locations(id) on delete cascade,
  submitted_by     uuid    not null references auth.users(id) on delete cascade,
  changes          jsonb   not null,
  status           text    not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz not null default now()
);
create index if not exists location_edit_requests_status_idx on public.location_edit_requests(status);

-- ---------------------------------------------------------------------------
-- location_photos: gallery beyond the single locations.image (tier-gated count)
-- ---------------------------------------------------------------------------
create table if not exists public.location_photos (
  id          uuid primary key default gen_random_uuid(),
  location_id integer not null references public.locations(id) on delete cascade,
  url         text not null,
  caption     text,
  sort_order  integer not null default 0,
  uploaded_by uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create index if not exists location_photos_location_idx on public.location_photos(location_id);

-- ---------------------------------------------------------------------------
-- location_menu_items: menu (Silver+)
-- ---------------------------------------------------------------------------
create table if not exists public.location_menu_items (
  id          uuid primary key default gen_random_uuid(),
  location_id integer not null references public.locations(id) on delete cascade,
  name        text not null,
  name_zh     text,
  price       numeric(10,2),
  description text,
  photo_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists location_menu_items_location_idx on public.location_menu_items(location_id);

-- ---------------------------------------------------------------------------
-- location_promotions: offers/announcements (Bronze+, count-gated)
-- ---------------------------------------------------------------------------
create table if not exists public.location_promotions (
  id          uuid primary key default gen_random_uuid(),
  location_id integer not null references public.locations(id) on delete cascade,
  title       text not null,
  body        text,
  image_url   text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create index if not exists location_promotions_location_idx on public.location_promotions(location_id);

-- ---------------------------------------------------------------------------
-- location_plans: business subscription plan per claimed location
-- (kept separate from partners.partner_tier, which is about certification partners)
-- ---------------------------------------------------------------------------
create table if not exists public.location_plans (
  location_id integer primary key references public.locations(id) on delete cascade,
  tier        text not null default 'free'          check (tier in ('free','bronze','silver','gold')),
  source      text not null default 'complimentary' check (source in ('complimentary','manual','revenuecat')),
  status      text not null default 'active'        check (status in ('active','expired','canceled')),
  expires_at  timestamptz,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tier feature matrix (editable via admin master-data without a deploy).
-- maxPhotos / maxPromotions: -1 = unlimited
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, description)
select
  'business_plan_features',
  '{
    "free":   {"maxPhotos": 1,  "menu": false, "maxPromotions": 0,  "analytics": "basic"},
    "bronze": {"maxPhotos": 5,  "menu": false, "maxPromotions": 1,  "analytics": "standard"},
    "silver": {"maxPhotos": 10, "menu": true,  "maxPromotions": 3,  "analytics": "standard"},
    "gold":   {"maxPhotos": -1, "menu": true,  "maxPromotions": -1, "analytics": "advanced"}
  }',
  'Feature entitlements per business plan tier (Business Claim & Dashboard)'
where not exists (select 1 from public.app_config where key = 'business_plan_features');

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can be used inside other tables'
-- RLS policies without tripping over those tables' own RLS). Defined after the
-- tables they reference so SQL function bodies validate.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_location_manager(loc_id integer)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.location_owners
    where location_id = loc_id and user_id = auth.uid()
  );
$$;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.location_owners        enable row level security;
alter table public.location_claims        enable row level security;
alter table public.location_edit_requests enable row level security;
alter table public.location_photos        enable row level security;
alter table public.location_menu_items    enable row level security;
alter table public.location_promotions    enable row level security;
alter table public.location_plans         enable row level security;

-- location_owners: user reads own; admin manages all (grants happen via RPC)
create policy location_owners_select on public.location_owners
  for select using (user_id = auth.uid() or public.is_admin());
create policy location_owners_admin on public.location_owners
  for all using (public.is_admin()) with check (public.is_admin());

-- location_claims: user inserts/reads own; admin manages all (approval via RPC)
create policy location_claims_select on public.location_claims
  for select using (user_id = auth.uid() or public.is_admin());
create policy location_claims_insert on public.location_claims
  for insert with check (user_id = auth.uid());
create policy location_claims_admin on public.location_claims
  for all using (public.is_admin()) with check (public.is_admin());

-- location_edit_requests: managers read own location's; admin manages all
create policy location_edit_requests_select on public.location_edit_requests
  for select using (public.is_location_manager(location_id) or public.is_admin());
create policy location_edit_requests_admin on public.location_edit_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- location_photos / menu / promotions: public read; manager or admin writes
create policy location_photos_select on public.location_photos for select using (true);
create policy location_photos_write  on public.location_photos for all
  using (public.is_location_manager(location_id) or public.is_admin())
  with check (public.is_location_manager(location_id) or public.is_admin());

create policy location_menu_select on public.location_menu_items for select using (true);
create policy location_menu_write  on public.location_menu_items for all
  using (public.is_location_manager(location_id) or public.is_admin())
  with check (public.is_location_manager(location_id) or public.is_admin());

create policy location_promotions_select on public.location_promotions for select using (true);
create policy location_promotions_write  on public.location_promotions for all
  using (public.is_location_manager(location_id) or public.is_admin())
  with check (public.is_location_manager(location_id) or public.is_admin());

-- location_plans: public read (for tier badges); admin writes (v1 assigns manually)
create policy location_plans_select on public.location_plans for select using (true);
create policy location_plans_admin  on public.location_plans for all
  using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- Grants (explicit; do not rely on default privileges)
-- ===========================================================================
grant select on
  public.location_photos, public.location_menu_items,
  public.location_promotions, public.location_plans
  to anon, authenticated;

grant select, insert, update, delete on
  public.location_photos, public.location_menu_items, public.location_promotions
  to authenticated;

grant select, insert on public.location_claims to authenticated;
grant select on public.location_owners, public.location_edit_requests to authenticated;

-- ===========================================================================
-- Tier-limit enforcement (server-side; never trust the client)
-- ===========================================================================
create or replace function public.enforce_location_photo_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tier     text;
  v_features jsonb;
  v_max      int;
  v_count    int;
begin
  if public.is_admin() then return new; end if;
  select coalesce(tier, 'free') into v_tier from public.location_plans where location_id = new.location_id;
  v_tier := coalesce(v_tier, 'free');
  select (value::jsonb) -> v_tier into v_features from public.app_config where key = 'business_plan_features';
  v_max := coalesce((v_features->>'maxPhotos')::int, 1);
  if v_max = -1 then return new; end if;
  select count(*) into v_count from public.location_photos where location_id = new.location_id;
  if v_count >= v_max then
    raise exception 'Photo limit for this plan reached (%). Upgrade to add more.', v_tier using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger trg_location_photo_limit
  before insert on public.location_photos
  for each row execute function public.enforce_location_photo_limit();

create or replace function public.enforce_location_menu_enabled()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tier     text;
  v_features jsonb;
begin
  if public.is_admin() then return new; end if;
  select coalesce(tier, 'free') into v_tier from public.location_plans where location_id = new.location_id;
  v_tier := coalesce(v_tier, 'free');
  select (value::jsonb) -> v_tier into v_features from public.app_config where key = 'business_plan_features';
  if coalesce((v_features->>'menu')::boolean, false) is not true then
    raise exception 'Menu is not available on the % plan. Upgrade to add a menu.', v_tier using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger trg_location_menu_enabled
  before insert on public.location_menu_items
  for each row execute function public.enforce_location_menu_enabled();

create or replace function public.enforce_location_promotion_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tier     text;
  v_features jsonb;
  v_max      int;
  v_count    int;
begin
  if public.is_admin() then return new; end if;
  select coalesce(tier, 'free') into v_tier from public.location_plans where location_id = new.location_id;
  v_tier := coalesce(v_tier, 'free');
  select (value::jsonb) -> v_tier into v_features from public.app_config where key = 'business_plan_features';
  v_max := coalesce((v_features->>'maxPromotions')::int, 0);
  if v_max = -1 then return new; end if;
  if v_max = 0 then
    raise exception 'Promotions are not available on the % plan. Upgrade to post offers.', v_tier using errcode = 'check_violation';
  end if;
  select count(*) into v_count from public.location_promotions
   where location_id = new.location_id and is_active = true;
  if v_count >= v_max then
    raise exception 'Active promotion limit for this plan reached (%).', v_tier using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger trg_location_promotion_limit
  before insert on public.location_promotions
  for each row execute function public.enforce_location_promotion_limit();

-- ===========================================================================
-- RPCs
-- ===========================================================================

-- Approve a claim: mark approved, grant ownership, flag location claimed,
-- seed a free plan. Admin-only.
create or replace function public.approve_claim(p_claim_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_claim public.location_claims;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve claims';
  end if;

  select * into v_claim from public.location_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;

  update public.location_claims
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   where id = p_claim_id;

  insert into public.location_owners (location_id, user_id, role)
  values (v_claim.location_id, v_claim.user_id,
          case when v_claim.claimant_role = 'manager' then 'manager' else 'owner' end)
  on conflict (location_id, user_id) do nothing;

  update public.locations set is_claimed = true where id = v_claim.location_id;

  insert into public.location_plans (location_id, tier)
  values (v_claim.location_id, 'free')
  on conflict (location_id) do nothing;
end;
$$;

-- Reject a claim. Admin-only.
create or replace function public.reject_claim(p_claim_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can reject claims';
  end if;
  update public.location_claims
     set status = 'rejected', rejection_reason = p_reason,
         reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   where id = p_claim_id;
end;
$$;

-- Owner edit: apply low-risk fields immediately, queue high-risk fields for
-- admin review. Only whitelisted keys are honored.
create or replace function public.update_location_as_owner(p_location_id integer, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_low   jsonb := '{}'::jsonb;
  v_high  jsonb := '{}'::jsonb;
  v_key   text;
  v_val   jsonb;
  low_fields  text[] := array['phone','instagram','line_id','foodpanda_url','description',
                              'opening_hours','price_range','image',
                              'has_prayer_room','has_wudu','is_alcohol_free'];
  high_fields text[] := array['name','address','lat','lng','type_id','halal_status'];
begin
  if not (public.is_location_manager(p_location_id) or public.is_admin()) then
    raise exception 'Not authorized for this location';
  end if;

  for v_key, v_val in select key, value from jsonb_each(p_patch) loop
    if v_key = any(low_fields) then
      v_low := v_low || jsonb_build_object(v_key, v_val);
    elsif v_key = any(high_fields) then
      v_high := v_high || jsonb_build_object(v_key, v_val);
    end if;
  end loop;

  if v_low <> '{}'::jsonb then
    update public.locations set
      phone           = case when v_low ? 'phone'           then v_low->>'phone'           else phone end,
      instagram       = case when v_low ? 'instagram'       then v_low->>'instagram'       else instagram end,
      line_id         = case when v_low ? 'line_id'         then v_low->>'line_id'         else line_id end,
      foodpanda_url   = case when v_low ? 'foodpanda_url'   then v_low->>'foodpanda_url'   else foodpanda_url end,
      description     = case when v_low ? 'description'     then v_low->>'description'     else description end,
      price_range     = case when v_low ? 'price_range'     then v_low->>'price_range'     else price_range end,
      image           = case when v_low ? 'image'           then v_low->>'image'           else image end,
      opening_hours   = case when v_low ? 'opening_hours'   then v_low->'opening_hours'    else opening_hours end,
      has_prayer_room = case when v_low ? 'has_prayer_room' then (v_low->>'has_prayer_room')::boolean else has_prayer_room end,
      has_wudu        = case when v_low ? 'has_wudu'        then (v_low->>'has_wudu')::boolean        else has_wudu end,
      is_alcohol_free = case when v_low ? 'is_alcohol_free' then (v_low->>'is_alcohol_free')::boolean else is_alcohol_free end,
      updated_at      = now(),
      updated_by      = auth.uid()
    where id = p_location_id;
  end if;

  if v_high <> '{}'::jsonb then
    insert into public.location_edit_requests (location_id, submitted_by, changes)
    values (p_location_id, auth.uid(), v_high);
  end if;

  return jsonb_build_object('applied', v_low, 'queued', v_high);
end;
$$;

-- Apply / reject a queued edit request. Admin-only.
create or replace function public.review_location_edit_request(p_request_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_req    public.location_edit_requests;
  v_key    text;
  v_val    jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review edit requests';
  end if;

  select * into v_req from public.location_edit_requests where id = p_request_id for update;
  if not found then raise exception 'Edit request not found'; end if;

  if p_approve then
    for v_key, v_val in select key, value from jsonb_each(v_req.changes) loop
      case v_key
        when 'name'         then update public.locations set name = v_val #>> '{}' where id = v_req.location_id;
        when 'address'      then update public.locations set address = v_val #>> '{}' where id = v_req.location_id;
        when 'lat'          then update public.locations set lat = (v_val #>> '{}')::double precision where id = v_req.location_id;
        when 'lng'          then update public.locations set lng = (v_val #>> '{}')::double precision where id = v_req.location_id;
        when 'type_id'      then update public.locations set type_id = (v_val #>> '{}')::integer where id = v_req.location_id;
        when 'halal_status' then update public.locations set halal_status = v_val #>> '{}' where id = v_req.location_id;
        else null;
      end case;
    end loop;
    update public.locations set updated_at = now(), updated_by = auth.uid() where id = v_req.location_id;
  end if;

  update public.location_edit_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         rejection_reason = case when p_approve then null else p_reason end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_request_id;
end;
$$;

grant execute on function
  public.approve_claim(uuid),
  public.reject_claim(uuid, text),
  public.update_location_as_owner(integer, jsonb),
  public.review_location_edit_request(uuid, boolean, text),
  public.is_location_manager(integer)
  to authenticated;
