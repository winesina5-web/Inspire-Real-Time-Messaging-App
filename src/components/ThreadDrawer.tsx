import React, { useState } from 'react';
import { Message, Profile } from '../types';
import { formatMessageTime } from '../utils/helpers';
import { Avatar } from './Avatar';

interface ThreadDrawerProps {
  rootMessage: Message;
  currentUserId: string;
  partnerProfile?: Profile | null;
  onClose: () => void;
  onSendThreadReply: (text: string) => void;
}

export const ThreadDrawer: React.FC<ThreadDrawerProps> = ({
  rootMessage,
  currentUserId,
  partnerProfile,
  onClose,
  onSendThreadReply,
}) => {
  const [threadText, setThreadText] = useState('');
  const [replies, setReplies] = useState<Array<{ id: string; sender_id: string; content: string; created_at: string }>>([
    {
      id: 'rep_1',
      sender_id: partnerProfile?.id || 'partner',
      content: 'I agree with this point, let us look into the details.',
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
      id: 'rep_2',
      sender_id: currentUserId,
      content: 'Sounds good, sending the updated spec over right now.',
      created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadText.trim()) return;

    const newReply = {
      id: `rep_${Date.now()}`,
      sender_id: currentUserId,
      content: threadText.trim(),
      created_at: new Date().toISOString(),
    };
    setReplies((prev) => [...prev, newReply]);
    onSendThreadReply(threadText.trim());
    setThreadText('');
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-[#161B2B] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A3348] flex flex-col animate-slide-up select-none">
      {/* Header */}
      <div className="p-4 border-b border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-lg">💬</span>
          <h3 className="font-extrabold text-sm text-black dark:text-white">
            Thread Replies
          </h3>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 font-bold flex items-center justify-center"
        >
          ✕
        </button>
      </div>

      {/* Root Quoted Message */}
      <div className="p-3.5 bg-gray-50 dark:bg-gray-900/50 border-b border-[#E5E7EB] dark:border-[#2A3348]">
        <span className="text-[10px] font-black uppercase text-[#0E2A6E] dark:text-[#3D6FE0] block mb-1">
          Original Message
        </span>
        <div className="flex items-start space-x-2.5">
          <Avatar name={rootMessage.sender_id === currentUserId ? 'You' : partnerProfile?.display_name || 'Member'} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-xs text-black dark:text-white">
              {rootMessage.sender_id === currentUserId ? 'You' : partnerProfile?.display_name}
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 leading-relaxed">
              {rootMessage.content || `[${rootMessage.message_type}]`}
            </p>
          </div>
        </div>
      </div>

      {/* Thread Reply Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {replies.map((rep) => {
          const isMine = rep.sender_id === currentUserId;
          return (
            <div key={rep.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs font-medium ${
                  isMine
                    ? 'bg-[#0E2A6E] text-white rounded-br-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white rounded-bl-sm'
                }`}
              >
                <p>{rep.content}</p>
              </div>
              <span className="text-[9px] text-gray-400 mt-1 px-1">
                {formatMessageTime(rep.created_at)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Thread Composer */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#E5E7EB] dark:border-[#2A3348] flex items-center space-x-2">
        <input
          type="text"
          value={threadText}
          onChange={(e) => setThreadText(e.target.value)}
          placeholder="Reply in thread…"
          className="flex-1 px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={!threadText.trim()}
          className="px-3.5 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47] disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
};
