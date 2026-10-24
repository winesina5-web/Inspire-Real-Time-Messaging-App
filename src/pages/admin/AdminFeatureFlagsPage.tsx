import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { useToast } from '../../components/Toast';
import { FeatureFlag } from '../../types';
import { supabase, isConfigured } from '../../lib/supabaseClient';

export const AdminFeatureFlagsPage: React.FC = () => {
  const { toast } = useToast();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFlags = async () => {
    setLoading(true);
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('feature_flags')
          .select('*')
          .order('key', { ascending: true });

        if (!error && data && data.length > 0) {
          setFlags(data as FeatureFlag[]);
        } else {
          // Default seed flags
          const defaults: FeatureFlag[] = [
            { key: 'audio_video_calling', rollout_percent: 100, enabled: true, updated_at: new Date().toISOString() },
            { key: 'ai_assistant_smart_reply', rollout_percent: 100, enabled: true, updated_at: new Date().toISOString() },
            { key: 'secret_chats_vault', rollout_percent: 100, enabled: true, updated_at: new Date().toISOString() },
            { key: 'stories_status_feed', rollout_percent: 100, enabled: true, updated_at: new Date().toISOString() },
            { key: 'interactive_polls', rollout_percent: 100, enabled: true, updated_at: new Date().toISOString() },
            { key: 'ai_voice_translation', rollout_percent: 50, enabled: false, updated_at: new Date().toISOString() },
          ];
          setFlags(defaults);
        }
      } catch (err) {
        console.warn('Load feature flags error:', err);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const handleToggle = async (key: string) => {
    const target = flags.find((f) => f.key === key);
    if (!target) return;
    const nextState = !target.enabled;

    if (isConfigured) {
      try {
        await supabase
          .from('feature_flags')
          .upsert({
            key,
            enabled: nextState,
            rollout_percent: target.rollout_percent,
            updated_at: new Date().toISOString(),
          });
      } catch (err) {
        console.warn('Update flag error:', err);
      }
    }

    setFlags((prev) =>
      prev.map((f) =>
        f.key === key
          ? { ...f, enabled: nextState, updated_at: new Date().toISOString() }
          : f
      )
    );
    toast(`Feature flag "${key}" set to ${nextState ? 'ENABLED' : 'DISABLED'}`, 'info');
  };

  const handleSliderChange = async (key: string, percent: number) => {
    const target = flags.find((f) => f.key === key);
    if (!target) return;

    if (isConfigured) {
      try {
        await supabase
          .from('feature_flags')
          .upsert({
            key,
            enabled: target.enabled,
            rollout_percent: percent,
            updated_at: new Date().toISOString(),
          });
      } catch (err) {
        console.warn('Slider update error:', err);
      }
    }

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

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {flags.map((flag) => (
              <div
                key={flag.key}
                className="bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        flag.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                      }`}
                    />
                    <span className="font-mono text-xs font-black text-black dark:text-white">
                      {flag.key}
                    </span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        flag.enabled
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                      }`}
                    >
                      {flag.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] mt-1">
                    Last modified: {new Date(flag.updated_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center space-x-6">
                  {/* Staged Rollout Slider */}
                  <div className="flex flex-col items-end space-y-1">
                    <span className="text-[10px] font-bold text-gray-500">
                      Rollout: {flag.rollout_percent}% of audience
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={flag.rollout_percent}
                      disabled={!flag.enabled}
                      onChange={(e) => handleSliderChange(flag.key, Number(e.target.value))}
                      className="w-32 accent-[#0E2A6E] cursor-pointer"
                    />
                  </div>

                  {/* Toggle Button */}
                  <button
                    onClick={() => handleToggle(flag.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      flag.enabled
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-[#0E2A6E] text-white hover:bg-[#081B47]'
                    }`}
                  >
                    {flag.enabled ? 'Disable Flag' : 'Enable Flag'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminSidebar>
  );
};
