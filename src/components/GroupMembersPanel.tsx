import React, { useCallback, useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { useToast } from './Toast';
import { supabase } from '../lib/supabaseClient';

type GroupMember = {
  user_id: string;
  role: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
};

type SearchProfile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
};

type Props = {
  groupId: string;
  currentUserId: string;
  currentRole: string;
  onClose: () => void;
  onMembershipChanged?: (count: number) => void;
};

export const GroupMembersPanel: React.FC<Props> = ({ groupId, currentUserId, currentRole, onClose, onMembershipChanged }) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const isAdmin = currentRole === 'admin';

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const { data: rows, error } = await supabase.from('group_members')
        .select('user_id, role').eq('group_id', groupId);
      if (error) throw error;
      const ids = (rows || []).map((row: any) => row.user_id);
      const { data: profiles, error: profileError } = ids.length
        ? await supabase.from('profiles').select('id, username, display_name, avatar_url, is_online').in('id', ids)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const byId = new Map((profiles || []).map((p: any) => [p.id, p]));
      const mapped: GroupMember[] = (rows || []).map((row: any) => {
        const profile = byId.get(row.user_id);
        return {
          user_id: row.user_id,
          role: row.role || 'member',
          username: profile?.username || null,
          display_name: profile?.display_name || 'Inspire user',
          avatar_url: profile?.avatar_url || null,
          is_online: Boolean(profile?.is_online),
        };
      }).sort((a, b) => a.role === b.role ? a.display_name.localeCompare(b.display_name) : a.role === 'admin' ? -1 : 1);
      setMembers(mapped);
      onMembershipChanged?.(mapped.length);
    } catch (error: any) {
      console.error('Unable to load group members:', error);
      toast(error?.message || 'Could not load group members.', 'error');
    } finally {
      setLoadingMembers(false);
    }
  }, [groupId, onMembershipChanged, toast]);

  useEffect(() => {
    void loadMembers();
    const channel = supabase
      .channel(`group-members:${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `group_id=eq.${groupId}`,
      }, () => { void loadMembers(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [groupId, loadMembers]);

  const searchPeople = async (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim().replace(/^@/, '');
    if (term.length < 2) {
      toast('Enter at least 2 characters of a username or name.', 'info');
      return;
    }
    setSearching(true);
    try {
      const safeTerm = term.replace(/[,%()]/g, ' ').trim();
      const { data, error } = await supabase.from('profiles')
        .select('id, username, display_name, avatar_url')
        .or(`username.ilike.%${safeTerm}%,display_name.ilike.%${safeTerm}%`)
        .neq('id', currentUserId)
        .limit(12);
      if (error) throw error;
      const existing = new Set(members.map((member) => member.user_id));
      setResults((data || []).filter((profile: SearchProfile) => !existing.has(profile.id)));
      if (!data?.length) toast('No matching users found. Ask them to sign up and set a username first.', 'info');
    } catch (error: any) {
      console.error('Group member search failed:', error);
      toast(error?.message || 'User search failed. Please try again.', 'error');
    } finally {
      setSearching(false);
    }
  };

  const addMember = async (profile: SearchProfile) => {
    if (!isAdmin) return;
    setBusyId(profile.id);
    try {
      const { error } = await supabase.rpc('add_group_member', {
        target_group_id: groupId,
        target_user_id: profile.id,
      });
      if (error) {
        if (error.code === '23505') throw new Error('This person is already a group member.');
        if (error.code === '42501') throw new Error('Only a group admin can add members.');
        if (error.code === '23514') throw new Error('This group has reached its member limit.');
        throw error;
      }
      toast(`@${profile.username || profile.display_name} added to the group.`, 'success');
      setResults((current) => current.filter((item) => item.id !== profile.id));
      await loadMembers();
    } catch (error: any) {
      console.error('Add group member failed:', error);
      toast(error?.message || 'Could not add this person. Check group admin permissions.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (member: GroupMember) => {
    if (!isAdmin || member.user_id === currentUserId) return;
    if (!window.confirm(`Remove ${member.display_name} from this group?`)) return;
    setBusyId(member.user_id);
    try {
      const { error } = await supabase.from('group_members').delete()
        .eq('group_id', groupId).eq('user_id', member.user_id);
      if (error) throw error;
      toast(`${member.display_name} removed from the group.`, 'success');
      await loadMembers();
    } catch (error: any) {
      console.error('Remove group member failed:', error);
      toast(error?.message || 'Could not remove this member.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const leaveGroup = async () => {
    const otherAdmins = members.filter((member) => member.role === 'admin' && member.user_id !== currentUserId);
    if (isAdmin && otherAdmins.length === 0) {
      toast('You are the only admin. Add another admin before leaving this group.', 'error');
      return;
    }
    if (!window.confirm('Leave this group? You will stop receiving group messages.')) return;
    setLeaving(true);
    try {
      const { error } = await supabase.from('group_members').delete()
        .eq('group_id', groupId).eq('user_id', currentUserId);
      if (error) throw error;
      toast('You left the group.', 'success');
      onClose();
      window.location.assign('/chats');
    } catch (error: any) {
      toast(error?.message || 'Could not leave this group.', 'error');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <section role="dialog" aria-modal="true" aria-label="Group members" className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#161B2B] border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-2xl space-y-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Group members</h2>
            <p className="text-xs text-gray-500 mt-1">{members.length} real users · {isAdmin ? 'You can manage members' : 'Only group admins can add or remove people'}</p>
          </div>
          <button onClick={onClose} aria-label="Close group members" className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 font-bold">✕</button>
        </header>

        {isAdmin && (
          <form onSubmit={searchPeople} className="space-y-2">
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300" htmlFor="group-member-search">Add people by username or display name</label>
            <div className="flex gap-2">
              <input id="group-member-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. @adeel or Adeel" className="min-w-0 flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" disabled={searching} className="px-4 rounded-xl bg-[#0E2A6E] text-white text-sm font-bold disabled:opacity-50">{searching ? 'Searching…' : 'Search'}</button>
            </div>
            {results.length > 0 && <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
              {results.map((profile) => <div key={profile.id} className="flex items-center gap-3 p-3">
                <Avatar name={profile.display_name || profile.username || 'User'} avatarUrl={profile.avatar_url} size="md" />
                <div className="min-w-0 flex-1"><p className="text-sm font-bold truncate">{profile.display_name || 'Inspire user'}</p><p className="text-xs text-gray-500 truncate">@{profile.username || 'username-not-set'}</p></div>
                <button type="button" onClick={() => void addMember(profile)} disabled={busyId === profile.id} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">{busyId === profile.id ? 'Adding…' : 'Add'}</button>
              </div>)}
            </div>}
          </form>
        )}

        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wide font-black text-gray-500">People in this group</h3>
          {loadingMembers ? <p className="text-sm text-gray-500 py-5 text-center">Loading members…</p> : members.length === 0 ? <p className="text-sm text-gray-500 py-5 text-center">No members found.</p> : members.map((member) => <div key={member.user_id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/60">
            <div className="relative"><Avatar name={member.display_name || member.username || 'User'} avatarUrl={member.avatar_url} size="md" />{member.is_online && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-900" />}</div>
            <div className="min-w-0 flex-1"><p className="text-sm font-bold truncate">{member.display_name}{member.user_id === currentUserId ? ' (You)' : ''}</p><p className="text-xs text-gray-500 truncate">@{member.username || 'username-not-set'} · {member.is_online ? 'Online' : 'Offline'}</p></div>
            <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-full ${member.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>{member.role}</span>
            {isAdmin && member.user_id !== currentUserId && <button onClick={() => void removeMember(member)} disabled={busyId === member.user_id} title="Remove member" className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg disabled:opacity-50">{busyId === member.user_id ? '…' : 'Remove'}</button>}
          </div>)}
        </div>
        <footer className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <button onClick={() => void leaveGroup()} disabled={leaving} className="flex-1 py-3 rounded-xl border border-red-200 text-red-600 font-bold text-sm disabled:opacity-50">{leaving ? 'Leaving…' : 'Leave group'}</button>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 font-bold text-sm">Done</button>
        </footer>
      </section>
    </div>
  );
};
