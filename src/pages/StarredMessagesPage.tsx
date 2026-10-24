import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { formatMessageTime } from '../utils/helpers';
import { Message } from '../types';

const SEED_STARRED: Message[] = [
  {
    id: 'star_1',
    sender_id: 'usr_jordan',
    receiver_id: '11111111-1111-4111-8111-111111111111',
    content: 'Cloudflare R2 free tier includes 10GB storage, 1M Class A ops and zero egress fees.',
    message_type: 'text',
    media_url: null,
    media_size: null,
    media_name: null,
    reply_to_id: null,
    is_deleted_sender: false,
    is_deleted_receiver: false,
    is_read: true,
    read_at: null,
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    is_starred: true,
  },
  {
    id: 'star_2',
    sender_id: 'usr_maya',
    receiver_id: '11111111-1111-4111-8111-111111111111',
    content: 'Check out the UI design tokens in 04_UI_UX_Design_Brief.md for accurate brand harmony.',
    message_type: 'text',
    media_url: null,
    media_size: null,
    media_name: null,
    reply_to_id: null,
    is_deleted_sender: false,
    is_deleted_receiver: false,
    is_read: true,
    read_at: null,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    is_starred: true,
  },
];

export const StarredMessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const [starred, setStarred] = useState<Message[]>(SEED_STARRED);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white p-4">
      <div className="max-w-md mx-auto space-y-4">
        <header className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-2">
            <button onClick={() => navigate(-1)} className="p-1 font-bold">←</button>
            <h1 className="font-black text-lg">Starred Messages</h1>
          </div>
          <span className="text-xl">⭐</span>
        </header>

        {starred.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-xs">
            No starred messages yet. Long-press any message and tap ⭐ to save it here.
          </div>
        ) : (
          <div className="space-y-3">
            {starred.map((msg) => (
              <div
                key={msg.id}
                onClick={() => navigate(`/chat/${msg.sender_id}`)}
                className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/20 hover:bg-gray-100 cursor-pointer space-y-2 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <Avatar name={msg.sender_id === 'usr_jordan' ? 'Jordan Lee' : 'Maya Patel'} size="xs" />
                    <span className="font-extrabold">{msg.sender_id === 'usr_jordan' ? 'Jordan Lee' : 'Maya Patel'}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{formatMessageTime(msg.created_at)}</span>
                </div>
                <p className="text-xs leading-relaxed text-gray-800 dark:text-gray-200">
                  {msg.content}
                </p>
                <div className="flex justify-between items-center pt-1 text-[10px] text-[#0E2A6E] dark:text-[#3D6FE0] font-bold">
                  <span>⭐ Bookmarked</span>
                  <span>Jump to chat →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
