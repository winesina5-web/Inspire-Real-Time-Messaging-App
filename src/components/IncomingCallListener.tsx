import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import { Avatar } from './Avatar';
import { CallModal } from './CallModal';
import { Profile } from '../types';
import { supabase, isConfigured } from '../lib/supabaseClient';

interface IncomingCall {
  id: string;
  caller_id: string;
  callee_id: string;
  type: 'voice' | 'video';
  status: string;
  caller: Profile;
}

export const IncomingCallListener: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [active, setActive] = useState<IncomingCall | null>(null);
  const [busy, setBusy] = useState(false);

  const loadIncoming = useCallback(async (row: any) => {
    if (!user || !row?.id || row.callee_id !== user.id || row.status !== 'ringing') return;
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', row.caller_id).maybeSingle();
    if (error || !profile) return;
    setIncoming({ ...row, caller: profile as Profile, type: row.type === 'video' ? 'video' : 'voice' });
  }, [user?.id]);

  useEffect(() => {
    if (!user || !isConfigured) return;
    let mounted = true;
    const init = async () => {
      const { data } = await supabase.from('calls').select('*').eq('callee_id', user.id).eq('status', 'ringing').order('started_at', { ascending: false }).limit(1);
      if (mounted && data?.[0]) await loadIncoming(data[0]);
    };
    void init();
    const channel = supabase.channel(`incoming_calls_${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${user.id}` }, (payload) => { void loadIncoming(payload.new); })
      .subscribe();
    return () => { mounted = false; void supabase.removeChannel(channel); };
  }, [user?.id, loadIncoming]);

  const reject = async () => {
    if (!incoming || !user) return;
    setBusy(true);
    await supabase.from('call_signals').insert({
      call_id: incoming.id, sender_id: user.id, receiver_id: incoming.caller_id, event_type: 'reject', payload: {},
    });
    await supabase.from('calls').update({ status: 'declined', ended_at: new Date().toISOString(), duration_seconds: 0 }).eq('id', incoming.id);
    setIncoming(null);
    setBusy(false);
  };

  const accept = async () => {
    if (!incoming) return;
    setBusy(true);
    const { error } = await supabase.from('calls').update({ status: 'answered' }).eq('id', incoming.id);
    setBusy(false);
    if (error) {
      toast('Could not answer the call. Please try again.', 'error');
      return;
    }
    setActive(incoming);
    setIncoming(null);
  };

  const finish = async (duration: number) => {
    if (active) {
      await supabase.from('calls').update({
        status: duration > 0 ? 'answered' : 'missed',
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
      }).eq('id', active.id);
    }
    setActive(null);
  };

  if (active) return <CallModal callId={active.id} partner={active.caller} type={active.type} isCaller={false} onEndCall={(duration) => void finish(duration)} />;

  if (!incoming) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#161B2B] text-black dark:text-white border border-gray-200 dark:border-gray-800 p-6 text-center shadow-2xl">
        <Avatar name={incoming.caller.display_name || incoming.caller.username} avatarUrl={incoming.caller.avatar_url} size="xl" />
        <h2 className="mt-3 font-black text-lg">{incoming.caller.display_name || incoming.caller.username}</h2>
        <p className="text-sm text-gray-500 mt-1">Incoming {incoming.type} call</p>
        <div className="flex gap-3 mt-6">
          <button disabled={busy} onClick={() => void reject()} className="flex-1 rounded-xl bg-rose-600 text-white py-3 font-bold disabled:opacity-50">Decline</button>
          <button disabled={busy} onClick={() => void accept()} className="flex-1 rounded-xl bg-emerald-600 text-white py-3 font-bold disabled:opacity-50">{busy ? 'Please wait…' : 'Answer'}</button>
        </div>
      </div>
    </div>
  );
};
