import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Message } from '../types';
import { formatMessageTime } from '../utils/helpers';

const DEMO_PREVIEW_MESSAGES: Message[] = [
  {
    id: 'prev_m1',
    sender_id: 'usr_jordan',
    content: 'Hey Alex! Just pushed the latest real-time presence sync updates to the repository.',
    message_type: 'text',
    media_url: null,
    media_size: null,
    media_name: null,
    reply_to_id: null,
    is_deleted_sender: false,
    is_deleted_receiver: false,
    is_read: true,
    read_at: null,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    reactions: [{ id: 'rx_1', message_id: 'prev_m1', user_id: 'usr_alex', emoji: '🔥', created_at: new Date().toISOString() }],
  },
  {
    id: 'prev_m2',
    sender_id: 'usr_alex',
    content: 'Awesome work! The Cloudflare R2 media upload latency is down to 45ms.',
    message_type: 'text',
    media_url: null,
    media_size: null,
    media_name: null,
    reply_to_id: null,
    is_deleted_sender: false,
    is_deleted_receiver: false,
    is_read: true,
    read_at: null,
    created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    reactions: [],
  },
  {
    id: 'prev_m3',
    sender_id: 'usr_jordan',
    content: 'Check out the new design tokens in dark mode parity — typography and colors look crisp.',
    message_type: 'text',
    media_url: null,
    media_size: null,
    media_name: null,
    reply_to_id: null,
    is_deleted_sender: false,
    is_deleted_receiver: false,
    is_read: true,
    read_at: null,
    created_at: new Date(Date.now() - 1800000).toISOString(),
    reactions: [{ id: 'rx_2', message_id: 'prev_m3', user_id: 'usr_alex', emoji: '✨', created_at: new Date().toISOString() }],
  },
];

export const GuestPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white flex flex-col relative overflow-hidden select-none">
      {/* Inspire Watermark Overlay (Feature 146) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-10 opacity-5 dark:opacity-10 rotate-[-25deg]">
        <span className="text-8xl sm:text-9xl font-black tracking-widest text-[#0E2A6E] dark:text-[#3D6FE0]">
          INSPIRE PREVIEW
        </span>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center font-black text-sm">
            💬
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-black dark:text-white leading-tight">
              Inspire Chat Preview
            </h1>
            <p className="text-[10px] text-gray-500">Read-only shared snapshot • Expires in 48h</p>
          </div>
        </div>

        <Link
          to="/signup"
          className="px-3.5 py-1.5 rounded-full bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47] active:scale-95 transition-transform"
        >
          Sign Up Free
        </Link>
      </header>

      {/* Message Feed */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-3 relative z-20">
        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 font-medium text-center mb-4">
          🔒 You are viewing a verified read-only preview shared via Inspire Messenger.
        </div>

        {DEMO_PREVIEW_MESSAGES.map((msg) => {
          const isSender = msg.sender_id === 'usr_alex';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isSender ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs font-medium shadow-xs ${
                  isSender
                    ? 'bg-[#0E2A6E] dark:bg-[#254BA8] text-white rounded-br-sm'
                    : 'bg-white dark:bg-[#161B2B] text-black dark:text-[#F5F7FA] border border-[#E5E7EB] dark:border-[#2A3348] rounded-bl-sm'
                }`}
              >
                <p className="leading-relaxed">{msg.content}</p>
                <div
                  className={`text-[9px] mt-1 text-right ${
                    isSender ? 'text-white/70' : 'text-gray-400'
                  }`}
                >
                  {formatMessageTime(msg.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </main>

      {/* Bottom Sticky CTA Banner */}
      <footer className="sticky bottom-0 z-30 bg-white/95 dark:bg-[#161B2B]/95 backdrop-blur-md border-t border-[#E5E7EB] dark:border-[#2A3348] p-4 text-center">
        <div className="max-w-md mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-left">
            <h4 className="font-extrabold text-xs text-black dark:text-white">
              Join Inspire to reply and connect
            </h4>
            <p className="text-[11px] text-gray-500">
              Instant delivery, rich voice notes, calls, and AI features.
            </p>
          </div>
          <Link
            to="/signup"
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-[#0E2A6E] text-[#FFD700] text-xs font-black shadow-md hover:bg-[#081B47] active:scale-95 transition-transform"
          >
            Create Your Account →
          </Link>
        </div>
      </footer>
    </div>
  );
};
