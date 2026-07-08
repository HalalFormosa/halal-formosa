-- Private bucket for claim proof documents (business registration, storefront
-- photos). Path convention: {userId}/{locationId}/{file} so ownership is derivable.
insert into storage.buckets (id, name, public)
values ('claim-proofs', 'claim-proofs', false)
on conflict (id) do nothing;

-- Uploader may write only under their own user-id folder
drop policy if exists claim_proofs_insert on storage.objects;
create policy claim_proofs_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'claim-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read restricted to the uploader and admins
drop policy if exists claim_proofs_select on storage.objects;
create policy claim_proofs_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'claim-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Uploader/admin may delete
drop policy if exists claim_proofs_delete on storage.objects;
create policy claim_proofs_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'claim-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
