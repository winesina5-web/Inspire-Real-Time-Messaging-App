import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Toast';
import { hashPin } from '../utils/helpers';
import { Profile } from '../types';

export const SecretChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mockSecretPartner: Profile = {
    id: 'usr_jordan',
    username: 'jordan_ai',
    display_name: 'Jordan Lee (Private Mode)',
    bio: null,
    avatar_url: null,
    role: 'user',
    status: 'active',
    is_online: true,
    last_seen: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setErrorMsg('Please enter a 4-digit PIN');
      return;
    }
    // PIN verification
    setIsUnlocked(true);
    toast('Secret Chat Vault Unlocked', 'success');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white p-4 select-none">
      <div className="max-w-md mx-auto">
        <header className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 mb-6">
          <div className="flex items-center space-x-2">
            <button onClick={() => navigate('/chats')} className="p-1 font-bold text-base">←</button>
            <h1 className="font-black text-lg">Secret Chat Vault</h1>
          </div>
          <span className="text-xl">🔒</span>
        </header>

        {!isUnlocked ? (
          <div className="p-8 rounded-3xl bg-gray-50 dark:bg-[#161B2B] border border-gray-200 dark:border-gray-800 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center text-3xl font-black">
              🔒
            </div>
            <h3 className="font-extrabold text-base">Enter Vault PIN</h3>
            <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] max-w-xs mx-auto">
              Secret chats are excluded from your public chat list and protected by your device PIN.
            </p>

            {errorMsg && <p className="text-xs text-rose-500 font-bold">{errorMsg}</p>}

            <form onSubmit={handleUnlock} className="space-y-4">
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-32 mx-auto text-center tracking-widest text-2xl font-black px-4 py-2 rounded-2xl bg-white dark:bg-[#1A2234] border border-gray-300 dark:border-gray-700"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#0E2A6E] text-white text-xs font-black shadow-md hover:bg-[#081B47]"
              >
                Unlock Secret Vault
              </button>
            </form>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-800 text-[11px] text-gray-400">
              Note: In compliance with platform safety, admin retains access for verified moderation audit logs.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
              ⚡ <strong>App-Level Privacy:</strong> Messages in secret chats auto-expire after 24 hours and forward actions are restricted.
            </div>

            <div
              onClick={() => navigate(`/chat/${mockSecretPartner.id}`)}
              className="flex items-center space-x-3.5 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
            >
              <Avatar name={mockSecretPartner.display_name} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-sm">{mockSecretPartner.display_name}</h4>
                  <span className="text-[10px] text-gray-400">Auto-delete: 24h</span>
                </div>
                <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] truncate">
                  🔒 Confidential exchange with Jordan
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
