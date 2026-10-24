import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { Avatar } from '../components/Avatar';
import { CallModal } from '../components/CallModal';
import { useToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import { CallRecord, Profile } from '../types';
import { formatDuration } from '../utils/helpers';

const SEED_CALLS: CallRecord[] = [
  {
    id: 'call_1',
    caller_id: 'usr_jordan',
    callee_id: '11111111-1111-4111-8111-111111111111',
    type: 'video',
    status: 'answered',
    started_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    duration_seconds: 412,
    partner: {
      id: 'usr_jordan',
      username: 'jordan_ai',
      display_name: 'Jordan Lee',
      bio: null,
      avatar_url: null,
      role: 'user',
      status: 'active',
      is_online: true,
      last_seen: new Date().toISOString(),
      created_at: '2026-01-15T09:00:00Z',
    },
  },
  {
    id: 'call_2',
    caller_id: 'usr_maya',
    callee_id: '11111111-1111-4111-8111-111111111111',
    type: 'voice',
    status: 'missed',
    started_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    duration_seconds: 0,
    partner: {
      id: 'usr_maya',
      username: 'maya_tech',
      display_name: 'Maya Patel',
      bio: null,
      avatar_url: null,
      role: 'user',
      status: 'active',
      is_online: true,
      last_seen: new Date().toISOString(),
      created_at: '2026-02-01T11:00:00Z',
    },
  },
];

export const CallsPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [calls, setCalls] = useState<CallRecord[]>(SEED_CALLS);
  const [activeCall, setActiveCall] = useState<{ partner: Profile; type: 'voice' | 'video' } | null>(null);

  const handleStartCall = (partner: Profile, type: 'voice' | 'video') => {
    setActiveCall({ partner, type });
  };

  const handleEndCall = (duration: number) => {
    if (activeCall && user) {
      const newRecord: CallRecord = {
        id: `call_${Date.now()}`,
        caller_id: user.id,
        callee_id: activeCall.partner.id,
        type: activeCall.type,
        status: 'answered',
        started_at: new Date().toISOString(),
        duration_seconds: duration,
        partner: activeCall.partner,
      };
      setCalls((prev) => [newRecord, ...prev]);
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
            onClick={() => handleStartCall(SEED_CALLS[0].partner!, 'video')}
            className="px-3.5 py-1.5 rounded-full bg-[#0E2A6E] text-white text-xs font-bold shadow-sm active:scale-95"
          >
            + New Call
          </button>
        </div>
      </header>

      {/* Main List */}
      <main className="max-w-md mx-auto px-4 py-3">
        {calls.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-xs">
            No calls recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A3348]">
            {calls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between py-3.5 px-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/40"
              >
                <div className="flex items-center space-x-3">
                  <Avatar name={call.partner?.display_name || 'Contact'} size="md" />
                  <div>
                    <h4 className="font-extrabold text-sm text-black dark:text-white">
                      {call.partner?.display_name}
                    </h4>
                    <div className="flex items-center space-x-1.5 text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
                      <span className={call.status === 'missed' ? 'text-rose-500 font-bold' : 'text-emerald-600'}>
                        {call.status === 'missed' ? '↙ Missed' : '↗ Answered'}
                      </span>
                      <span>•</span>
                      <span>{new Date(call.started_at).toLocaleDateString()}</span>
                      {call.duration_seconds > 0 && (
                        <>
                          <span>•</span>
                          <span>{formatDuration(call.duration_seconds)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => call.partner && handleStartCall(call.partner, 'voice')}
                    className="p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-sm transition-transform active:scale-90"
                    title="Voice Call"
                    aria-label="Start voice call"
                  >
                    📞
                  </button>
                  <button
                    onClick={() => call.partner && handleStartCall(call.partner, 'video')}
                    className="p-2.5 rounded-full bg-[#0E2A6E] text-white text-sm transition-transform active:scale-90 shadow-sm"
                    title="Video Call"
                    aria-label="Start video call"
                  >
                    📹
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Active Call Full Screen Interface */}
      {activeCall && (
        <CallModal
          partner={activeCall.partner}
          type={activeCall.type}
          onEndCall={handleEndCall}
        />
      )}

      <BottomNav isAdmin={isAdmin} />
    </div>
  );
};
