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

export const GroupChatPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showPollModal, setShowPollModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showEventModal, setShowGroupEventModal] = useState(false);
  const [showSplitModal, setShowPaymentSplitModal] = useState(false);
  const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);

  // Group Slow Mode (Feature 113)
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Only auto-scroll when the newest message changes. Prepending older history
  // must not yank the reader back to the bottom.
  useEffect(() => {
    const newestId = messages[messages.length - 1]?.id || null;
    if (newestId && newestId !== lastMessageIdRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    lastMessageIdRef.current = newestId;
  }, [messages]);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Load group info, membership role, and messages
  useEffect(() => {
    if (!groupId || !user) return;
    setLoading(true);

    const loadGroupData = async () => {
      if (isConfigured) {
        try {
          // Fetch group metadata
          const { data: grpData, error: grpErr } = await supabase
            .from('groups')
            .select('*')
            .eq('id', groupId)
            .single();

          if (grpErr || !grpData) {
            toast('Group not found', 'error');
            navigate('/chats');
            return;
          }

          // Check user membership role
          const { data: memberData } = await supabase
            .from('group_members')
            .select('role')
            .eq('group_id', groupId)
            .eq('user_id', user.id)
            .maybeSingle();

          // Check slow mode settings
          const { data: slowData } = await supabase
            .from('slow_mode_settings')
            .select('interval_seconds')
            .eq('group_id', groupId)
            .maybeSingle();

          const interval = slowData?.interval_seconds || 0;
          setSlowModeSeconds(interval);

          setGroup({
            id: grpData.id,
            name: grpData.name,
            description: grpData.description,
            avatar_url: grpData.avatar_url,
            created_by: grpData.created_by,
            created_at: grpData.created_at,
            members_count: grpData.max_members || 1,
            role: memberData?.role || 'member',
            slow_mode_interval: interval,
          });

          // Fetch the newest page first so large groups don't download their full history.
          const { data: msgRows, error: msgErr } = await supabase
            .from('group_messages')
            .select(`
              id,
              sender_id,
              group_id,
              content,
              message_type,
              media_url,
              media_size,
              media_name,
              reply_to_id,
              is_deleted,
              created_at,
              edited_at,
              thread_reply_count
            `)
            .eq('group_id', groupId)
            .order('created_at', { ascending: false })
            .limit(100);

          if (!msgErr && msgRows) {
            setHasMoreMessages(msgRows.length === 100);
            const latestMessages = msgRows.slice().reverse().map((m: any) => ({
                id: m.id,
                sender_id: m.sender_id,
                group_id: m.group_id,
                content: m.content,
                message_type: m.message_type,
                media_url: m.media_url,
                media_size: m.media_size,
                media_name: m.media_name,
                reply_to_id: m.reply_to_id,
                is_deleted_sender: m.is_deleted,
                is_deleted_receiver: m.is_deleted,
                is_read: true,
                read_at: null,
                created_at: m.created_at,
                edited_at: m.edited_at,
                thread_reply_count: m.thread_reply_count || 0,
                reactions: [],
              }));
            // Preserve realtime messages that may arrive while the initial query is in flight.
            setMessages((current) => {
              const byId = new Map(current.map((message) => [message.id, message]));
              latestMessages.forEach((message) => byId.set(message.id, message));
              return Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
            });
          }
        } catch (err) {
          console.warn('Group load error:', err);
        } finally {
          setLoading(false);
        }
      } else {
        // Fallback placeholder group for dev testing
        setGroup({
          id: groupId,
          name: 'Project Team Chat 🚀',
          description: 'Inspire engineering discussions',
          avatar_url: null,
          created_by: user.id,
          created_at: new Date().toISOString(),
          members_count: 3,
          role: 'admin',
          slow_mode_interval: 0,
        });
        setLoading(false);
      }
    };

    loadGroupData();

    // Supabase Realtime subscription on group_messages
    let subscription: any = null;
    if (isConfigured) {
      const channel = supabase
        .channel(`group_chat_${groupId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
          (payload) => {
            const newM = payload.new as any;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newM.id)) return prev;
              return [
                ...prev,
                {
                  id: newM.id,
                  sender_id: newM.sender_id,
                  group_id: newM.group_id,
                  content: newM.content,
                  message_type: newM.message_type,
                  media_url: newM.media_url,
                  media_size: newM.media_size,
                  media_name: newM.media_name,
                  reply_to_id: newM.reply_to_id,
                  is_deleted_sender: newM.is_deleted,
                  is_deleted_receiver: newM.is_deleted,
                  is_read: true,
                  read_at: null,
                  created_at: newM.created_at,
                  edited_at: newM.edited_at,
                  thread_reply_count: newM.thread_reply_count || 0,
                  reactions: [],
                },
              ];
            });
          }
        )
        .subscribe();

      subscription = channel;
    }

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [groupId, user]);

  const loadOlderMessages = async () => {
    if (!isConfigured || !groupId || loadingOlder || !hasMoreMessages || messages.length === 0) return;
    const oldest = messages[0];
    setLoadingOlder(true);
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select(`
          id, sender_id, group_id, content, message_type, media_url,
          media_size, media_name, reply_to_id, is_deleted, created_at,
          edited_at, thread_reply_count
        `)
        .eq('group_id', groupId)
        .lt('created_at', oldest.created_at)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const older = (data || []).slice().reverse().map((m: any) => ({
        id: m.id,
        sender_id: m.sender_id,
        group_id: m.group_id,
        content: m.content,
        message_type: m.message_type,
        media_url: m.media_url,
        media_size: m.media_size,
        media_name: m.media_name,
        reply_to_id: m.reply_to_id,
        is_deleted_sender: m.is_deleted,
        is_deleted_receiver: m.is_deleted,
        is_read: true,
        read_at: null,
        created_at: m.created_at,
        edited_at: m.edited_at,
        thread_reply_count: m.thread_reply_count || 0,
        reactions: [],
      }));
      setHasMoreMessages((data || []).length === 100);
      setMessages((current) => {
        const seen = new Set(current.map((message) => message.id));
        return [...older.filter((message) => !seen.has(message.id)), ...current]
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    } catch (error) {
      console.warn('Failed to load older group messages:', error);
      toast('Could not load older messages. Please try again.', 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || cooldownRemaining > 0 || !user || !groupId) return;

    const content = inputText.trim();
    setInputText('');

    if (slowModeSeconds > 0) {
      setCooldownRemaining(slowModeSeconds);
    }

    const tempId = `grp_msg_${Date.now()}`;
    const newMsg: Message = {
      id: tempId,
      sender_id: user.id,
      group_id: groupId,
      content,
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
      thread_reply_count: 0,
      reactions: [],
    };

    // Optimistic UI update
    setMessages((prev) => [...prev, newMsg]);

    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('group_messages')
          .insert({
            group_id: groupId,
            sender_id: user.id,
            content,
            message_type: 'text',
          })
          .select()
          .single();

        if (error) {
          toast(error.message, 'error');
          // Revert optimistic message
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        } else if (data) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, id: data.id } : m))
          );
        }
      } catch (err) {
        console.warn('Group send error:', err);
      }
    }
  };

  const handleCreatePoll = async (data: { question: string; options: string[]; allowMultiple: boolean }) => {
    if (!groupId || !user) return;

    const pollMsg: Message = {
      id: `poll_msg_${Date.now()}`,
      sender_id: user.id,
      group_id: groupId,
      content: data.question,
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
      poll_data: {
        id: `poll_${Date.now()}`,
        question: data.question,
        allow_multiple: data.allowMultiple,
        options: data.options.map((opt, idx) => ({ id: `opt_${idx}`, option_text: opt, votes: [] })),
      },
      reactions: [],
    };

    setMessages((prev) => [...prev, pollMsg]);
    setShowPollModal(false);
    toast('Poll created in group chat', 'success');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B0F1A]">
        <div className="w-10 h-10 border-4 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/chats')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ←
          </button>
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setShowInfoModal(true)}>
            <Avatar name={group.name} avatarUrl={group.avatar_url} size="md" />
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="font-extrabold text-sm text-black dark:text-white leading-tight truncate max-w-[180px]">
                  {group.name}
                </h1>
                {slowModeSeconds > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#FFD700] text-[#1A1A2E] text-[9px] font-black" title={`Slow mode active: ${slowModeSeconds}s`}>
                    ⏱ {slowModeSeconds}s
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-500 font-semibold">{group.members_count} members • Group Chat</p>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowGroupEventModal(true)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            title="Schedule Event"
          >
            📅
          </button>
          <button
            onClick={() => setShowPaymentSplitModal(true)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            title="Split Bill"
          >
            💰
          </button>
          <button
            onClick={() => setShowPollModal(true)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            title="Create Poll"
          >
            📊
          </button>
        </div>
      </header>

      {/* Message Feed */}
      <main className="flex-1 max-w-2xl mx-auto w-full p-4 overflow-y-auto space-y-3">
        {hasMoreMessages && (
          <div className="flex justify-center py-2">
            <button
              type="button"
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className="rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 disabled:opacity-50"
            >
              {loadingOlder ? 'Loading older messages…' : 'Load older messages'}
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-xs space-y-2">
            <div className="text-4xl">💬</div>
            <p className="font-semibold text-black dark:text-white">Welcome to {group.name}</p>
            <p>Send the first message or create a poll to kick off discussion.</p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              currentUserId={user?.id || ''}
              onReact={(_msgId, emoji) => {
                toast(`Reacted with ${emoji}`, 'info');
              }}
              onDelete={(_msgId, _forEveryone) => {
                toast('Message deleted', 'info');
              }}
              onReply={(msg) => {
                setInputText(`Replying to: "${msg.content?.slice(0, 30)}..." `);
              }}
              onOpenThread={(msg) => setActiveThreadMessage(msg)}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Composer */}
      <footer className="sticky bottom-0 z-20 bg-white dark:bg-[#0B0F1A] border-t border-[#E5E7EB] dark:border-[#2A3348] p-3">
        <form onSubmit={handleSendMessage} className="max-w-2xl mx-auto flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={cooldownRemaining > 0}
            placeholder={
              cooldownRemaining > 0
                ? `Slow mode: wait ${cooldownRemaining}s...`
                : 'Message the group...'
            }
            className="flex-1 px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold text-black dark:text-white focus:outline-hidden focus:border-[#0E2A6E]"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || cooldownRemaining > 0}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs transition-all ${
              !inputText.trim() || cooldownRemaining > 0
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-[#0E2A6E] text-white hover:bg-[#081B47] active:scale-95'
            }`}
          >
            {cooldownRemaining > 0 ? `${cooldownRemaining}s` : 'Send'}
          </button>
        </form>
      </footer>

      {/* Sub-thread Drawer */}
      {activeThreadMessage && (
        <ThreadDrawer
          rootMessage={activeThreadMessage}
          currentUserId={user?.id || ''}
          onClose={() => setActiveThreadMessage(null)}
          onSendThreadReply={(_text) => {
            toast('Thread reply posted', 'success');
          }}
        />
      )}

      {/* Group Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161B2B] rounded-3xl max-w-sm w-full p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-black dark:text-white">Group Details</h3>
              <button onClick={() => setShowInfoModal(false)} className="text-gray-400 font-bold text-sm">✕</button>
            </div>
            <div className="flex flex-col items-center text-center space-y-2">
              <Avatar name={group.name} avatarUrl={group.avatar_url} size="xl" />
              <h4 className="font-black text-lg">{group.name}</h4>
              <p className="text-xs text-gray-500">{group.description || 'No description set.'}</p>
            </div>
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-xs space-y-2 text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Your Role</span>
                <span className="font-bold uppercase text-[#0E2A6E] dark:text-[#3D6FE0]">{group.role}</span>
              </div>
              <div className="flex justify-between">
                <span>Slow Mode</span>
                <span className="font-bold">{slowModeSeconds > 0 ? `${slowModeSeconds} seconds` : 'Disabled'}</span>
              </div>
            </div>
            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showPollModal && (
        <PollComposerModal
          onClose={() => setShowPollModal(false)}
          onSendPoll={(poll) => {
            handleCreatePoll({
              question: poll.question,
              options: poll.options.map((o) => o.option_text),
              allowMultiple: Boolean(poll.allow_multiple),
            });
          }}
        />
      )}

      {showEventModal && (
        <GroupEventModal
          currentUserId={user?.id || ''}
          groupId={groupId || ''}
          onClose={() => setShowGroupEventModal(false)}
          onConfirm={(eventData) => {
            setShowGroupEventModal(false);
            toast(`Event "${eventData.title}" announced to group`, 'success');
          }}
        />
      )}

      {showSplitModal && (
        <PaymentSplitModal
          currentUserId={user?.id || ''}
          partnerName={group?.name || 'Group'}
          partnerId={groupId || ''}
          onClose={() => setShowPaymentSplitModal(false)}
          onConfirm={(splitData) => {
            setShowPaymentSplitModal(false);
            toast(`Split request "${splitData.title}" posted`, 'success');
          }}
        />
      )}
    </div>
  );
};
