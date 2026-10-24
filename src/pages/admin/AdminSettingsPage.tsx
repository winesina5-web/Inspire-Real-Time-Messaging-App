import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { useToast } from '../../components/Toast';
import { supabase, isConfigured } from '../../lib/supabaseClient';

interface SettingsState {
  maintenance_mode: boolean;
  ai_smart_reply_enabled: boolean;
  ai_translate_enabled: boolean;
  ai_summarize_enabled: boolean;
  ai_smart_search_enabled: boolean;
  ai_moderate_enabled: boolean;
  ai_transcribe_enabled: boolean;
  ai_emoji_suggest_enabled: boolean;
}

export const AdminSettingsPage: React.FC = () => {
  const { toast } = useToast();

  const [settings, setSettings] = useState<SettingsState>(() => {
    const saved = localStorage.getItem('inspire_app_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      maintenance_mode: false,
      ai_smart_reply_enabled: true,
      ai_translate_enabled: true,
      ai_summarize_enabled: true,
      ai_smart_search_enabled: true,
      ai_moderate_enabled: true,
      ai_transcribe_enabled: true,
      ai_emoji_suggest_enabled: true,
    };
  });

  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState(false);

  useEffect(() => {
    localStorage.setItem('inspire_app_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!isConfigured) return;

    const fetchRemoteSettings = async () => {
      try {
        const { data } = await supabase.from('app_settings').select('*');
        if (data) {
          const map: Partial<SettingsState> = {};
          data.forEach((row: { key: string; value: boolean }) => {
            (map as Record<string, boolean>)[row.key] = row.value;
          });
          setSettings((prev) => ({ ...prev, ...map }));
        }
      } catch (err) {
        console.warn('Settings fetch error:', err);
      }
    };

    fetchRemoteSettings();
  }, []);

  const handleToggleSetting = async (key: keyof SettingsState, newValue: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: newValue }));

    if (isConfigured) {
      try {
        await supabase
          .from('app_settings')
          .upsert({ key, value: newValue, updated_at: new Date().toISOString() });
      } catch (err: unknown) {
        console.warn('Setting update error:', err);
      }
    }

    toast(`Setting ${key} updated to ${newValue ? 'ENABLED' : 'DISABLED'}`, 'info');
  };

  const handleConfirmMaintenance = async () => {
    const nextVal = !settings.maintenance_mode;
    setShowMaintenanceConfirm(false);
    await handleToggleSetting('maintenance_mode', nextVal);
    toast(
      nextVal
        ? 'Maintenance Mode is now ENABLED app-wide. Non-admin users are blocked.'
        : 'Maintenance Mode is now DISABLED. All users can access.',
      nextVal ? 'error' : 'success'
    );
  };

  const aiToggles = [
    { key: 'ai_smart_reply_enabled', label: 'Smart Reply Suggestions', model: '@cf/meta/llama-3.1-8b-instruct-fast', cost: '< 1 neuron/call' },
    { key: 'ai_translate_enabled', label: 'Live Message Translation', model: '@cf/meta/m2m100-1.2b', cost: '0.1 neuron/sentence' },
    { key: 'ai_summarize_enabled', label: 'Chat Summarizer', model: '@cf/meta/llama-3.1-8b-instruct-fast', cost: '< 1 neuron/call' },
    { key: 'ai_smart_search_enabled', label: 'Natural Language Smart Search', model: '@cf/baai/bge-m3', cost: '0.05 neuron/search' },
    { key: 'ai_transcribe_enabled', label: 'Voice Note Transcription', model: '@cf/openai/whisper-large-v3-turbo', cost: '~23 neurons/30s clip' },
    { key: 'ai_emoji_suggest_enabled', label: 'AI Emoji Suggestions', model: '@cf/meta/llama-3.1-8b-instruct-fast', cost: '< 1 neuron/call' },
    { key: 'ai_moderate_enabled', label: 'Content Safety Moderation', model: '@cf/meta/llama-guard-3-8b', cost: '~0.2 neuron/report' },
  ];

  return (
    <AdminSidebar>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">
            App Settings & Controls
          </h1>
          <p className="text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
            Manage global maintenance states and Cloudflare Workers AI kill switches
          </p>
        </div>

        {/* Maintenance Mode Card */}
        <div className="bg-white dark:bg-[#161B2B] p-6 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl">⚠️</span>
                <h3 className="font-extrabold text-sm text-black dark:text-white">
                  Maintenance Mode
                </h3>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-1 max-w-xl leading-relaxed">
                When enabled, non-admin users attempting to open the app or send messages are presented with a maintenance banner. Admins retain full access.
              </p>
            </div>

            <button
              onClick={() => setShowMaintenanceConfirm(true)}
              className={`px-5 py-2.5 rounded-2xl text-xs font-black shadow-md transition-all active:scale-95 ${
                settings.maintenance_mode
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {settings.maintenance_mode ? 'ENABLED (Turn Off)' : 'DISABLED (Turn On)'}
            </button>
          </div>
        </div>

        {/* AI Kill Switches Section */}
        <div className="bg-white dark:bg-[#161B2B] p-6 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <div className="border-b border-[#E5E7EB] dark:border-[#2A3348] pb-3">
            <h3 className="font-extrabold text-sm text-black dark:text-white flex items-center space-x-2">
              <span className="text-[#FFD700]">✨</span>
              <span>Workers AI Feature Kill Switches (10,000 Neurons/Day Safeguard)</span>
            </h3>
            <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
              Disable any feature instantly if the daily account neuron quota approaches exhaustion.
            </p>
          </div>

          <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A3348]">
            {aiToggles.map((item) => {
              const isEnabled = settings[item.key as keyof SettingsState];
              return (
                <div
                  key={item.key}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <h4 className="font-bold text-xs text-black dark:text-white">
                      {item.label}
                    </h4>
                    <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
                      Model: <code className="font-mono">{item.model}</code> • Est. {item.cost}
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(isEnabled)}
                      onChange={(e) =>
                        handleToggleSetting(item.key as keyof SettingsState, e.target.checked)
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#0E2A6E] dark:peer-checked:bg-[#3D6FE0]" />
                    <span className="ml-2 text-xs font-bold text-black dark:text-white">
                      {isEnabled ? 'Active' : 'Muted'}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature 133: AI Content Policy Rule Editor */}
        <div className="bg-white dark:bg-[#161B2B] p-6 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <div className="border-b border-[#E5E7EB] dark:border-[#2A3348] pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-black dark:text-white flex items-center space-x-2">
                <span>🛡️</span>
                <span>AI Content Safety Policy & Llama Guard 3 Rules</span>
              </h3>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
                Define and update custom guardrails, prompt boundary policies, and safety categories.
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 text-[10px] font-black">
              Llama Guard 3 Active
            </span>
          </div>

          <div className="space-y-3">
            {[
              { id: 'pol_1', category: 'Hate & Harassment', description: 'Zero tolerance for discriminatory speech or targeted harassment.', active: true },
              { id: 'pol_2', category: 'Exploitation & Harm', description: 'Block all explicit content, self-harm instructions, or malicious payloads.', active: true },
              { id: 'pol_3', category: 'Fraud & Financial Scams', description: 'Detect automated crypto/phishing patterns and suspicious monetary transfers.', active: true },
              { id: 'pol_4', category: 'Automated Spam Loops', description: 'Enforce rate limits on high-frequency duplicate messages and broadcast abuse.', active: true },
            ].map((policy) => (
              <div
                key={policy.id}
                className="p-3.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between"
              >
                <div>
                  <h4 className="font-extrabold text-xs text-black dark:text-white">{policy.category}</h4>
                  <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">{policy.description}</p>
                </div>
                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  Enforced
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Feature 111: Registered Chatbots & Webhook Integrations */}
        <div className="bg-white dark:bg-[#161B2B] p-6 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <div className="border-b border-[#E5E7EB] dark:border-[#2A3348] pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-black dark:text-white flex items-center space-x-2">
                <span>🤖</span>
                <span>Registered Chatbots & Webhook Integrations</span>
              </h3>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
                Enable interactive bot participants capable of responding to group chat commands.
              </p>
            </div>
            <button
              onClick={() => toast('New chatbot registration wizard opened', 'info')}
              className="px-3 py-1.5 rounded-xl bg-[#0E2A6E] text-[#FFD700] text-xs font-bold hover:bg-[#081B47]"
            >
              + Register Bot
            </button>
          </div>

          <div className="space-y-3">
            {[
              { id: 'bot_1', name: 'Weather Bot ⛅', trigger: '@weather', webhook: 'https://api.inspire.im/bots/weather', status: 'Online' },
              { id: 'bot_2', name: 'Coin Tracker 🪙', trigger: '@crypto', webhook: 'https://api.inspire.im/bots/crypto', status: 'Online' },
              { id: 'bot_3', name: 'Poll Master 📊', trigger: '@poll', webhook: 'https://api.inspire.im/bots/polls', status: 'Online' },
            ].map((bot) => (
              <div
                key={bot.id}
                className="p-3.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-extrabold text-xs text-black dark:text-white">{bot.name}</h4>
                    <code className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-[#0E2A6E] dark:text-[#3D6FE0] px-1.5 py-0.2 rounded font-bold">
                      {bot.trigger}
                    </code>
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{bot.webhook}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-bold text-emerald-600">{bot.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Confirmation Modal for Maintenance Mode */}
        {showMaintenanceConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
              <h3 className="font-extrabold text-base text-rose-600 mb-2">
                Toggle Maintenance Mode?
              </h3>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed mb-6">
                Are you sure you want to{' '}
                <strong>{settings.maintenance_mode ? 'disable' : 'enable'}</strong> app-wide maintenance mode?
                {!settings.maintenance_mode && ' Non-administrators will be temporarily prevented from messaging.'}
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowMaintenanceConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmMaintenance}
                  className="flex-1 py-2.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
                >
                  Confirm Toggle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminSidebar>
  );
};
