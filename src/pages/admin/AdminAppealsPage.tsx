import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { ModerationAppeal } from '../../types';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isConfigured } from '../../lib/supabaseClient';

export const AdminAppealsPage: React.FC = () => {
  const { toast } = useToast();
  const { user: currentAdmin } = useAuth();
  const [appeals, setAppeals] = useState<ModerationAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [selectedAppeal, setSelectedAppeal] = useState<ModerationAppeal | null>(null);
  const [adminResponse, setAdminResponse] = useState('');

  const loadAppeals = async () => {
    setLoading(true);
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('moderation_appeals')
          .select(`
            id,
            user_id,
            action_type,
            reason,
            status,
            reviewed_by,
            created_at,
            user:profiles!user_id(id, username, display_name, avatar_url, role, status)
          `)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setAppeals(data as any[]);
        }
      } catch (err) {
        console.warn('Load appeals error:', err);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppeals();
  }, []);

  const handleResolve = async (appealId: string, status: 'overturned' | 'upheld') => {
    if (isConfigured && currentAdmin) {
      try {
        await supabase
          .from('moderation_appeals')
          .update({
            status,
            reviewed_by: currentAdmin.id,
          })
          .eq('id', appealId);

        // If overturned and appeal was for user suspension, unsuspend the user
        if (status === 'overturned' && selectedAppeal?.user_id) {
          await supabase
            .from('profiles')
            .update({ status: 'active' })
            .eq('id', selectedAppeal.user_id);
        }
      } catch (err) {
        console.warn('Failed to resolve appeal:', err);
      }
    }

    setAppeals((prev) =>
      prev.map((a) => (a.id === appealId ? { ...a, status, admin_response: adminResponse || undefined } : a))
    );
    setSelectedAppeal(null);
    setAdminResponse('');
    toast(
      status === 'overturned'
        ? 'Appeal overturned: User account status restored.'
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

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-xs space-y-2">
            <div className="text-3xl">⚖️</div>
            <p className="font-bold text-black dark:text-white">No appeals in this view</p>
            <p>User appeals submitted via the moderation appeals workflow will be listed here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((appeal) => (
              <div
                key={appeal.id}
                className="p-5 rounded-3xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                      {appeal.action_type}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        appeal.status === 'open'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          : appeal.status === 'overturned'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}
                    >
                      {appeal.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-sm text-black dark:text-white">
                      User: {appeal.user?.display_name || 'User'} (@{appeal.user?.username || 'user'})
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 italic">
                      "{appeal.reason}"
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-gray-400">
                    {new Date(appeal.created_at).toLocaleDateString()}
                  </span>
                  {appeal.status === 'open' && (
                    <button
                      onClick={() => setSelectedAppeal(appeal)}
                      className="px-3 py-1 rounded-xl bg-[#0E2A6E] text-white font-bold hover:bg-[#081B47]"
                    >
                      Review Appeal
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {selectedAppeal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#161B2B] rounded-3xl max-w-md w-full p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl space-y-4">
              <h3 className="font-black text-base text-black dark:text-white">
                Resolve Appeal: @{selectedAppeal.user?.username}
              </h3>
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl text-xs space-y-1">
                <span className="font-bold block text-gray-400">User Reason:</span>
                <p className="italic">{selectedAppeal.reason}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Optional Admin Note:
                </label>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Explanation of decision..."
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold focus:outline-hidden"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  onClick={() => setSelectedAppeal(null)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleResolve(selectedAppeal.id, 'upheld')}
                  className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700"
                >
                  Uphold Action
                </button>
                <button
                  onClick={() => handleResolve(selectedAppeal.id, 'overturned')}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                >
                  Overturn & Restore
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminSidebar>
  );
};
