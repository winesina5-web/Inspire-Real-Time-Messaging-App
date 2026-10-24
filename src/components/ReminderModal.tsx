import React, { useState } from 'react';
import { Message } from '../types';

interface ReminderModalProps {
  message: Message;
  onSetReminder: (remindAt: string, note?: string) => void;
  onClose: () => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  message,
  onSetReminder,
  onClose,
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const [note, setNote] = useState('');

  const handleConfirm = () => {
    const remindAt = new Date(Date.now() + selectedMinutes * 60 * 1000).toISOString();
    onSetReminder(remindAt, note.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-xl">🔔</span>
          <h3 className="font-extrabold text-base text-black dark:text-white">
            Set Message Reminder
          </h3>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Inspire will notify you with a deep-link directly back to this message.
        </p>

        {/* Message preview snippet */}
        <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs text-gray-700 dark:text-gray-300 italic mb-4 line-clamp-2">
          "{message.content || `[${message.message_type}]`}"
        </div>

        {/* Time Choices */}
        <div className="space-y-2 mb-4">
          {[
            { label: 'In 30 minutes', mins: 30 },
            { label: 'In 1 hour', mins: 60 },
            { label: 'In 3 hours', mins: 180 },
            { label: 'Tomorrow morning (9:00 AM)', mins: 1440 },
          ].map((opt) => (
            <button
              key={opt.mins}
              type="button"
              onClick={() => setSelectedMinutes(opt.mins)}
              className={`w-full p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                selectedMinutes === opt.mins
                  ? 'border-[#0E2A6E] dark:border-[#FFD700] bg-[#0E2A6E]/10 dark:bg-[#FFD700]/15 text-black dark:text-white'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Optional Note */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
            Personal Note (Optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Follow up on design revision…"
            className="w-full px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold text-black dark:text-white focus:outline-none"
          />
        </div>

        <div className="flex space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
          >
            Set Reminder
          </button>
        </div>
      </div>
    </div>
  );
};
