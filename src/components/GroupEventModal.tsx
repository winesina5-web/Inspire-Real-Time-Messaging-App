import React, { useState } from 'react';
import { GroupEvent } from '../types';

interface GroupEventModalProps {
  currentUserId: string;
  groupId: string;
  onConfirm: (event: GroupEvent) => void;
  onClose: () => void;
}

export const GroupEventModal: React.FC<GroupEventModalProps> = ({
  currentUserId,
  groupId,
  onConfirm,
  onClose,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().slice(0, 16);
  });
  const [location, setLocation] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const event: GroupEvent = {
      id: `evt_${Date.now()}`,
      group_id: groupId,
      title: title.trim(),
      description: description.trim() || 'Join in for our upcoming group meetup!',
      starts_at: new Date(dateStr).toISOString(),
      location: location.trim() || null,
      created_by: currentUserId,
      created_at: new Date().toISOString(),
      rsvps: [
        {
          user_id: currentUserId,
          response: 'going',
          updated_at: new Date().toISOString(),
        },
      ],
    };

    onConfirm(event);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-xl">📅</span>
          <h3 className="font-extrabold text-base text-black dark:text-white">
            Schedule Group Event
          </h3>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Create an event card with interactive RSVPs (Going, Maybe, Not Going).
        </p>

        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase text-black dark:text-white mb-1">
              Event Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Inspire Product Launch 🚀"
              className="w-full px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold text-black dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-black dark:text-white mb-1">
              Date & Time
            </label>
            <input
              type="datetime-local"
              required
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold text-black dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-black dark:text-white mb-1">
              Location / Link (Optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Google Meet or Conference Room B"
              className="w-full px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold text-black dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-black dark:text-white mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief agenda or instructions…"
              className="w-full px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white focus:outline-none resize-none"
            />
          </div>

          <div className="flex space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
            >
              Post Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
