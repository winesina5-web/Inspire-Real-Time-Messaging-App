-- Repair recursive group membership policies and add row-scoped WebRTC signaling.
create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = (select auth.uid())
      and gm.role = 'admin'
  );
$$;

revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.is_group_admin(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;

drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select to authenticated
  using (
    is_public = true
    or created_by = (select auth.uid())
    or public.is_group_member(id)
    or public.is_admin()
  );

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups
  for update to authenticated
  using (public.is_group_admin(id) or public.is_admin())
  with check (public.is_group_admin(id) or public.is_admin());

drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_group_member(group_id) or public.is_admin());

drop policy if exists group_members_insert on public.group_members;
create policy group_members_insert on public.group_members
  for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_group_admin(group_id) or public.is_admin());

drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_group_admin(group_id) or public.is_admin());

create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('offer', 'answer', 'ice-candidate', 'hangup', 'reject')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint call_signals_no_self_call check (sender_id <> receiver_id)
);

create index if not exists call_signals_receiver_call_created_idx
  on public.call_signals(receiver_id, call_id, created_at);

alter table public.call_signals enable row level security;
grant select, insert, delete on public.call_signals to authenticated;

drop policy if exists call_signals_select_participants on public.call_signals;
create policy call_signals_select_participants on public.call_signals
  for select to authenticated
  using ((select auth.uid()) = sender_id or (select auth.uid()) = receiver_id);

drop policy if exists call_signals_insert_sender on public.call_signals;
create policy call_signals_insert_sender on public.call_signals
  for insert to authenticated
  with check ((select auth.uid()) = sender_id and sender_id <> receiver_id);

drop policy if exists call_signals_delete_participants on public.call_signals;
create policy call_signals_delete_participants on public.call_signals
  for delete to authenticated
  using ((select auth.uid()) = sender_id or (select auth.uid()) = receiver_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'call_signals'
  ) then
    alter publication supabase_realtime add table public.call_signals;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'calls'
  ) then
    alter publication supabase_realtime add table public.calls;
  end if;
exception when undefined_object then
  raise notice 'supabase_realtime publication not found; enable call_signals in Realtime publication manually';
end;
$$;
