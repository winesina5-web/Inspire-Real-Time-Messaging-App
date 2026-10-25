-- Enforce block relationships at the database boundary for direct messages.
-- The helper is SECURITY DEFINER only so it can check whether the recipient
-- has blocked the sender without exposing that block-list row through RLS.
-- It only returns true when the caller is the message sender.

create or replace function public.can_send_direct_message(
  target_sender_id uuid,
  target_receiver_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = target_sender_id
    and not exists (
      select 1
      from public.blocked_users bu
      where (bu.blocker_id = target_sender_id and bu.blocked_id = target_receiver_id)
         or (bu.blocker_id = target_receiver_id and bu.blocked_id = target_sender_id)
    );
$$;

revoke all on function public.can_send_direct_message(uuid, uuid) from public;
revoke all on function public.can_send_direct_message(uuid, uuid) from anon;
grant execute on function public.can_send_direct_message(uuid, uuid) to authenticated;

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender
on public.messages
for insert
to authenticated
with check (
  (select auth.uid()) = sender_id
  and (
    receiver_id is null
    or public.can_send_direct_message(sender_id, receiver_id)
  )
);
