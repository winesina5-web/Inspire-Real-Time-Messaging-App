import React, { useState } from 'react';

interface ScheduleSendModalProps {
  onSchedule: (scheduledTime: string) => void;
  onSetDisappear: (durationSeconds: number) => void;
  onClose: () => void;
}

export const ScheduleSendModal: React.FC<ScheduleSendModalProps> = ({
  onSchedule,
  onSetDisappear,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'disappear'>('schedule');
  const [customMinutes, setCustomMinutes] = useState(60);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
        {/* Tab Toggle */}
        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-4">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'schedule'
                ? 'bg-[#0E2A6E] text-white dark:bg-[#3D6FE0]'
                : 'text-gray-500 hover:text-black dark:hover:text-white'
            }`}
          >
            📅 Schedule Send
          </button>
          <button
            onClick={() => setActiveTab('disappear')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'disappear'
                ? 'bg-[#0E2A6E] text-white dark:bg-[#3D6FE0]'
                : 'text-gray-500 hover:text-black dark:hover:text-white'
            }`}
          >
            ⏱ Disappear After…
          </button>
        </div>

        {activeTab === 'schedule' ? (
          <div>
            <h4 className="font-extrabold text-sm text-black dark:text-white mb-1">
              Select Delivery Time
            </h4>
            <p className="text-xs text-gray-500 mb-4">
              Inspire Workers Cron delivers the message automatically at your selected time.
            </p>

            <div className="space-y-2 mb-6">
              {[
                { label: 'In 15 minutes', ms: 15 * 60 * 1000 },
                { label: 'In 1 hour', ms: 60 * 60 * 1000 },
                { label: 'This evening (8:00 PM)', ms: 4 * 60 * 60 * 1000 },
                { label: 'Tomorrow morning (9:00 AM)', ms: 16 * 60 * 60 * 1000 },
              ].map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    const scheduled = new Date(Date.now() + opt.ms).toISOString();
                    onSchedule(scheduled);
                  }}
                  className="w-full p-3 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-[#0E2A6E] dark:hover:border-[#3D6FE0] text-left text-xs font-bold text-black dark:text-white flex items-center justify-between"
                >
                  <span>{opt.label}</span>
                  <span className="text-gray-400">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <h4 className="font-extrabold text-sm text-black dark:text-white mb-1">
              Message Self-Destruct Override
            </h4>
            <p className="text-xs text-gray-500 mb-4">
              This single message will automatically disappear after the recipient reads it.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-6">
              {[
                { label: '5 seconds', sec: 5 },
                { label: '30 seconds', sec: 30 },
                { label: '1 minute', sec: 60 },
                { label: '1 hour', sec: 3600 },
                { label: '24 hours', sec: 86400 },
              ].map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSetDisappear(opt.sec)}
                  className="p-3 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-[#FFD700] hover:bg-[#FFD700]/10 text-center text-xs font-bold text-black dark:text-white"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
