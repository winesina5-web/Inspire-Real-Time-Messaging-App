import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { ScheduledBroadcast } from '../../types';
import { supabase, isConfigured } from '../../lib/supabaseClient';

export const AdminScheduledBroadcastsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'active_7d'>('all');
  const [scheduledFor, setScheduledFor] = useState('');
  const [dismissible, setDismissible] = useState(true);
  const [broadcasts, setBroadcasts] = useState<ScheduledBroadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const loadScheduled = async () => {
    setLoading(true);
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('scheduled_broadcasts')
          .select('*')
          .order('scheduled_for', { ascending: false });

        if (!error && data) {
          setBroadcasts(
            data.map((b: any) => ({
              id: b.id,
              title: b.title,
              body: b.body,
              audience: b.audience,
              dismissible: b.dismissible,
              sent_by: b.created_by,
              created_at: b.created_at,
              scheduled_for: b.scheduled_for,
              sent: b.sent,
            }))
          );
        }
      } catch (err) {
        console.warn('Load scheduled broadcasts error:', err);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScheduled();
  }, []);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !scheduledFor || !user) {
      toast('Please complete all required broadcast fields', 'error');
      return;
    }

    const payload = {
      title: title.trim(),
      body: body.trim(),
      audience,
      dismissible,
      scheduled_for: new Date(scheduledFor).toISOString(),
      created_by: user.id,
      sent: false,
    };

    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('scheduled_broadcasts')
          .insert(payload)
          .select()
          .single();

        if (error) {
          toast(error.message, 'error');
          return;
        }

        if (data) {
          setBroadcasts((prev) => [
            {
              id: data.id,
              title: data.title,
              body: data.body,
              audience: data.audience,
              dismissible: data.dismissible,
              sent_by: data.created_by,
              created_at: data.created_at,
              scheduled_for: data.scheduled_for,
              sent: data.sent,
            },
            ...prev,
          ]);
        }
      } catch (err: any) {
        toast(err.message, 'error');
      }
    } else {
      const localB: ScheduledBroadcast = {
        id: `sbroad_${Date.now()}`,
        title: title.trim(),
        body: body.trim(),
        audience,
        dismissible,
        sent_by: user.id,
        created_at: new Date().toISOString(),
        scheduled_for: new Date(scheduledFor).toISOString(),
        sent: false,
      };
      setBroadcasts((prev) => [localB, ...prev]);
    }

    setTitle('');
    setBody('');
    setScheduledFor('');
    toast('Broadcast scheduled successfully!', 'success');
  };

  const handleSendNow = async (id: string) => {
    if (isConfigured) {
      try {
        await supabase
          .from('scheduled_broadcasts')
          .update({ sent: true })
          .eq('id', id);

        // Insert into live broadcasts
        const target = broadcasts.find((b) => b.id === id);
        if (target && user) {
          await supabase.from('broadcasts').insert({
            title: target.title,
            body: target.body,
            audience: target.audience,
            dismissible: target.dismissible,
            sent_by: user.id,
          });
        }
      } catch (err) {
        console.warn('Send now error:', err);
      }
    }

    setBroadcasts((prev) =>
      prev.map((b) => (b.id === id ? { ...b, sent: true } : b))
    );
    toast('Broadcast dispatched immediately to active audience!', 'success');
  };

  const handleCancel = async (id: string) => {
    if (isConfigured) {
      try {
        await supabase.from('scheduled_broadcasts').delete().eq('id', id);
      } catch (err) {
        console.warn('Cancel broadcast error:', err);
      }
    }
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
          <p className="text-xs text-gray-500">
            Set future broadcast deliveries for planned maintenance, events, and releases.
          </p>
        </div>

        {/* Schedule Form */}
        <div className="bg-white dark:bg-[#161B2B] p-5 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Schedule New Broadcast
          </h2>

          <form onSubmit={handleSchedule} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                Headline / Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Inspire v2.0 Platform Release"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-semibold focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                Announcement Message
              </label>
              <textarea
                required
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Detailed message..."
                className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-semibold focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Deliver At (Date & Time)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Target Audience
                </label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                >
                  <option value="all">All Users</option>
                  <option value="active_7d">Active Last 7 Days</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
              >
                Schedule Broadcast 📅
              </button>
            </div>
          </form>
        </div>

        {/* Scheduled List */}
        <div className="bg-white dark:bg-[#161B2B] p-5 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Pending Deliveries
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-3 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : broadcasts.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No scheduled broadcasts.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {broadcasts.map((b) => (
                <div key={b.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        b.sent ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {b.sent ? 'Dispatched' : 'Scheduled'}
                      </span>
                      <h4 className="font-bold text-xs text-black dark:text-white">{b.title}</h4>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{b.body}</p>
                    <div className="text-[10px] text-gray-400 mt-1">
                      Deliver at: {new Date(b.scheduled_for).toLocaleString()}
                    </div>
                  </div>

                  {!b.sent && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleSendNow(b.id)}
                        className="px-3 py-1 rounded-lg bg-[#0E2A6E] text-white text-[11px] font-bold"
                      >
                        Send Now
                      </button>
                      <button
                        onClick={() => handleCancel(b.id)}
                        className="px-3 py-1 rounded-lg bg-red-100 text-red-600 text-[11px] font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminSidebar>
  );
};
