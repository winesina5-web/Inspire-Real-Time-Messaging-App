import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { Avatar } from '../components/Avatar';
import { supabase, isConfigured } from '../lib/supabaseClient';

interface BlockedEntry {
  blocked_id: string;
  created_at: string;
  profile: { id: string; username: string; display_name: string; avatar_url?: string | null } | null;
}

export const BlockedUsersPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<BlockedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!user || !isConfigured) { setEntries([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('blocked_users')
      .select('blocked_id, created_at, profile:blocked_id(id, username, display_name, avatar_url)')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('Load blocked users failed:', error);
      toast('Could not load blocked users.', 'error');
    } else {
      setEntries((data || []) as unknown as BlockedEntry[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const unblock = async (entry: BlockedEntry) => {
    if (!user) return;
    setBusyId(entry.blocked_id);
    const { error } = await supabase.from('blocked_users')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', entry.blocked_id);
    setBusyId(null);
    if (error) {
      console.warn('Unblock user failed:', error);
      toast('Could not unblock this user.', 'error');
      return;
    }
    setEntries((prev) => prev.filter((item) => item.blocked_id !== entry.blocked_id));
    toast('User unblocked.', 'success');
  };

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0B0F1A] text-black dark:text-white p-4 pb-24">
      <div className="max-w-xl mx-auto">
        <header className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-4 mb-5">
          <button onClick={() => navigate(-1)} className="rounded-xl p-2 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Go back">←</button>
          <div>
            <h1 className="text-xl font-black">Blocked users</h1>
            <p className="text-xs text-gray-500">Only you can manage your block list.</p>
          </div>
        </header>
        {!isConfigured && <p className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">Connect Supabase to manage your saved block list.</p>}
        {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading…</p> :
          entries.length === 0 ? <div className="py-12 text-center text-sm text-gray-500">No blocked users.</div> :
          <div className="space-y-2">
            {entries.map((entry) => {
              const profile = entry.profile;
              return <div key={entry.blocked_id} className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 p-3">
                <Avatar name={profile?.display_name || profile?.username || 'User'} avatarUrl={profile?.avatar_url || null} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{profile?.display_name || 'Unknown user'}</p>
                  <p className="text-xs text-gray-500 truncate">@{profile?.username || 'unknown'}</p>
                </div>
                <button disabled={busyId === entry.blocked_id} onClick={() => void unblock(entry)} className="px-3 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold disabled:opacity-50">
                  {busyId === entry.blocked_id ? 'Please wait…' : 'Unblock'}
                </button>
              </div>;
            })}
          </div>}
      </div>
    </div>
  );
};
