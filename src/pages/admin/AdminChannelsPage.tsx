import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { supabase, isConfigured } from '../../lib/supabaseClient';

interface ChannelRow {
  id: string;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  created_at?: string | null;
  is_public?: boolean | null;
}

export const AdminChannelsPage: React.FC = () => {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isConfigured) {
        setErrorMessage('Connect Supabase to view live channels.');
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from('channels').select('*').order('created_at', { ascending: false }).limit(500);
      if (!active) return;
      if (error) {
        setErrorMessage('Could not load channels. Check the channels table permissions and RLS policies.');
        console.warn('Admin channels load failed:', error);
      } else {
        setChannels((data || []) as ChannelRow[]);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  return (
    <AdminSidebar>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-black text-black dark:text-white">Channels</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Review public and private channels in Inspire.</p>
        </div>
        {errorMessage && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">{errorMessage}</div>}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161B2B]">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-[#0B0F1A] text-xs uppercase text-gray-500">
              <tr><th className="px-4 py-3">Channel</th><th className="px-4 py-3">Visibility</th><th className="px-4 py-3">Created</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">Loading channels…</td></tr>
              ) : channels.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No channels found.</td></tr>
              ) : channels.map((channel) => (
                <tr key={channel.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3"><div className="font-bold">{channel.name || channel.title || 'Untitled channel'}</div><div className="text-xs text-gray-500">{channel.description || channel.id}</div></td>
                  <td className="px-4 py-3">{channel.is_public === false ? 'Private' : 'Public / default'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{channel.created_at ? new Date(channel.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminSidebar>
  );
};
