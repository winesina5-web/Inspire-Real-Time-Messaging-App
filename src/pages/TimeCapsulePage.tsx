import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';

export const TimeCapsulePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [capsuleData, setCapsuleData] = useState<{
    title: string;
    unlock_at: string | null;
    is_public: boolean;
    created_by: string;
    message_snapshot: any[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [countdownStr, setCountdownStr] = useState('');

  useEffect(() => {
    if (!id) return;

    const fetchCapsule = async () => {
      setLoading(true);
      if (isConfigured) {
        try {
          const { data, error } = await supabase
            .from('time_capsules')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (error || !data) {
            setErrorMsg('Time capsule not found or access restricted.');
          } else {
            setCapsuleData({
              title: data.title,
              unlock_at: data.unlock_at,
              is_public: data.is_public,
              created_by: data.created_by,
              message_snapshot: Array.isArray(data.message_snapshot) ? data.message_snapshot : [],
            });
          }
        } catch (err: any) {
          setErrorMsg(err.message || 'Error fetching time capsule');
        } finally {
          setLoading(false);
        }
      } else {
        // Fallback for offline dev inspection
        setCapsuleData({
          title: 'Project Collaboration Time Capsule ⏳',
          unlock_at: null,
          is_public: true,
          created_by: 'dev_user',
          message_snapshot: [
            {
              id: 'cap_1',
              sender_id: 'dev_user',
              content: 'Sealed time capsule memories for Inspire development.',
              created_at: new Date().toISOString(),
            },
          ],
        });
        setLoading(false);
      }
    };

    fetchCapsule();
  }, [id]);

  useEffect(() => {
    if (!capsuleData?.unlock_at) {
      setIsLocked(false);
      return;
    }

    const unlockTime = new Date(capsuleData.unlock_at).getTime();
    const checkCountdown = () => {
      const diff = unlockTime - Date.now();
      if (diff > 0) {
        setIsLocked(true);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const secs = Math.floor((diff / 1000) % 60);
        setCountdownStr(`${days}d ${hours}h ${mins}m ${secs}s`);
      } else {
        setIsLocked(false);
      }
    };

    checkCountdown();
    const interval = setInterval(checkCountdown, 1000);
    return () => clearInterval(interval);
  }, [capsuleData?.unlock_at]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B0F1A]">
        <div className="w-10 h-10 border-4 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (errorMsg || !capsuleData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B0F1A] p-4 text-center">
        <div className="max-w-md p-8 rounded-3xl bg-gray-50 dark:bg-[#161B2B] border border-gray-200 dark:border-gray-800 space-y-3">
          <div className="text-4xl">⏳</div>
          <h2 className="text-lg font-black">{errorMsg || 'Time Capsule Unavailable'}</h2>
          <p className="text-xs text-gray-500">This memory capsule might be private or does not exist.</p>
          <Link to="/chats" className="inline-block mt-3 px-4 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold">
            Return to Chats
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white flex flex-col relative select-none">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">⏳</span>
          <div>
            <h1 className="font-extrabold text-sm text-black dark:text-white leading-tight">
              {capsuleData.title}
            </h1>
            <p className="text-[10px] text-gray-500">
              {isLocked ? 'Sealed Time Capsule • Locked' : 'Sealed & Unlocked Time Capsule'}
            </p>
          </div>
        </div>

        <Link
          to="/chats"
          className="px-3.5 py-1.5 rounded-full bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
        >
          Open App
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col justify-center">
        {isLocked ? (
          <div className="text-center p-8 bg-gray-50 dark:bg-[#161B2B] rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center text-3xl font-black shadow-md">
              🔒
            </div>
            <h2 className="text-xl font-black text-black dark:text-white">
              Capsule Sealed Until Unlock Date
            </h2>
            <p className="text-xs text-gray-500">
              This conversation snapshot is frozen and will automatically reveal itself when the timer expires.
            </p>
            <div className="text-2xl font-mono font-black text-[#0E2A6E] dark:text-[#3D6FE0] tracking-wider py-2">
              {countdownStr}
            </div>
            <div className="text-[10px] text-gray-400">
              Unlocks on: {new Date(capsuleData.unlock_at!).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center py-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
              ✓ Time Capsule Unlocked & Verified
            </div>

            <div className="space-y-3">
              {capsuleData.message_snapshot.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className="p-4 rounded-2xl bg-gray-50 dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] space-y-1"
                >
                  <div className="text-xs font-semibold leading-relaxed">{msg.content}</div>
                  <div className="text-[10px] text-gray-400 text-right">
                    {msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
