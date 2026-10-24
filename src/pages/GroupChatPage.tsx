import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { Avatar } from '../components/Avatar';
import { MessageBubble } from '../components/MessageBubble';
import { PollComposerModal } from '../components/PollComposerModal';
import { ThreadDrawer } from '../components/ThreadDrawer';
import { GroupEventModal } from '../components/GroupEventModal';
import { PaymentSplitModal } from '../components/PaymentSplitModal';
import { Group, Message, Profile, PollData, GroupEvent, PaymentSplit } from '../types';
import { supabase, isConfigured } from '../lib/supabaseClient';

const SEED_GROUP: Group = {
  id: 'grp_eng_core',
  name: 'Inspire Core Engineering 🚀',
  description: 'Architecture, real-time messaging sync, and Cloudflare R2 media pipelines',
  avatar_url: null,
  created_by: '11111111-1111-4111-8111-111111111111',
  created_at: '2026-02-01T10:00:00Z',
  members_count: 5,
  role: 'admin',
  slow_mode_interval: 5,
};

const SEED_GROUP_MESSAGES: Message[] = [
  {
    id: 'grp_msg_1',
    sender_id: 'usr_jordan',
    group_id: 'grp_eng_core',
    content: 'Welcome everyone to the Inspire Core Engineering group! Testing group broadcast channel.',
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
    thread_reply_count: 2,
    reactions: [{ id: 'rx_g1', message_id: 'grp_msg_1', user_id: '11111111-1111-4111-8111-111111111111', emoji: '🙌', created_at: new Date().toISOString() }],
  },
  {
    id: 'grp_msg_2',
    sender_id: 'usr_maya',
    group_id: 'grp_eng_core',
    content: 'Should we prioritize interactive polls and custom bubble tints for this release?',
    message_type: 'poll',
    media_url: null,
    media_size: null,
    media_name: null,
    reply_to_id: null,
    is_deleted_sender: false,
    is_deleted_receiver: false,
    is_read: true,
    read_at: null,
    created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    poll_data: {
      id: 'poll_101',
      question: 'Which advanced feature is your top favorite?',
      allow_multiple: false,
      options: [
        { id: 'opt_1', option_text: 'Polls & Group Collaboration', votes: ['usr_jordan', '11111111-1111-4111-8111-111111111111'] },
        { id: 'opt_2', option_text: 'Voice/Video Calling & Screen Share', votes: ['usr_maya'] },
        { id: 'opt_3', option_text: 'Secret Chats & View-Once Media', votes: [] },
      ],
    },
  },
];

export const GroupChatPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [group, setGroup] = useState<Group>(SEED_GROUP);
  const [messages, setMessages] = useState<Message[]>(SEED_GROUP_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [showPollModal, setShowPollModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showEventModal, setShowGroupEventModal] = useState(false);
  const [showSplitModal, setShowPaymentSplitModal] = useState(false);
  const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);

  // Feature 113: Group Slow Mode
  const [slowModeSeconds, setSlowModeSeconds] = useState(group.slow_mode_interval || 0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !user) return;
    if (cooldownRemaining > 0) {
      toast(`Slow mode active: wait ${cooldownRemaining}s before sending.`, 'info');
      return;
    }

    const newMsg: Message = {
      id: `grp_msg_${Date.now()}`,
      sender_id: user.id,
      group_id: groupId || 'grp_eng_core',
      content: inputText.trim(),
      message_type: 'text',
      media_url: null,
      media_size: null,
      media_name: null,
      reply_to_id: null,
      is_deleted_sender: false,
      is_deleted_receiver: false,
      is_read: true,
      read_at: null,
      created_at: new Date().toISOString(),
      reactions: [],
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    if (slowModeSeconds > 0) {
      setCooldownRemaining(slowModeSeconds);
    }
  };

  const handleVotePoll = (messageId: string, optionId: string) => {
    if (!user) return;

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || !msg.poll_data) return msg;

        const updatedOptions = msg.poll_data.options.map((opt) => {
          const hasVoted = opt.votes.includes(user.id);
          if (opt.id === optionId) {
            return {
              ...opt,
              votes: hasVoted ? opt.votes.filter((id) => id !== user.id) : [...opt.votes, user.id],
            };
          } else if (!msg.poll_data?.allow_multiple) {
            return {
              ...opt,
              votes: opt.votes.filter((id) => id !== user.id),
            };
          }
          return opt;
        });

        return {
          ...msg,
          poll_data: {
            ...msg.poll_data,
            options: updatedOptions,
          },
        };
      })
    );

    toast('Poll vote registered in group!', 'info');
  };

  const handleSendPoll = (poll: PollData) => {
    if (!user) return;
    const pollMsg: Message = {
      id: `grp_poll_${Date.now()}`,
      sender_id: user.id,
      group_id: groupId || 'grp_eng_core',
      content: null,
      message_type: 'poll',
      media_url: null,
      media_size: null,
      media_name: null,
      reply_to_id: null,
      is_deleted_sender: false,
      is_deleted_receiver: false,
      is_read: true,
      read_at: null,
      created_at: new Date().toISOString(),
      poll_data: poll,
      reactions: [],
    };
    setMessages((prev) => [...prev, pollMsg]);
    toast('Poll published to group!', 'success');
  };

  const handleSendEvent = (event: GroupEvent) => {
    if (!user) return;
    const eventMsg: Message = {
      id: `grp_evt_${Date.now()}`,
      sender_id: user.id,
      group_id: groupId || 'grp_eng_core',
      content: null,
      message_type: 'event',
      event_data: event,
      media_url: null,
      media_size: null,
      media_name: null,
      reply_to_id: null,
      is_deleted_sender: false,
      is_deleted_receiver: false,
      is_read: true,
      read_at: null,
      created_at: new Date().toISOString(),
      reactions: [],
    };
    setMessages((prev) => [...prev, eventMsg]);
    setShowGroupEventModal(false);
    toast('Group event published!', 'success');
  };

  const handleSendSplit = (split: PaymentSplit) => {
    if (!user) return;
    const splitMsg: Message = {
      id: `grp_spl_${Date.now()}`,
      sender_id: user.id,
      group_id: groupId || 'grp_eng_core',
      content: null,
      message_type: 'split',
      split_data: split,
      media_url: null,
      media_size: null,
      media_name: null,
      reply_to_id: null,
      is_deleted_sender: false,
      is_deleted_receiver: false,
      is_read: true,
      read_at: null,
      created_at: new Date().toISOString(),
      reactions: [],
    };
    setMessages((prev) => [...prev, splitMsg]);
    setShowPaymentSplitModal(false);
    toast('Group expense split card sent!', 'success');
  };

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-white dark:bg-[#0B0F1A] text-black dark:text-white overflow-hidden">
      {/* Group Header */}
      <header className="flex-shrink-0 z-30 bg-white dark:bg-[#0B0F1A] border-b border-[#E5E7EB] dark:border-[#2A3348] px-3 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-2.5 min-w-0">
          <button onClick={() => navigate('/chats')} className="p-1.5 -ml-1 text-black dark:text-white font-bold" aria-label="Back">
            ←
          </button>
          <div
            onClick={() => setShowInfoModal(true)}
            className="flex items-center space-x-2.5 cursor-pointer min-w-0"
          >
            <Avatar name={group.name} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center space-x-1">
                <h2 className="font-extrabold text-sm text-black dark:text-white truncate">
                  {group.name}
                </h2>
                {slowModeSeconds > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold" title={`Slow mode: ${slowModeSeconds}s`}>
                    ⏱ {slowModeSeconds}s
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] truncate">
                {group.members_count || 5} members • Tap for info
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowInfoModal(true)}
          className="p-2 text-sm font-bold text-gray-500 hover:text-black dark:hover:text-white"
          title="Group info & settings"
        >
          ℹ️
        </button>
      </header>

      {/* Messages Canvas */}
      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-white dark:bg-[#0B0F1A]">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            currentUserId={user?.id || ''}
            onReply={() => {}}
            onDelete={(id) => setMessages((prev) => prev.filter((m) => m.id !== id))}
            onReact={(id, emoji) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === id
                    ? {
                        ...m,
                        reactions: [
                          ...(m.reactions || []).filter((r) => r.user_id !== user?.id),
                          { id: `rx_${Date.now()}`, message_id: id, user_id: user?.id || 'me', emoji, created_at: new Date().toISOString() },
                        ],
                      }
                    : m
                )
              );
            }}
            onVotePoll={handleVotePoll}
            onOpenThread={(m) => setActiveThreadMessage(m)}
          />
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Bottom Composer */}
      <footer className="p-3 bg-white dark:bg-[#0B0F1A] border-t border-[#E5E7EB] dark:border-[#2A3348]">
        {cooldownRemaining > 0 && (
          <div className="text-[10px] text-amber-500 font-bold mb-1.5 text-center">
            ⏱ Slow mode: You can send a message in {cooldownRemaining}s
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowPollModal(true)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-lg"
            title="Create Poll"
          >
            📊
          </button>
          <button
            type="button"
            onClick={() => setShowGroupEventModal(true)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-lg"
            title="Create Group Event"
          >
            📅
          </button>
          <button
            type="button"
            onClick={() => setShowPaymentSplitModal(true)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-lg"
            title="Split Bill"
          >
            💰
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message group or mention @name…"
            disabled={cooldownRemaining > 0}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium text-sm focus:outline-none focus:border-[#0E2A6E] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={cooldownRemaining > 0 || !inputText.trim()}
            className="w-10 h-10 rounded-full bg-[#0E2A6E] text-white flex items-center justify-center font-black shadow-md hover:bg-[#081B47] disabled:opacity-40"
          >
            ➤
          </button>
        </form>
      </footer>

      {/* Poll Composer Modal */}
      {showPollModal && (
        <PollComposerModal
          onSendPoll={handleSendPoll}
          onClose={() => setShowPollModal(false)}
        />
      )}

      {/* Group Event Modal */}
      {showEventModal && (
        <GroupEventModal
          currentUserId={user?.id || 'me'}
          groupId={groupId || 'grp_eng_core'}
          onConfirm={handleSendEvent}
          onClose={() => setShowGroupEventModal(false)}
        />
      )}

      {/* Bill Split Modal */}
      {showSplitModal && (
        <PaymentSplitModal
          currentUserId={user?.id || 'me'}
          partnerName={group.name}
          partnerId={groupId || 'grp_eng_core'}
          onConfirm={handleSendSplit}
          onClose={() => setShowPaymentSplitModal(false)}
        />
      )}

      {/* Thread Drawer */}
      {activeThreadMessage && (
        <ThreadDrawer
          rootMessage={activeThreadMessage}
          currentUserId={user?.id || ''}
          partnerProfile={null}
          onClose={() => setActiveThreadMessage(null)}
          onSendThreadReply={(txt) => {
            toast('Thread reply sent!', 'success');
          }}
        />
      )}

      {/* Group Info Modal with Feature 113 Slow Mode & Feature 111 Bots */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
          <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-extrabold text-sm text-black dark:text-white">Group Settings & Members</h3>
              <button onClick={() => setShowInfoModal(false)} className="p-1 text-gray-400 font-bold">✕</button>
            </div>
            <div className="text-center space-y-2">
              <Avatar name={group.name} size="lg" className="mx-auto" />
              <h4 className="font-black text-base text-black dark:text-white">{group.name}</h4>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF]">{group.description}</p>
            </div>

            {/* Feature 113: Slow Mode Setting (Admin) */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-2xl text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-black dark:text-white">⏱ Slow Mode</span>
                <select
                  value={slowModeSeconds}
                  onChange={(e) => {
                    const sec = parseInt(e.target.value, 10);
                    setSlowModeSeconds(sec);
                    toast(sec > 0 ? `Slow mode set to ${sec}s` : 'Slow mode disabled', 'info');
                  }}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-[#1A2234] border border-gray-200 dark:border-gray-700 text-xs font-bold text-black dark:text-white"
                >
                  <option value="0">Off (No Delay)</option>
                  <option value="5">5 Seconds</option>
                  <option value="30">30 Seconds</option>
                  <option value="60">1 Minute</option>
                  <option value="300">5 Minutes</option>
                </select>
              </div>
              <p className="text-[10px] text-gray-500">Each member can only send 1 message per interval.</p>
            </div>

            {/* Feature 111: Bots in group */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-gray-500 uppercase text-[10px]">Active Bots (1)</div>
              <div className="flex items-center space-x-2 pt-1">
                <span className="text-base">🤖</span>
                <div>
                  <div className="font-bold text-black dark:text-white">Inspire CI/CD Webhook Bot</div>
                  <div className="text-[10px] text-gray-400">Keyword: /deploy, /status</div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-gray-500 uppercase text-[10px]">Members (5)</div>
              <p className="font-bold text-black dark:text-white">👑 Alex Rivera (Group Creator)</p>
              <p className="text-gray-700 dark:text-gray-300">Jordan Lee • Maya Patel • Sam Miller</p>
            </div>

            <button
              onClick={() => {
                toast('Left group', 'info');
                setShowInfoModal(false);
                navigate('/chats');
              }}
              className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 text-xs font-bold"
            >
              Leave Group
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
