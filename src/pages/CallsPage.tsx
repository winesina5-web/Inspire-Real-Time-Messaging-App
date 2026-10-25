import React, { useState, useEffect, useMemo } from 'react';
import { Search, Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { Avatar } from '../components/Avatar';
import { CallModal } from '../components/CallModal';
import { useToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import { CallRecord, Profile } from '../types';
import { formatDuration } from '../utils/helpers';
import { supabase, isConfigured } from '../lib/supabaseClient';

export const CallsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'missed' | 'outgoing' | 'incoming'>('all');
  const [activeCall, setActiveCall] = useState<{ partner: Profile; type: 'voice' | 'video'; callId: string } | null>(null);

  // Load real call history from Supabase calls table
  useEffect(() => {
    if (!user) return;

    const loadCallsAndContacts = async () => {
      setLoading(true);
      if (isConfigured) {
        try {
          // Fetch calls
          const { data: callRows, error: callErr } = await supabase
            .from('calls')
            .select(`
              id,
              caller_id,
              callee_id,
              type,
              status,
              started_at,
              duration_seconds,
              caller:profiles!caller_id(id, username, display_name, avatar_url),
              callee:profiles!callee_id(id, username, display_name, avatar_url)
            `)
            .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
            .order('started_at', { ascending: false });

          if (callErr) {
            console.warn('Error loading calls:', callErr.message);
          } else if (callRows) {
            const formatted: CallRecord[] = callRows.map((c: any) => {
              const isCaller = c.caller_id === user.id;
              const partnerProfile = isCaller ? c.callee : c.caller;
              return {
                id: c.id,
                caller_id: c.caller_id,
                callee_id: c.callee_id,
                type: c.type,
                status: c.status,
                started_at: c.started_at,
                duration_seconds: c.duration_seconds || 0,
                partner: partnerProfile || {
                  id: isCaller ? c.callee_id : c.caller_id,
                  username: 'user',
                  display_name: 'Contact',
                  bio: null,
                  avatar_url: null,
                  role: 'user',
                  status: 'active',
                  is_online: false,
                  last_seen: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                },
              };
            });
            setCalls(formatted);
          }

          // Fetch contacts for New Call picker
          const { data: contactRows } = await supabase
            .from('contacts')
            .select('contact:profiles!contact_id(*)')
            .eq('user_id', user.id);

          if (contactRows) {
            setContacts(contactRows.map((cr: any) => cr.contact).filter(Boolean));
          }
        } catch (err) {
          console.warn('Calls fetch exception:', err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadCallsAndContacts();
  }, [user]);

  const visibleCalls = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return calls.filter((call) => {
      const isOutgoing = call.caller_id === user?.id;
      const matchesFilter = historyFilter === 'all'
        || (historyFilter === 'missed' && call.status === 'missed')
        || (historyFilter === 'outgoing' && isOutgoing)
        || (historyFilter === 'incoming' && !isOutgoing);
      const matchesSearch = !query || [
        call.partner?.display_name || '',
        call.partner?.username || '',
        call.type,
        call.status,
      ].some((value) => value.toLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
  }, [calls, historyFilter, searchTerm, user?.id]);

  // Keep call history live when either participant starts, answers or ends a call.
  useEffect(() => {
    if (!user || !isConfigured) return;
    const applyCallChange = async (payload: any) => {
      if (payload.eventType === 'DELETE') {
        setCalls((previous) => previous.filter((call) => call.id !== payload.old.id));
        return;
      }
      const rowId = payload.new?.id;
      if (!rowId) return;
      const { data: c, error } = await supabase.from('calls').select(`
        id, caller_id, callee_id, type, status, started_at, duration_seconds,
        caller:profiles!caller_id(id, username, display_name, avatar_url),
        callee:profiles!callee_id(id, username, display_name, avatar_url)
      `).eq('id', rowId).maybeSingle();
      if (error || !c) return;
      const isCaller = c.caller_id === user.id;
      const relatedProfile = isCaller ? c.callee : c.caller;
      const partnerProfile = (Array.isArray(relatedProfile) ? relatedProfile[0] : relatedProfile) as Profile | null;
      const record: CallRecord = {
        id: c.id, caller_id: c.caller_id, callee_id: c.callee_id,
        type: c.type, status: c.status, started_at: c.started_at,
        duration_seconds: c.duration_seconds || 0,
        partner: partnerProfile || {
          id: isCaller ? c.callee_id : c.caller_id, username: 'user',
          display_name: 'Contact', bio: null, avatar_url: null, role: 'user',
          status: 'active', is_online: false, last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      };
      setCalls((previous) => [record, ...previous.filter((call) => call.id !== record.id)]
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()));
    };
    const channel = supabase.channel(`call_history_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls', filter: `caller_id=eq.${user.id}` }, (payload) => { void applyCallChange(payload); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls', filter: `callee_id=eq.${user.id}` }, (payload) => { void applyCallChange(payload); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleStartCall = async (partner: Profile, type: 'voice' | 'video') => {
    setShowContactPicker(false);
    if (!user || !isConfigured) {
      toast('Calls require a configured Supabase account.', 'error');
      return;
    }
    const { data, error } = await supabase.from('calls').insert({
      caller_id: user.id,
      callee_id: partner.id,
      type,
      status: 'ringing',
      started_at: new Date().toISOString(),
    }).select('*').single();
    if (error || !data) {
      console.warn('Could not start call:', error);
      toast(error?.message || 'Could not start call.', 'error');
      return;
    }
    setActiveCall({ partner, type, callId: data.id });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedContact = params.get('contact');
    const requestedMode = params.get('mode');
    if (!requestedContact || (requestedMode !== 'voice' && requestedMode !== 'video') || !contacts.length) return;
    const partner = contacts.find((contact) => contact.id === requestedContact);
    window.history.replaceState({}, '', window.location.pathname);
    if (partner) void handleStartCall(partner, requestedMode);
    else toast('This contact is not available in your contacts yet.', 'error');
  }, [contacts]);

  const handleEndCall = async (duration: number) => {
    if (activeCall) {
      const status = duration > 0 ? 'answered' : 'missed';
      if (isConfigured) {
        const { error } = await supabase.from('calls').update({
          status,
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        }).eq('id', activeCall.callId);
        if (error) console.warn('Could not update call record:', error);
        const newRecord: CallRecord = {
          id: activeCall.callId,
          caller_id: user?.id || '',
          callee_id: activeCall.partner.id,
          type: activeCall.type,
          status: status as 'answered' | 'missed' | 'declined',
          started_at: new Date().toISOString(),
          duration_seconds: duration,
          partner: activeCall.partner,
        };
        setCalls((prev) => [newRecord, ...prev.filter((call) => call.id !== activeCall.callId)]);
      }
      toast(`Call ended (${formatDuration(duration)})`, 'info');
    }
    setActiveCall(null);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center text-lg font-black shadow-sm">
              📞
            </div>
            <h1 className="text-xl font-extrabold text-black dark:text-white">
              Call History
            </h1>
          </div>
          <button
            onClick={() => setShowContactPicker(true)}
            className="px-3.5 py-1.5 rounded-full bg-[#0E2A6E] text-white text-xs font-bold shadow-sm active:scale-95 cursor-pointer hover:bg-[#081B47]"
          >
            + New Call
          </button>
        </div>
      </header>

      {/* Main List */}
      <main className="max-w-md mx-auto px-4 py-3">
        <div className="sticky top-[62px] z-20 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur py-2 space-y-3">
          <label className="flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 px-3 py-2.5">
            <Search size={16} className="text-gray-400" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search call history" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            {searchTerm && <button onClick={() => setSearchTerm('')} aria-label="Clear search" className="text-gray-400"><span>×</span></button>}
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {([{ id: 'all', label: 'All' }, { id: 'missed', label: 'Missed' }, { id: 'outgoing', label: 'Outgoing' }, { id: 'incoming', label: 'Incoming' }] as const).map((filter) => (
              <button key={filter.id} onClick={() => setHistoryFilter(filter.id)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ${historyFilter === filter.id ? 'bg-[#0E2A6E] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                {filter.label}{filter.id === 'missed' && calls.filter((call) => call.status === 'missed').length > 0 ? ` · ${calls.filter((call) => call.status === 'missed').length}` : ''}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visibleCalls.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-xs space-y-3">
            <div className="text-4xl">📞</div>
            <p className="font-semibold text-black dark:text-white">{calls.length === 0 ? 'No calls recorded yet' : 'No matching calls'}</p>
            <p className="text-gray-400">{calls.length === 0 ? 'Start a voice or video call with a contact.' : 'Try another search or filter.'}</p>
            <button
              onClick={() => setShowContactPicker(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-[#0E2A6E] text-white font-bold text-xs"
            >
              Start First Call
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A3348]">
            {visibleCalls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between py-3.5 px-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Avatar
                    name={call.partner?.display_name || 'User'}
                    avatarUrl={call.partner?.avatar_url}
                    size="md"
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-black dark:text-white truncate">{call.partner?.display_name || 'Contact'}</h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
                      {call.status === 'missed' ? <PhoneMissed size={13} className="text-red-500" /> : call.caller_id === user?.id ? <PhoneOutgoing size={13} className="text-emerald-500" /> : <PhoneIncoming size={13} className="text-emerald-500" />}
                      <span className={call.status === 'missed' ? 'text-red-500 font-bold' : call.status === 'declined' ? 'text-amber-600 font-bold' : 'font-semibold'}>
                        {call.status === 'missed' ? 'Missed' : call.status === 'declined' ? 'Declined' : call.status === 'ringing' ? (call.caller_id === user?.id ? 'Outgoing · No answer yet' : 'Incoming · Ringing') : call.status === 'answered' ? (call.caller_id === user?.id ? 'Outgoing' : 'Incoming') : 'Call'}
                        {' · '}{call.type === 'video' ? 'Video' : 'Voice'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(call.started_at).toLocaleString()} {call.duration_seconds > 0 ? ` · ${formatDuration(call.duration_seconds)}` : ''}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button onClick={() => call.partner && void handleStartCall(call.partner, 'voice')} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-[#0E2A6E] hover:text-white transition-colors" title="Start voice call" aria-label="Start voice call"><Phone size={16} /></button>
                  <button onClick={() => call.partner && void handleStartCall(call.partner, 'video')} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-[#0E2A6E] hover:text-white transition-colors" title="Start video call" aria-label="Start video call"><Video size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Contact Picker Modal for New Call */}
      {showContactPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161B2B] rounded-3xl max-w-sm w-full p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-black dark:text-white">Select Contact to Call</h3>
              <button
                onClick={() => setShowContactPicker(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {contacts.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-500 space-y-2">
                <p>No contacts found in your contact list.</p>
                <button
                  onClick={() => {
                    setShowContactPicker(false);
                    navigate('/chats');
                  }}
                  className="px-3 py-1.5 rounded-full bg-[#0E2A6E] text-white font-bold"
                >
                  Add Contacts in Chats
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-60 overflow-y-auto">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center space-x-2.5">
                      <Avatar name={contact.display_name} avatarUrl={contact.avatar_url} size="sm" />
                      <div>
                        <div className="text-xs font-bold">{contact.display_name}</div>
                        <div className="text-[10px] text-gray-400">@{contact.username}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleStartCall(contact, 'voice')}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-bold hover:bg-[#0E2A6E] hover:text-white"
                      >
                        Voice
                      </button>
                      <button
                        onClick={() => handleStartCall(contact, 'video')}
                        className="px-2.5 py-1 rounded-lg bg-[#0E2A6E] text-white text-xs font-bold"
                      >
                        Video
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active WebRTC Call Screen Modal */}
      {activeCall && (
        <CallModal
          callId={activeCall.callId}
          partner={activeCall.partner}
          type={activeCall.type}
          isCaller={true}
          onEndCall={handleEndCall}
        />
      )}

      <BottomNav />
    </div>
  );
};
