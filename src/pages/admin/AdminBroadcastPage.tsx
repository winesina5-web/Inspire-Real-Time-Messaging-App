import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { Broadcast } from '../../types';
import { supabase, isConfigured } from '../../lib/supabaseClient';

export const AdminBroadcastPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'active_7d'>('all');
  const [dismissible, setDismissible] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const fetchBroadcasts = async () => {
      setLoading(true);
      if (isConfigured) {
        try {
          const { data } = await supabase
            .from('broadcasts')
            .select('*')
            .order('created_at', { ascending: false });

          if (data) setBroadcasts(data as Broadcast[]);
        } catch (err) {
          console.warn('Fetch broadcasts error:', err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchBroadcasts();
  }, []);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !user) return;

    setIsSending(true);

    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('broadcasts')
          .insert({
            title: title.trim(),
            body: body.trim(),
            audience,
            dismissible,
            sent_by: user.id,
          })
          .select()
          .single();

        if (error) {
          toast(error.message, 'error');
          setIsSending(false);
          return;
        }

        if (data) {
          setBroadcasts((prev) => [data as Broadcast, ...prev]);
        }
      } catch (err: any) {
        console.warn('Broadcast send error:', err);
      }
    } else {
      const newBroadcast: Broadcast = {
        id: `bc_${Date.now()}`,
        title: title.trim(),
        body: body.trim(),
        audience,
        dismissible,
        sent_by: user.id,
        created_at: new Date().toISOString(),
      };
      setBroadcasts((prev) => [newBroadcast, ...prev]);
    }

    setIsSending(false);
    setTitle('');
    setBody('');
    toast('System announcement broadcasted to target audience!', 'success');
  };

  return (
    <AdminSidebar>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">
            System Broadcasts
          </h1>
          <p className="text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
            Deliver official platform announcements to all active users
          </p>
        </div>

        {/* Compose Form Card */}
        <div className="bg-white dark:bg-[#161B2B] p-6 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <h2 className="text-sm font-black text-black dark:text-white">
            Compose Announcement
          </h2>

          <form onSubmit={handleSendBroadcast} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#4B5563] dark:text-[#9CA3AF] block mb-1">
                Headline / Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Scheduled Platform Maintenance Notice"
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold focus:outline-hidden focus:border-[#0E2A6E]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#4B5563] dark:text-[#9CA3AF] block mb-1">
                Announcement Message
              </label>
              <textarea
                required
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write the full message details..."
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold focus:outline-hidden focus:border-[#0E2A6E]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#4B5563] dark:text-[#9CA3AF] block mb-1">
                  Target Audience
                </label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold"
                >
                  <option value="all">All Registered Users</option>
                  <option value="active_7d">Users Active in Last 7 Days</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="dismissible"
                  checked={dismissible}
                  onChange={(e) => setDismissible(e.target.checked)}
                  className="w-4 h-4 accent-[#0E2A6E]"
                />
                <label htmlFor="dismissible" className="text-xs font-bold text-[#4B5563] dark:text-[#9CA3AF]">
                  Allow users to dismiss banner
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSending || !title.trim() || !body.trim()}
                className="px-6 py-2.5 rounded-full bg-[#0E2A6E] text-white text-xs font-bold shadow-md hover:bg-[#081B47] active:scale-95 disabled:opacity-50"
              >
                {isSending ? 'Sending Announcement…' : 'Send Broadcast Now 📢'}
              </button>
            </div>
          </form>
        </div>

        {/* History of Past Broadcasts */}
        <div className="bg-white dark:bg-[#161B2B] p-6 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <h2 className="text-sm font-black text-black dark:text-white">
            Broadcast History
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-3 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : broadcasts.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">No broadcasts published yet.</p>
          ) : (
            <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A3348]">
              {broadcasts.map((bc) => (
                <div key={bc.id} className="py-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-black dark:text-white">{bc.title}</h3>
                    <span className="text-[10px] text-gray-400">
                      {new Date(bc.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{bc.body}</p>
                  <div className="flex items-center space-x-3 text-[10px] text-gray-400 pt-1 font-semibold">
                    <span>Audience: {bc.audience === 'all' ? 'All Users' : 'Active (7d)'}</span>
                    <span>•</span>
                    <span>{bc.dismissible ? 'Dismissible Banner' : 'Permanent Sticky'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminSidebar>
  );
};
