import React, { useState } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { ModerationAppeal } from '../../types';
import { useToast } from '../../components/Toast';

const SEED_APPEALS: ModerationAppeal[] = [
  {
    id: 'app_1',
    user_id: 'usr_sam',
    action_type: 'Account Suspension (Spam flag)',
    reason: 'My account was flagged accidentally while testing automated API triggers. I have resolved the loop.',
    status: 'open',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    user: {
      id: 'usr_sam',
      username: 'sam_systems',
      display_name: 'Sam Miller',
      bio: null,
      avatar_url: null,
      role: 'user',
      status: 'suspended',
      is_online: false,
      last_seen: new Date().toISOString(),
      created_at: '2026-02-14T14:30:00Z',
    },
  },
  {
    id: 'app_2',
    user_id: 'usr_guest_4',
    action_type: 'Message Deletion (Profanity Rule)',
    reason: 'The quoted message was part of a humorous movie reference, not directed at any user.',
    status: 'open',
    created_at: new Date(Date.now() - 3600000 * 22).toISOString(),
    user: {
      id: 'usr_guest_4',
      username: 'cinema_fan',
      display_name: 'Alex D.',
      bio: null,
      avatar_url: null,
      role: 'user',
      status: 'active',
      is_online: true,
      last_seen: new Date().toISOString(),
      created_at: '2026-03-01T12:00:00Z',
    },
  },
];

export const AdminAppealsPage: React.FC = () => {
  const { toast } = useToast();
  const [appeals, setAppeals] = useState<ModerationAppeal[]>(SEED_APPEALS);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [selectedAppeal, setSelectedAppeal] = useState<ModerationAppeal | null>(null);
  const [adminResponse, setAdminResponse] = useState('');

  const handleResolve = (appealId: string, status: 'overturned' | 'upheld') => {
    setAppeals((prev) =>
      prev.map((a) => (a.id === appealId ? { ...a, status, admin_response: adminResponse || undefined } : a))
    );
    setSelectedAppeal(null);
    setAdminResponse('');
    toast(
      status === 'overturned'
        ? 'Appeal overturned: User status restored.'
        : 'Appeal upheld: Decision affirmed.',
      status === 'overturned' ? 'success' : 'info'
    );
  };

  const filtered = appeals.filter((a) => {
    if (filter === 'open') return a.status === 'open';
    if (filter === 'resolved') return a.status !== 'open';
    return true;
  });

  return (
    <AdminSidebar>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#E5E7EB] dark:border-[#2A3348] gap-4">
          <div>
            <h1 className="text-2xl font-black text-black dark:text-white">
              Moderation Appeals Queue
            </h1>
            <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-1">
              Review and act on user appeals regarding account suspensions or message removals (Feature 143).
            </p>
          </div>

          <div className="flex space-x-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
            {(['all', 'open', 'resolved'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                  filter === tab
                    ? 'bg-white dark:bg-[#161B2B] text-black dark:text-white shadow-xs'
                    : 'text-gray-500'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3.5">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              No appeals found in this category.
            </div>
          ) : (
            filtered.map((appeal) => (
              <div
                key={appeal.id}
                className="p-5 rounded-3xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-lg">⚖️</span>
                    <div>
                      <h4 className="font-extrabold text-xs text-black dark:text-white">
                        {appeal.user?.display_name || 'User'} (@{appeal.user?.username})
                      </h4>
                      <p className="text-[10px] text-gray-500 font-semibold">{appeal.action_type}</p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      appeal.status === 'open'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : appeal.status === 'overturned'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {appeal.status}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 text-xs text-gray-700 dark:text-gray-300 italic">
                  "{appeal.reason}"
                </div>

                {appeal.status === 'open' ? (
                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      onClick={() => handleResolve(appeal.id, 'overturned')}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold active:scale-95 transition-transform"
                    >
                      Overturn Decision
                    </button>
                    <button
                      onClick={() => handleResolve(appeal.id, 'upheld')}
                      className="px-4 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50"
                    >
                      Uphold Penalty
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 font-medium">
                    Reviewed & closed • Outcome: {appeal.status.toUpperCase()}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AdminSidebar>
  );
};
