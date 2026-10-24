import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { isValidUsername } from '../utils/helpers';
import { supabase, isConfigured } from '../lib/supabaseClient';

export const ChooseUsernamePage: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { toast } = useToast();
  const navigate = useNavigate();

  // Debounced check for username availability
  useEffect(() => {
    if (!username) {
      setIsAvailable(null);
      setIsChecking(false);
      return;
    }

    if (!isValidUsername(username)) {
      setIsAvailable(false);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    const timer = setTimeout(async () => {
      if (!isConfigured) {
        setIsAvailable(username !== 'taken_user');
        setIsChecking(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.toLowerCase())
          .maybeSingle();

        if (error) {
          setIsAvailable(null);
        } else {
          setIsAvailable(!data);
        }
      } catch {
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!isValidUsername(cleanUsername)) {
      setErrorMsg('Username must be 3-20 characters: lowercase letters, numbers, and underscore only.');
      return;
    }

    if (isAvailable === false) {
      setErrorMsg('This username is already taken. Please choose another.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await updateProfile({
      username: cleanUsername,
      display_name: displayName.trim() || cleanUsername,
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMsg(error.message);
    } else {
      toast('Username claimed successfully! Welcome to Inspire.', 'success');
      navigate('/chats');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-[#0B0F1A]">
      <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-8 border border-[#E5E7EB] dark:border-[#2A3348] shadow-xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0E2A6E] flex items-center justify-center text-[#FFD700] text-3xl font-black shadow-lg">
            ⚡
          </div>
          <h1 className="text-2xl font-extrabold text-black dark:text-white">
            Choose Your Identity
          </h1>
          <p className="text-sm font-semibold text-[#4B5563] dark:text-[#9CA3AF] mt-1">
            Your @username is how friends find and message you
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-slide-up">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
              Unique Username
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-400 font-bold text-sm select-none">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
                maxLength={20}
                required
                className="w-full pl-8 pr-12 py-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium focus:outline-none focus:border-[#0E2A6E] dark:focus:border-[#3D6FE0] focus:ring-2 focus:ring-[#0E2A6E]/20 text-sm"
              />
              <div className="absolute right-4 top-3.5 flex items-center">
                {isChecking && (
                  <span className="text-xs text-gray-400 animate-spin">⏳</span>
                )}
                {!isChecking && isAvailable === true && (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold" title="Available">
                    ✓
                  </span>
                )}
                {!isChecking && isAvailable === false && (
                  <span className="text-sm text-rose-600 dark:text-rose-400 font-bold" title="Unavailable">
                    ✕
                  </span>
                )}
              </div>
            </div>
            <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] mt-1 font-medium">
              3–20 chars. Lowercase letters, numbers, and underscores only.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              maxLength={40}
              required
              className="w-full px-4 py-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium focus:outline-none focus:border-[#0E2A6E] dark:focus:border-[#3D6FE0] focus:ring-2 focus:ring-[#0E2A6E]/20 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isAvailable === false || !username}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#0E2A6E] text-white font-extrabold text-sm hover:bg-[#081B47] active:scale-95 transition-all shadow-md disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Start Chatting on Inspire'}
          </button>
        </form>
      </div>
    </div>
  );
};
