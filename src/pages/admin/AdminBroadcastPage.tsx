import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { Broadcast } from '../../types';
import { supabase, isConfigured } from '../../lib/supabaseClient';

const SEED_BROADCASTS: Broadcast[] = [
  {
    id: 'bc_1',
    title: 'Welcome to Inspire Messenger v1.0',
    body: 'We are thrilled to launch the real-time messaging experience with audio notes and instant delivery.',
    audience: 'all',
    dismissible: true,
    sent_by: '99999999-9999-4999-8999-999999999999',
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    id: 'bc_2',
    title: 'Scheduled Cloudflare Performance Maintenance',
    body: 'Brief 2-minute connection refresh at 02:00 UTC. Your chats remain safely persisted.',
    audience: 'all',
    dismissible: false,
    sent_by: '99999999-9999-4999-8999-999999999999',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
];

export const AdminBroadcastPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(SEED_BROADCASTS);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'active_7d'>('all');
  const [dismissible, setDismissible] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isConfigured) return;

    const fetchBroadcasts = async () => {
      try {
        const { data } = await supabase
          .from('broadcasts')
          .select('*')
          .order('created_at', { ascending: false });

        if (data) setBroadcasts(data as Broadcast[]);
      } catch (err) {
        console.warn('Fetch broadcasts error:', err);
      }
    };

    fetchBroadcasts();
  }, []);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !user) return;

    setIsSending(true);
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

    if (isConfigured) {
      try {
        await supabase.from('broadcasts').insert({
          title: title.trim(),
          body: body.trim(),
          audience,
          dismissible,
          sent_by: user.id,
        });
      } catch (err: unknown) {
        console.warn('Broadcast send error:', err);
      }
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
            Broadcast Announcements
          </h1>
          <p className="text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
            Send real-time alerts or banner notices to all active Inspire users
          </p>
        </div>

        {/* Compose Form */}
        <form
          onSubmit={handleSendBroadcast}
          className="bg-white dark:bg-[#161B2B] p-6 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4"
        >
          <h3 className="font-extrabold text-sm text-black dark:text-white">
            Compose New Broadcast
          </h3>

          <div>
            <label className="block text-xs font-bold uppercase text-black dark:text-gray-200 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Platform Update: Voice Notes Now Available"
              required
              className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white focus:outline-none focus:border-[#0E2A6E]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-black dark:text-gray-200 mb-1">
              Message Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter details of announcement…"
              rows={3}
              required
              className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white focus:outline-none focus:border-[#0E2A6E]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-black dark:text-gray-200 mb-1">
                Audience Filter
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as 'all' | 'active_7d')}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white"
              >
                <option value="all">All Registered Users</option>
                <option value="active_7d">Users Active in Last 7 Days</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-black dark:text-gray-200 mb-1">
                Dismissibility
              </label>
              <div className="flex items-center space-x-3 mt-2">
                <label className="flex items-center space-x-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    checked={dismissible}
                    onChange={() => setDismissible(true)}
                  />
                  <span>Dismissible by user</span>
                </label>
                <label className="flex items-center space-x-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    checked={!dismissible}
                    onChange={() => setDismissible(false)}
                  />
                  <span>Persistent banner</span>
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSending}
            className="py-3 px-5 rounded-2xl bg-[#0E2A6E] text-white font-extrabold text-xs hover:bg-[#081B47] active:scale-95 transition-all shadow-md disabled:opacity-50"
          >
            {isSending ? 'Broadcasting…' : 'Publish Broadcast'}
          </button>
        </form>

        {/* Broadcast History */}
        <div className="bg-white dark:bg-[#161B2B] p-6 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
          <h3 className="font-extrabold text-sm text-black dark:text-white mb-4">
            Past Announcements
          </h3>
          <div className="space-y-3">
            {broadcasts.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-black dark:text-white">{b.title}</h4>
                  <span className="text-[10px] text-gray-400">
                    {new Date(b.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
                  {b.body}
                </p>
                <div className="flex items-center space-x-2 pt-1 text-[10px] font-semibold text-gray-500">
                  <span className="px-2 py-0.5 rounded-md bg-gray-200 dark:bg-gray-700">
                    Audience: {b.audience}
                  </span>
                  <span>{b.dismissible ? 'Dismissible' : 'Persistent'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
};
