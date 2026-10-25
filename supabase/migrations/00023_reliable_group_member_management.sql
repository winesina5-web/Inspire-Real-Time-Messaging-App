-- Reliable, server-authorized group member management.
create or replace function public.add_group_member(target_group_id uuid, target_user_id uuid)
returns public.group_members
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  group_row public.groups%rowtype;
  member_row public.group_members%rowtype;
  member_count integer;
begin
  if actor_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select * into group_row
  from public.groups
  where id = target_group_id
  for update;

  if not found then
    raise exception 'Group not found.' using errcode = 'P0002';
  end if;

  if not (
    group_row.created_by = actor_id
    or public.is_group_admin(target_group_id)
    or public.is_admin()
  ) then
    raise exception 'Only a group admin can add members.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = target_user_id and status = 'active'
  ) then
    raise exception 'Active registered user not found.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.group_members
    where group_id = target_group_id and user_id = target_user_id
  ) then
    raise exception 'This user is already a group member.' using errcode = '23505';
  end if;

  select count(*) into member_count
  from public.group_members
  where group_id = target_group_id;

  if member_count >= group_row.max_members then
    raise exception 'This group has reached its member limit.' using errcode = '23514';
  end if;

  insert into public.group_members(group_id, user_id, role)
  values (target_group_id, target_user_id, 'member')
  returning * into member_row;

  return member_row;
end;
$$;

revoke all on function public.add_group_member(uuid, uuid) from public, anon;
grant execute on function public.add_group_member(uuid, uuid) to authenticated;

-- Membership changes must be available to authenticated group members over Realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'group_members'
  ) then
    alter publication supabase_realtime add table public.group_members;
  end if;
end $$;

create index if not exists group_members_user_group_idx
  on public.group_members(user_id, group_id);
create index if not exists profiles_active_username_search_idx
  on public.profiles(username)
  where status = 'active' and username is not null;
