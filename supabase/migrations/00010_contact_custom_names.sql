-- Per-user contact aliases: a contact's custom name is private to the owner of the contact row.
alter table public.contacts
  add column if not exists custom_name text;

drop policy if exists contacts_update_own on public.contacts;
create policy contacts_update_own
  on public.contacts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
