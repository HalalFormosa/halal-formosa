-- Supabase Migration: Allow verified owners to reply to location reviews
create policy update_location_reviews_owner on public.location_reviews
  for update
  using (
    exists (
      select 1 from public.location_owners
      where location_owners.location_id = location_reviews.location_id
        and location_owners.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.location_owners
      where location_owners.location_id = location_reviews.location_id
        and location_owners.user_id = auth.uid()
    )
  );
