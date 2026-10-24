import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { useToast } from '../../components/Toast';
import { FeatureFlag } from '../../types';

export const AdminFeatureFlagsPage: React.FC = () => {
  const { toast } = useToast();

  const [flags, setFlags] = useState<FeatureFlag[]>(() => {
    const saved = localStorage.getItem('inspire_feature_flags');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return [
      {
        key: 'audio_video_calling',
        rollout_percent: 100,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      {
        key: 'ai_assistant_smart_reply',
        rollout_percent: 100,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      {
        key: 'secret_chats_vault',
        rollout_percent: 100,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      {
        key: 'stories_status_feed',
        rollout_percent: 75,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      {
        key: 'interactive_polls',
        rollout_percent: 100,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      {
        key: 'ai_voice_translation',
        rollout_percent: 50,
        enabled: false,
        updated_at: new Date().toISOString(),
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem('inspire_feature_flags', JSON.stringify(flags));
  }, [flags]);

  const handleToggle = (key: string) => {
    setFlags((prev) =>
      prev.map((f) =>
        f.key === key
          ? { ...f, enabled: !f.enabled, updated_at: new Date().toISOString() }
          : f
      )
    );
    toast(`Feature flag "${key}" updated`, 'info');
  };

  const handleSliderChange = (key: string, percent: number) => {
    setFlags((prev) =>
      prev.map((f) =>
        f.key === key
          ? { ...f, rollout_percent: percent, updated_at: new Date().toISOString() }
          : f
      )
    );
  };

  return (
    <AdminSidebar>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-black text-black dark:text-white">
            Feature Flags & Gradual Rollouts
          </h1>
          <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-1">
            Safely toggle major platform capabilities, configure percentage-based staged rollouts, and instantly killswitch heavy features during traffic spikes.
          </p>
        </div>

        <div className="space-y-4">
          {flags.map((flag) => (
            <div
              key={flag.key}
              className="bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-extrabold text-xs font-mono text-[#0E2A6E] dark:text-[#3D6FE0]">
                    {flag.key}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      flag.enabled
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-rose-500/10 text-rose-600'
                    }`}
                  >
                    {flag.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
                  Last modified: {new Date(flag.updated_at).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center space-x-6">
                {/* Rollout slider */}
                <div className="flex items-center space-x-3">
                  <span className="text-[11px] font-bold text-gray-500">Rollout:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    disabled={!flag.enabled}
                    value={flag.rollout_percent}
                    onChange={(e) => handleSliderChange(flag.key, Number(e.target.value))}
                    className="w-28 accent-[#0E2A6E]"
                  />
                  <span className="text-xs font-black min-w-[3rem]">
                    {flag.rollout_percent}%
                  </span>
                </div>

                {/* Killswitch toggle */}
                <button
                  onClick={() => handleToggle(flag.key)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    flag.enabled ? 'bg-[#0E2A6E]' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                  aria-label={`Toggle ${flag.key}`}
                >
                  <span
                    className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                      flag.enabled ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminSidebar>
  );
};
