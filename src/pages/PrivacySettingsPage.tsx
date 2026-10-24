import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { UserSession } from '../types';
import { hashPin } from '../utils/helpers';

interface PrivacySettingsState {
  read_receipts: boolean;
  last_seen_visibility: 'everyone' | 'contacts' | 'nobody';
  profile_photo_visibility: 'everyone' | 'contacts';
  app_lock_enabled: boolean;
  app_lock_timeout: 'immediately' | '1m' | '5m' | '15m';
  biometrics_enabled: boolean;
  two_factor_enabled: boolean;
}

export const PrivacySettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load persistent privacy settings or fallback
  const [settings, setSettings] = useState<PrivacySettingsState>(() => {
    const saved = localStorage.getItem(`inspire_privacy_${user?.id || 'default'}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      read_receipts: true,
      last_seen_visibility: 'everyone',
      profile_photo_visibility: 'everyone',
      app_lock_enabled: false,
      app_lock_timeout: '5m',
      biometrics_enabled: false,
      two_factor_enabled: false,
    };
  });

  // PIN modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');

  // 2FA modal state
  const [show2faModal, setShow2faModal] = useState(false);
  const [totpSecret, setTotpSecret] = useState('JBSWY3DPEHPK3PXP');
  const [totpCode, setTotpCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Active Sessions
  const [sessions, setSessions] = useState<UserSession[]>([
    {
      id: 'sess_curr_1',
      user_id: user?.id || 'usr_1',
      device_label: 'Chrome on MacOS (This device)',
      ip_address: '192.168.1.42',
      last_active: 'Just now',
      created_at: new Date().toISOString(),
      is_current: true,
      revoked: false,
    },
    {
      id: 'sess_mob_2',
      user_id: user?.id || 'usr_1',
      device_label: 'Inspire Mobile App (iOS 17.4)',
      ip_address: '172.56.21.90',
      last_active: '2 hours ago',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      is_current: false,
      revoked: false,
    },
    {
      id: 'sess_tab_3',
      user_id: user?.id || 'usr_1',
      device_label: 'Safari on iPad',
      ip_address: '108.45.12.11',
      last_active: 'Yesterday',
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      is_current: false,
      revoked: false,
    },
  ]);

  useEffect(() => {
    localStorage.setItem(`inspire_privacy_${user?.id || 'default'}`, JSON.stringify(settings));
  }, [settings, user?.id]);

  const updateSetting = <K extends keyof PrivacySettingsState>(
    key: K,
    val: PrivacySettingsState[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
    toast('Setting updated', 'success');
  };

  const handleToggleAppLock = () => {
    if (settings.app_lock_enabled) {
      // disable lock
      updateSetting('app_lock_enabled', false);
      localStorage.removeItem(`inspire_app_lock_pin_${user?.id}`);
      toast('App lock disabled', 'info');
    } else {
      // open pin setup
      setPinInput('');
      setPinConfirm('');
      setPinStep('create');
      setShowPinModal(true);
    }
  };

  const handleSavePin = async () => {
    if (pinStep === 'create') {
      if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
        toast('PIN must be 4 digits', 'error');
        return;
      }
      setPinStep('confirm');
      return;
    }

    if (pinInput !== pinConfirm) {
      toast('PINs do not match. Try again.', 'error');
      setPinStep('create');
      setPinInput('');
      setPinConfirm('');
      return;
    }

    const hashed = await hashPin(pinInput);
    localStorage.setItem(`inspire_app_lock_pin_${user?.id}`, hashed);
    updateSetting('app_lock_enabled', true);
    setShowPinModal(false);
    toast('App lock activated with 4-digit PIN!', 'success');
  };

  const handleToggle2fa = () => {
    if (settings.two_factor_enabled) {
      updateSetting('two_factor_enabled', false);
      setBackupCodes([]);
      toast('2FA disabled', 'info');
    } else {
      // Generate mock backup codes
      const codes = Array.from({ length: 6 }, () =>
        Math.random().toString(36).substring(2, 8).toUpperCase()
      );
      setBackupCodes(codes);
      setTotpCode('');
      setShow2faModal(true);
    }
  };

  const handleVerify2fa = () => {
    if (totpCode.trim().length !== 6) {
      toast('Enter a valid 6-digit code', 'error');
      return;
    }
    updateSetting('two_factor_enabled', true);
    setShow2faModal(false);
    toast('Two-Factor Authentication successfully activated!', 'success');
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    toast('Device session revoked', 'info');
  };

  const handleRevokeAllOtherSessions = () => {
    setSessions((prev) => prev.filter((s) => s.is_current));
    toast('Logged out from all other devices', 'success');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/profile')}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-lg"
              aria-label="Back to profile"
            >
              ←
            </button>
            <h1 className="text-lg font-black text-black dark:text-white">
              Privacy & Security
            </h1>
          </div>
          <span className="text-xl">🔒</span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Section 1: Visibility & Privacy */}
        <section className="bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <h2 className="font-extrabold text-xs uppercase tracking-wider text-[#0E2A6E] dark:text-[#3D6FE0]">
            Visibility & Status
          </h2>

          {/* Read Receipts */}
          <div className="flex items-center justify-between py-2 border-b border-[#E5E7EB] dark:border-[#2A3348]">
            <div>
              <p className="font-bold text-xs">Read Receipts</p>
              <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
                Show two blue ticks when messages have been read
              </p>
            </div>
            <button
              onClick={() => updateSetting('read_receipts', !settings.read_receipts)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.read_receipts ? 'bg-[#0E2A6E]' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                  settings.read_receipts ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {/* Last Seen */}
          <div className="flex items-center justify-between py-2 border-b border-[#E5E7EB] dark:border-[#2A3348]">
            <div>
              <p className="font-bold text-xs">Last Seen & Online</p>
              <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
                Who can see when you were last online
              </p>
            </div>
            <select
              value={settings.last_seen_visibility}
              onChange={(e) =>
                updateSetting(
                  'last_seen_visibility',
                  e.target.value as 'everyone' | 'contacts' | 'nobody'
                )
              }
              className="text-xs font-bold px-2 py-1 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348]"
            >
              <option value="everyone">Everyone</option>
              <option value="contacts">Contacts</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>

          {/* Profile Photo */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-bold text-xs">Profile Photo</p>
              <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
                Who can view your profile avatar
              </p>
            </div>
            <select
              value={settings.profile_photo_visibility}
              onChange={(e) =>
                updateSetting(
                  'profile_photo_visibility',
                  e.target.value as 'everyone' | 'contacts'
                )
              }
              className="text-xs font-bold px-2 py-1 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348]"
            >
              <option value="everyone">Everyone</option>
              <option value="contacts">My Contacts</option>
            </select>
          </div>
        </section>

        {/* Section 2: App Protection & PIN */}
        <section className="bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <h2 className="font-extrabold text-xs uppercase tracking-wider text-[#0E2A6E] dark:text-[#3D6FE0]">
            App Lock & Biometrics
          </h2>

          <div className="flex items-center justify-between py-2 border-b border-[#E5E7EB] dark:border-[#2A3348]">
            <div>
              <p className="font-bold text-xs">Require PIN to Open App</p>
              <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
                Protect Inspire with a 4-digit passcode
              </p>
            </div>
            <button
              onClick={handleToggleAppLock}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.app_lock_enabled ? 'bg-[#0E2A6E]' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                  settings.app_lock_enabled ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {settings.app_lock_enabled && (
            <>
              <div className="flex items-center justify-between py-2 border-b border-[#E5E7EB] dark:border-[#2A3348]">
                <p className="font-bold text-xs">Auto-Lock Delay</p>
                <select
                  value={settings.app_lock_timeout}
                  onChange={(e) =>
                    updateSetting(
                      'app_lock_timeout',
                      e.target.value as 'immediately' | '1m' | '5m' | '15m'
                    )
                  }
                  className="text-xs font-bold px-2 py-1 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348]"
                >
                  <option value="immediately">Immediately</option>
                  <option value="1m">After 1 minute</option>
                  <option value="5m">After 5 minutes</option>
                  <option value="15m">After 15 minutes</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-bold text-xs">Unlock with Face ID / Fingerprint</p>
                  <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
                    Use WebAuthn biometric sensors if supported
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateSetting('biometrics_enabled', !settings.biometrics_enabled)
                  }
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.biometrics_enabled ? 'bg-[#0E2A6E]' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                      settings.biometrics_enabled ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>
            </>
          )}

          {/* Quick link to Secret Vault */}
          <button
            onClick={() => navigate('/secret-chats')}
            className="w-full mt-2 py-2.5 px-3 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-bold flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <div className="flex items-center space-x-2">
              <span>🔏</span>
              <span>Manage Secret Chats Vault</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>
        </section>

        {/* Section 3: Two-Factor Authentication */}
        <section className="bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <h2 className="font-extrabold text-xs uppercase tracking-wider text-[#0E2A6E] dark:text-[#3D6FE0]">
            Authentication Security
          </h2>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-bold text-xs">Two-Factor Authentication (2FA)</p>
              <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
                Requires a one-time code from Google Authenticator or Authy
              </p>
            </div>
            <button
              onClick={handleToggle2fa}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.two_factor_enabled ? 'bg-[#0E2A6E]' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                  settings.two_factor_enabled ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>
        </section>

        {/* Section 4: Active Devices & Sessions */}
        <section className="bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-xs uppercase tracking-wider text-[#0E2A6E] dark:text-[#3D6FE0]">
              Active Devices ({sessions.length})
            </h2>
            {sessions.length > 1 && (
              <button
                onClick={handleRevokeAllOtherSessions}
                className="text-[11px] font-bold text-rose-500 hover:underline"
              >
                Log out others
              </button>
            )}
          </div>

          <div className="space-y-3">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs">{sess.device_label}</span>
                    {sess.is_current && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px]">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    IP: {sess.ip_address} • Active: {sess.last_active}
                  </p>
                </div>

                {!sess.is_current && (
                  <button
                    onClick={() => handleRevokeSession(sess.id)}
                    className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-[10px] font-bold hover:bg-rose-100"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* PIN Setup Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xs bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center text-xl font-bold">
              🔑
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-black dark:text-white">
                {pinStep === 'create' ? 'Set 4-Digit Passcode' : 'Confirm Passcode'}
              </h3>
              <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] mt-1">
                {pinStep === 'create'
                  ? 'Enter 4 numbers to lock Inspire'
                  : 'Re-enter your 4-digit code to confirm'}
              </p>
            </div>

            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pinStep === 'create' ? pinInput : pinConfirm}
              onChange={(e) =>
                pinStep === 'create'
                  ? setPinInput(e.target.value)
                  : setPinConfirm(e.target.value)
              }
              placeholder="••••"
              className="w-32 mx-auto text-center tracking-[0.5em] text-2xl font-black py-2 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] focus:outline-none focus:border-[#0E2A6E]"
            />

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="flex-1 py-2.5 rounded-2xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePin}
                className="flex-1 py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
              >
                {pinStep === 'create' ? 'Next' : 'Save PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Enrollment Modal */}
      {show2faModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FFD700] text-[#1A1A2E] flex items-center justify-center text-xl font-bold mb-2">
                📲
              </div>
              <h3 className="font-extrabold text-sm text-black dark:text-white">
                Set Up Two-Factor Authentication
              </h3>
              <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] mt-1">
                Scan with your authenticator app or enter the setup key:
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-2xl text-center border border-[#E5E7EB] dark:border-[#2A3348]">
              <code className="text-xs font-mono font-bold tracking-widest text-[#0E2A6E] dark:text-[#3D6FE0]">
                {totpSecret}
              </code>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">
                Enter 6-digit confirmation code
              </label>
              <input
                type="text"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000 000"
                className="w-full text-center tracking-[0.3em] font-black text-lg py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] focus:outline-none"
              />
            </div>

            {backupCodes.length > 0 && (
              <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/30">
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mb-1">
                  Save Your Emergency Backup Codes:
                </p>
                <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
                  {backupCodes.map((c, i) => (
                    <span key={i} className="text-gray-600 dark:text-gray-300 font-semibold">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShow2faModal(false)}
                className="flex-1 py-2.5 rounded-2xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerify2fa}
                className="flex-1 py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
              >
                Enable 2FA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
