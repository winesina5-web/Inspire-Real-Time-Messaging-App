import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { UserSession } from '../types';
import { hashPin } from '../utils/helpers';
import { supabase, isConfigured } from '../lib/supabaseClient';

interface PrivacySettingsState {
  read_receipts: boolean;
  last_seen_visibility: 'everyone' | 'contacts' | 'nobody';
  profile_photo_visibility: 'everyone' | 'contacts' | 'nobody';
  status_visibility: 'everyone' | 'contacts' | 'nobody';
  app_lock_enabled: boolean;
  two_factor_enabled: boolean;
}

export const PrivacySettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<PrivacySettingsState>({
    read_receipts: true,
    last_seen_visibility: 'everyone',
    profile_photo_visibility: 'everyone',
    status_visibility: 'everyone',
    app_lock_enabled: false,
    two_factor_enabled: false,
  });

  const [loading, setLoading] = useState(true);

  // PIN modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');

  // 2FA modal state
  const [show2faModal, setShow2faModal] = useState(false);
  const [totpQr, setTotpQr] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');

  // Active Sessions
  const [sessions, setSessions] = useState<UserSession[]>([]);

  // Load privacy settings from Supabase privacy_settings table
  useEffect(() => {
    if (!user) return;

    const loadSettingsAndSessions = async () => {
      setLoading(true);
      if (isConfigured) {
        try {
          // Load privacy settings
          const { data: privData } = await supabase
            .from('privacy_settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (privData) {
            setSettings({
              read_receipts: Boolean(privData.read_receipts_enabled),
              last_seen_visibility: privData.last_seen_visibility,
              profile_photo_visibility: privData.profile_photo_visibility,
              status_visibility: privData.status_visibility,
              app_lock_enabled: Boolean(user.app_lock_enabled),
              two_factor_enabled: Boolean(user.two_factor_enabled),
            });
          }

          // Load active sessions
          const { data: sessData } = await supabase
            .from('user_sessions')
            .select('*')
            .eq('user_id', user.id)
            .eq('revoked', false)
            .order('last_active', { ascending: false });

          if (sessData && sessData.length > 0) {
            setSessions(
              sessData.map((s: any) => ({
                id: s.id,
                user_id: s.user_id,
                device_label: s.device_label,
                last_active: new Date(s.last_active).toLocaleString(),
                created_at: s.created_at,
                is_current: false,
                revoked: s.revoked,
              }))
            );
          } else {
            // Default current session indicator
            setSessions([
              {
                id: 'sess_curr',
                user_id: user.id,
                device_label: `${navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser'} (Current Session)`,
                last_active: 'Active now',
                created_at: new Date().toISOString(),
                is_current: true,
                revoked: false,
              },
            ]);
          }
        } catch (err) {
          console.warn('Privacy settings load error:', err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadSettingsAndSessions();
  }, [user]);

  const updateSetting = async <K extends keyof PrivacySettingsState>(
    key: K,
    val: PrivacySettingsState[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: val }));

    if (isConfigured && user) {
      try {
        const columnMap: Record<string, string> = {
          read_receipts: 'read_receipts_enabled',
          last_seen_visibility: 'last_seen_visibility',
          profile_photo_visibility: 'profile_photo_visibility',
          status_visibility: 'status_visibility',
        };

        const dbCol = columnMap[key as string];
        if (dbCol) {
          await supabase.from('privacy_settings').upsert({
            user_id: user.id,
            [dbCol]: val,
          });
        }
      } catch (err) {
        console.warn('Failed to persist privacy setting:', err);
      }
    }

    toast('Privacy preferences updated', 'success');
  };

  const handleToggleAppLock = async () => {
    if (settings.app_lock_enabled) {
      updateSetting('app_lock_enabled', false);
      if (isConfigured && user) {
        await supabase.from('profiles').update({ app_lock_enabled: false }).eq('id', user.id);
        await supabase.from('app_lock_pins').delete().eq('user_id', user.id);
      }
      toast('App lock disabled', 'info');
    } else {
      setPinInput('');
      setPinConfirm('');
      setPinStep('create');
      setShowPinModal(true);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (pinStep === 'create') {
      if (pinInput.length < 4) {
        toast('PIN must be at least 4 digits', 'error');
        return;
      }
      setPinStep('confirm');
    } else {
      if (pinInput !== pinConfirm) {
        toast('PIN entries do not match', 'error');
        setPinConfirm('');
        return;
      }

      const hash = await hashPin(pinInput);

      if (isConfigured) {
        try {
          await supabase.from('app_lock_pins').upsert({
            user_id: user.id,
            pin_hash: hash,
            updated_at: new Date().toISOString(),
          });
          await supabase.from('profiles').update({ app_lock_enabled: true }).eq('id', user.id);
        } catch (err) {
          console.warn('Failed to save PIN:', err);
        }
      }

      updateSetting('app_lock_enabled', true);
      setShowPinModal(false);
      toast('App lock PIN enabled securely', 'success');
    }
  };

  const handleEnroll2fa = async () => {
    if (!isConfigured) {
      toast('Real 2FA TOTP requires Supabase Auth connection', 'info');
      return;
    }

    try {
      // Supabase Auth MFA Enroll API
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) {
        toast(error.message, 'error');
        return;
      }
      if (data) {
        setFactorId(data.id);
        setTotpQr(data.totp.qr_code);
        setTotpSecret(data.totp.secret);
        setShow2faModal(true);
      }
    } catch (err) {
      toast('2FA setup failed', 'error');
    }
  };

  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !totpCode.trim() || !user) return;

    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        toast(challenge.error.message, 'error');
        return;
      }

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: totpCode.trim(),
      });

      if (verify.error) {
        toast(verify.error.message, 'error');
        return;
      }

      await supabase.from('profiles').update({ two_factor_enabled: true }).eq('id', user.id);
      updateSetting('two_factor_enabled', true);
      setShow2faModal(false);
      toast('Two-Factor Authentication (TOTP) successfully activated!', 'success');
    } catch (err) {
      toast('2FA verification error', 'error');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (isConfigured && user) {
      try {
        await supabase
          .from('user_sessions')
          .update({ revoked: true })
          .eq('id', sessionId)
          .eq('user_id', user.id);
      } catch (err) {
        console.warn('Session revoke error:', err);
      }
    }

    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    toast('Session revoked. Device will be logged out on next request.', 'success');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/profile')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ←
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center font-black text-sm">
              🛡️
            </div>
            <h1 className="text-xl font-extrabold text-black dark:text-white">
              Privacy & Security
            </h1>
          </div>
        </div>
      </header>

      {/* Main Settings */}
      <main className="max-w-md mx-auto px-4 py-4 space-y-6">
        {/* Visibility Controls */}
        <div className="bg-white dark:bg-[#161B2B] p-5 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#4B5563] dark:text-[#9CA3AF]">
            Visibility Controls
          </h2>

          <div className="space-y-4 divide-y divide-gray-100 dark:divide-gray-800 text-xs">
            {/* Read Receipts */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="font-bold block text-sm">Read Receipts</span>
                <span className="text-gray-500 text-[11px]">
                  Double blue/accent ticks when messages are read
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.read_receipts}
                onChange={(e) => updateSetting('read_receipts', e.target.checked)}
                className="w-5 h-5 accent-[#0E2A6E] cursor-pointer"
              />
            </div>

            {/* Last Seen Visibility */}
            <div className="flex items-center justify-between pt-4">
              <div>
                <span className="font-bold block text-sm">Last Seen & Online</span>
                <span className="text-gray-500 text-[11px]">Who can see your online status</span>
              </div>
              <select
                value={settings.last_seen_visibility}
                onChange={(e) => updateSetting('last_seen_visibility', e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] font-bold"
              >
                <option value="everyone">Everyone</option>
                <option value="contacts">My Contacts</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>

            {/* Profile Photo Visibility */}
            <div className="flex items-center justify-between pt-4">
              <div>
                <span className="font-bold block text-sm">Profile Photo</span>
                <span className="text-gray-500 text-[11px]">Who can view your avatar</span>
              </div>
              <select
                value={settings.profile_photo_visibility}
                onChange={(e) => updateSetting('profile_photo_visibility', e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] font-bold"
              >
                <option value="everyone">Everyone</option>
                <option value="contacts">My Contacts</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
          </div>
        </div>

        {/* Account Security */}
        <div className="bg-white dark:bg-[#161B2B] p-5 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#4B5563] dark:text-[#9CA3AF]">
            Security Protection
          </h2>

          <div className="space-y-4 divide-y divide-gray-100 dark:divide-gray-800 text-xs">
            {/* App Lock */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="font-bold block text-sm">App Lock (PIN)</span>
                <span className="text-gray-500 text-[11px]">Require salted hash PIN on app open</span>
              </div>
              <button
                onClick={handleToggleAppLock}
                className={`px-3 py-1.5 rounded-full font-bold text-xs ${
                  settings.app_lock_enabled ? 'bg-red-500 text-white' : 'bg-[#0E2A6E] text-white'
                }`}
              >
                {settings.app_lock_enabled ? 'Disable' : 'Enable'}
              </button>
            </div>

            {/* 2FA / TOTP */}
            <div className="flex items-center justify-between pt-4">
              <div>
                <span className="font-bold block text-sm">Two-Factor Auth (TOTP)</span>
                <span className="text-gray-500 text-[11px]">
                  {settings.two_factor_enabled ? 'Active • Authenticator app verified' : 'Authenticator app protection'}
                </span>
              </div>
              <button
                onClick={handleEnroll2fa}
                disabled={settings.two_factor_enabled}
                className={`px-3 py-1.5 rounded-full font-bold text-xs ${
                  settings.two_factor_enabled ? 'bg-emerald-600 text-white' : 'bg-[#0E2A6E] text-white'
                }`}
              >
                {settings.two_factor_enabled ? 'Active ✓' : 'Setup 2FA'}
              </button>
            </div>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-white dark:bg-[#161B2B] p-5 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#4B5563] dark:text-[#9CA3AF]">
            Active Sessions & Devices
          </h2>

          <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
            {sessions.map((sess) => (
              <div key={sess.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-bold text-black dark:text-white">{sess.device_label}</div>
                  <div className="text-[11px] text-gray-400">{sess.last_active}</div>
                </div>
                {!sess.is_current && (
                  <button
                    onClick={() => handleRevokeSession(sess.id)}
                    className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold text-[11px] hover:bg-red-200"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* PIN Setup Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161B2B] rounded-3xl max-w-sm w-full p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl space-y-4">
            <h3 className="font-black text-base text-black dark:text-white">
              {pinStep === 'create' ? 'Create 4-Digit Security PIN' : 'Confirm Your PIN'}
            </h3>
            <p className="text-xs text-gray-500">
              {pinStep === 'create'
                ? 'Enter a memorable PIN to protect Inspire on this device.'
                : 'Re-enter your PIN to verify.'}
            </p>
            <form onSubmit={handleSavePin} className="space-y-4">
              <input
                type="password"
                maxLength={6}
                value={pinStep === 'create' ? pinInput : pinConfirm}
                onChange={(e) => (pinStep === 'create' ? setPinInput(e.target.value) : setPinConfirm(e.target.value))}
                placeholder="••••"
                className="w-full text-center tracking-widest text-2xl font-black px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-black dark:text-white focus:outline-hidden"
              />
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold"
                >
                  {pinStep === 'create' ? 'Next' : 'Save PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2FA TOTP Enrollment Modal */}
      {show2faModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161B2B] rounded-3xl max-w-sm w-full p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl space-y-4">
            <h3 className="font-black text-base text-black dark:text-white">Scan in Authenticator App</h3>
            <p className="text-xs text-gray-500">
              Use Google Authenticator, Authy, or 1Password to scan this QR code or enter the secret code.
            </p>
            {totpQr && (
              <div className="flex justify-center p-2 bg-white rounded-2xl">
                <img src={totpQr} alt="TOTP QR" className="w-44 h-44" />
              </div>
            )}
            {totpSecret && (
              <div className="bg-gray-100 dark:bg-gray-800 p-2.5 rounded-xl text-center text-xs font-mono select-all">
                {totpSecret}
              </div>
            )}
            <form onSubmit={handleVerify2fa} className="space-y-3">
              <input
                type="text"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="6-digit code"
                className="w-full text-center text-xl font-bold tracking-widest px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800"
              />
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShow2faModal(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold"
                >
                  Verify & Activate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
