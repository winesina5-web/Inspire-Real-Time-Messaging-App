import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Avatar } from '../../components/Avatar';
import { useToast } from '../../components/Toast';
import { Profile } from '../../types';
import { supabase, isConfigured } from '../../lib/supabaseClient';
import { DEMO_PROFILES } from '../../hooks/useAuth';

export const AdminUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<Profile[]>([
    DEMO_PROFILES.user,
    DEMO_PROFILES.admin,
    {
      id: 'usr_jordan',
      username: 'jordan_ai',
      display_name: 'Jordan Lee',
      bio: 'AI researcher',
      avatar_url: null,
      role: 'user',
      status: 'active',
      is_online: true,
      last_seen: new Date().toISOString(),
      created_at: '2026-01-15T09:00:00Z',
    },
    {
      id: 'usr_bad_actor',
      username: 'spammer_99',
      display_name: 'Bad Actor',
      bio: 'Spamming affiliate links',
      avatar_url: null,
      role: 'user',
      status: 'suspended',
      is_online: false,
      last_seen: '2026-10-18T10:00:00Z',
      created_at: '2026-10-15T08:00:00Z',
    },
  ]);

  const [search, setSearch] = useState('');
  const [targetUser, setTargetUser] = useState<Profile | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'unsuspend' | 'promote' | 'demote' | null>(null);

  useEffect(() => {
    if (!isConfigured) return;

    const fetchUsers = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (data) {
          setUsers(data as Profile[]);
        }
      } catch (err) {
        console.warn('Fetch users error:', err);
      }
    };

    fetchUsers();
  }, []);

  const handleConfirmAction = async () => {
    if (!targetUser || !actionType) return;

    const updates: Partial<Profile> = {};
    if (actionType === 'suspend') updates.status = 'suspended';
    if (actionType === 'unsuspend') updates.status = 'active';
    if (actionType === 'promote') updates.role = 'admin';
    if (actionType === 'demote') updates.role = 'user';

    setUsers((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u))
    );

    if (isConfigured) {
      try {
        await supabase
          .from('profiles')
          .update(updates)
          .eq('id', targetUser.id);
      } catch (err: unknown) {
        console.warn('Update user error:', err);
      }
    }

    toast(`Action completed for @${targetUser.username}`, 'success');
    setTargetUser(null);
    setActionType(null);
  };

  const filtered = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.display_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminSidebar>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">
              User Directory
            </h1>
            <p className="text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
              Inspect user status, promote administrators, and manage suspensions
            </p>
          </div>
          <div className="w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or @username…"
              className="w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium focus:outline-none focus:border-[#0E2A6E]"
            />
          </div>
        </div>

        {/* User Table with sticky Dark Royal Blue header */}
        <div className="bg-white dark:bg-[#161B2B] rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#0E2A6E] text-white">
                  <th className="py-3.5 px-4 font-black">User</th>
                  <th className="py-3.5 px-4 font-black">Username</th>
                  <th className="py-3.5 px-4 font-black">Role</th>
                  <th className="py-3.5 px-4 font-black">Status</th>
                  <th className="py-3.5 px-4 font-black">Joined</th>
                  <th className="py-3.5 px-4 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#2A3348]">
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <Avatar
                          name={u.display_name}
                          avatarUrl={u.avatar_url}
                          size="sm"
                          showOnlineStatus={true}
                          isOnline={u.is_online}
                        />
                        <div>
                          <span className="font-extrabold text-black dark:text-white block">
                            {u.display_name}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono truncate max-w-[120px] block">
                            {u.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-[#0E2A6E] dark:text-[#3D6FE0]">
                      <div className="flex items-center space-x-1">
                        <span>@{u.username || 'unclaimed'}</span>
                        {u.verified && (
                          <span
                            className="w-3.5 h-3.5 rounded-full bg-[#0E2A6E] dark:bg-[#3D6FE0] text-[#FFD700] inline-flex items-center justify-center text-[9px] font-black"
                            title="Verified Account"
                          >
                            ✓
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          u.role === 'admin'
                            ? 'bg-[#FFD700] text-[#1A1A2E]'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          u.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-[#4B5563] dark:text-[#9CA3AF]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {/* Feature 134: Admin User Impersonation */}
                      <button
                        onClick={() => {
                          localStorage.setItem(
                            'inspire_impersonation',
                            JSON.stringify({
                              id: u.id,
                              username: u.username,
                              display_name: u.display_name,
                            })
                          );
                          toast(`Impersonating @${u.username} (Read-Only)`, 'info');
                          navigate('/chats');
                        }}
                        className="px-2 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 text-[11px] font-bold"
                        title="View client interface as this user in read-only mode"
                      >
                        👁 Impersonate
                      </button>

                      {/* Feature 116: Verified Badge Toggle */}
                      <button
                        onClick={async () => {
                          const updated = !u.verified;
                          setUsers((prev) =>
                            prev.map((item) => (item.id === u.id ? { ...item, verified: updated } : item))
                          );
                          if (isConfigured) {
                            try {
                              await supabase.from('profiles').update({ verified: updated }).eq('id', u.id);
                            } catch {
                              // ignore
                            }
                          }
                          toast(
                            updated ? `Verified badge granted to @${u.username}` : `Verified badge revoked`,
                            'success'
                          );
                        }}
                        className="px-2 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#0E2A6E] dark:text-[#3D6FE0] hover:bg-blue-100 text-[11px] font-bold"
                        title="Toggle verified badge"
                      >
                        {u.verified ? 'Revoke ✓' : 'Verify ✓'}
                      </button>

                      <button
                        onClick={() => navigate(`/admin/chats/${u.id}`)}
                        className="px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-[11px] font-bold text-black dark:text-white"
                        title="Audit chat transcripts"
                      >
                        Inspect
                      </button>

                      {u.role === 'admin' ? (
                        <button
                          onClick={() => {
                            setTargetUser(u);
                            setActionType('demote');
                          }}
                          className="px-2.5 py-1 rounded-xl bg-yellow-100 hover:bg-yellow-200 text-yellow-900 text-[11px] font-bold"
                        >
                          Demote
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setTargetUser(u);
                            setActionType('promote');
                          }}
                          className="px-2.5 py-1 rounded-xl bg-[#0E2A6E] hover:bg-[#081B47] text-white text-[11px] font-bold"
                        >
                          Make Admin
                        </button>
                      )}

                      {u.status === 'active' ? (
                        <button
                          onClick={() => {
                            setTargetUser(u);
                            setActionType('suspend');
                          }}
                          className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 text-[11px] font-bold"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setTargetUser(u);
                            setActionType('unsuspend');
                          }}
                          className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] font-bold"
                        >
                          Unsuspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Confirmation Modal */}
        {targetUser && actionType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
              <h3 className="font-extrabold text-base text-black dark:text-white mb-2">
                Confirm {actionType.toUpperCase()}
              </h3>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed mb-6">
                Are you sure you want to {actionType} user{' '}
                <strong className="text-black dark:text-white">@{targetUser.username}</strong>?
                {actionType === 'suspend' && ' This will immediately prevent them from logging in or sending messages.'}
                {actionType === 'promote' && ' This will grant them full administrative control.'}
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setTargetUser(null);
                    setActionType(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold shadow-md ${
                    actionType === 'suspend' || actionType === 'demote'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-[#0E2A6E] hover:bg-[#081B47]'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminSidebar>
  );
};
