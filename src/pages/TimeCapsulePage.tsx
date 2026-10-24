import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Message } from '../types';
import { formatMessageTime } from '../utils/helpers';

export const TimeCapsulePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [capsuleData, setCapsuleData] = useState<any>(() => {
    const saved = localStorage.getItem(`inspire_capsule_${id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      title: 'Our 2026 Collaboration Memories ⏳',
      unlock_at: null, // unlocked
      is_public: true,
      message_snapshot: [
        {
          id: 'cap_m1',
          sender_id: 'usr_jordan',
          content: 'Let us seal this moment in time: building Inspire from scratch with pure performance and zero slop.',
          created_at: '2026-02-15T10:00:00Z',
        },
        {
          id: 'cap_m2',
          sender_id: 'usr_me',
          content: 'Agreed! 55+ advanced features with complete dark mode parity and robust real-time delivery.',
          created_at: '2026-02-15T10:05:00Z',
        },
      ],
    };
  });

  const [isLocked, setIsLocked] = useState(false);
  const [countdownStr, setCountdownStr] = useState('');

  useEffect(() => {
    if (capsuleData.unlock_at) {
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
    }
  }, [capsuleData.unlock_at]);

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
            <div className="w-16 h-16 mx-auto rounded-3xl bg-[#FFD700] text-[#1A1A2E] flex items-center justify-center text-3xl font-black shadow-md">
              🔒
            </div>
            <h2 className="text-xl font-black text-black dark:text-white">
              Time Capsule is Sealed
            </h2>
            <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] max-w-xs mx-auto leading-relaxed">
              This conversation snapshot is preserved permanently and will unlock on{' '}
              {new Date(capsuleData.unlock_at).toLocaleDateString()}.
            </p>
            <div className="text-xl font-mono font-black text-[#0E2A6E] dark:text-[#FFD700] p-3 rounded-2xl bg-white dark:bg-[#0B0F1A] border border-gray-200 dark:border-gray-800">
              {countdownStr}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-[#FFD700]/15 border border-[#FFD700]/30 text-center">
              <span className="font-extrabold text-xs text-[#1A1A2E] dark:text-[#FFD700]">
                ✨ Unlocked Memory Archive — Immune to deletion
              </span>
            </div>

            <div className="space-y-3">
              {capsuleData.message_snapshot.map((msg: any) => (
                <div
                  key={msg.id}
                  className="p-4 rounded-3xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] shadow-xs space-y-1"
                >
                  <p className="text-xs text-black dark:text-white leading-relaxed">
                    {msg.content}
                  </p>
                  <span className="text-[10px] text-gray-400 block text-right font-medium">
                    {formatMessageTime(msg.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
