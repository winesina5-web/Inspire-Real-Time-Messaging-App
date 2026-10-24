import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { ScheduledBroadcast } from '../../types';

export const AdminScheduledBroadcastsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'active_7d'>('all');
  const [scheduledFor, setScheduledFor] = useState('');
  const [dismissible, setDismissible] = useState(true);

  const [broadcasts, setBroadcasts] = useState<ScheduledBroadcast[]>(() => {
    const saved = localStorage.getItem('inspire_scheduled_broadcasts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    const defaultDate = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16);
    return [
      {
        id: 'sbroad_001',
        title: 'Inspire v2.4 Platform Release & Group Calls Update',
        body: 'We are rolling out low-latency group calling and interactive polls across all clients.',
        audience: 'all',
        dismissible: true,
        sent_by: user?.id || 'admin',
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        scheduled_for: defaultDate,
        sent: false,
      },
      {
        id: 'sbroad_000',
        title: 'Weekly Maintenance Completed',
        body: 'Database indices and media caching nodes have been optimized successfully.',
        audience: 'all',
        dismissible: true,
        sent_by: user?.id || 'admin',
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        scheduled_for: new Date(Date.now() - 86400000 * 4).toISOString(),
        sent: true,
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem('inspire_scheduled_broadcasts', JSON.stringify(broadcasts));
  }, [broadcasts]);

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !scheduledFor) {
      toast('Please complete all required broadcast fields', 'error');
      return;
    }

    const newBroadcast: ScheduledBroadcast = {
      id: `sbroad_${Date.now()}`,
      title: title.trim(),
      body: body.trim(),
      audience,
      dismissible,
      sent_by: user?.id || 'admin',
      created_at: new Date().toISOString(),
      scheduled_for: new Date(scheduledFor).toISOString(),
      sent: false,
    };

    setBroadcasts([newBroadcast, ...broadcasts]);
    setTitle('');
    setBody('');
    setScheduledFor('');
    toast('Broadcast scheduled successfully!', 'success');
  };

  const handleSendNow = (id: string) => {
    setBroadcasts((prev) =>
      prev.map((b) => (b.id === id ? { ...b, sent: true } : b))
    );
    toast('Broadcast dispatched immediately to active audience!', 'success');
  };

  const handleCancel = (id: string) => {
    setBroadcasts((prev) => prev.filter((b) => b.id !== id));
    toast('Scheduled broadcast cancelled and removed', 'info');
  };

  return (
    <AdminSidebar>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-black text-black dark:text-white">
            Scheduled System Broadcasts
          </h1>
          <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-1">
            Compose and schedule platform-wide banner announcements and system updates ahead of time.
          </p>
        </div>

        {/* Schedule Composer Card */}
        <div className="bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
          <h2 className="font-extrabold text-sm mb-4">Schedule New Broadcast</h2>

          <form onSubmit={handleSchedule} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                  Announcement Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Scheduled Network Maintenance"
                  required
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium focus:outline-none focus:border-[#0E2A6E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                  Scheduled Delivery Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium focus:outline-none focus:border-[#0E2A6E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                Broadcast Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Details of the announcement that all users will receive in their chat banners..."
                rows={3}
                required
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium focus:outline-none focus:border-[#0E2A6E]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="flex items-center space-x-6">
                <div>
                  <label className="text-xs font-bold mr-2 text-gray-500">Audience:</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value as 'all' | 'active_7d')}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348]"
                  >
                    <option value="all">All Registered Users</option>
                    <option value="active_7d">Active Last 7 Days Only</option>
                  </select>
                </div>

                <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dismissible}
                    onChange={(e) => setDismissible(e.target.checked)}
                    className="rounded accent-[#0E2A6E]"
                  />
                  <span>Allow users to dismiss banner</span>
                </label>
              </div>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47] transition-all shadow-sm"
              >
                Schedule Broadcast 📅
              </button>
            </div>
          </form>
        </div>

        {/* Broadcasts Queue List */}
        <div className="bg-white dark:bg-[#161B2B] rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E5E7EB] dark:border-[#2A3348]">
            <h2 className="font-extrabold text-sm">Broadcast Queue & History ({broadcasts.length})</h2>
          </div>

          <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A3348]">
            {broadcasts.map((b) => (
              <div key={b.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-xs text-black dark:text-white">
                      {b.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        b.sent
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      {b.sent ? 'Delivered' : 'Scheduled'}
                    </span>
                  </div>
                  <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] line-clamp-1">
                    {b.body}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Audience: <strong className="uppercase">{b.audience}</strong> • Target time:{' '}
                    {new Date(b.scheduled_for).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {!b.sent && (
                    <>
                      <button
                        onClick={() => handleSendNow(b.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#0E2A6E] text-white text-[11px] font-bold hover:bg-[#081B47]"
                      >
                        Send Now
                      </button>
                      <button
                        onClick={() => handleCancel(b.id)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold hover:bg-rose-100"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {b.sent && (
                    <span className="text-xs text-emerald-600 font-bold">
                      ✓ Broadcast Complete
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
};
