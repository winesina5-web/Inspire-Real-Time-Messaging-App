import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isConfigured } from '../lib/supabaseClient';
import { Message, MessageType, Reaction } from '../types';
import { useAuth } from './useAuth';

// Realistic seed messages for offline or interactive preview
const SEED_MESSAGES: Record<string, Message[]> = {
  partner_jordan: [
    {
      id: 'msg_seed_1',
      sender_id: 'usr_jordan',
      receiver_id: '11111111-1111-4111-8111-111111111111',
      content: 'Hey Alex! Did you review the latest real-time architecture specs for Inspire?',
      message_type: 'text',
      media_url: null,
      media_size: null,
      media_name: null,
      reply_to_id: null,
      is_deleted_sender: false,
      is_deleted_receiver: false,
      is_read: true,
      read_at: '2026-10-23T10:00:00Z',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      reactions: [{ id: 'rx_1', message_id: 'msg_seed_1', user_id: '11111111-1111-4111-8111-111111111111', emoji: '👍', created_at: new Date().toISOString() }],
    },
    {
      id: 'msg_seed_2',
      sender_id: '11111111-1111-4111-8111-111111111111',
      receiver_id: 'usr_jordan',
      content: 'Yes! Cloudflare R2 zero-egress storage with Workers AI and Supabase Postgres changes is super clean.',
      message_type: 'text',
      media_url: null,
      media_size: null,
      media_name: null,
      reply_to_id: null,
      is_deleted_sender: false,
      is_deleted_receiver: false,
      is_read: true,
      read_at: '2026-10-23T10:05:00Z',
      created_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      reactions: [{ id: 'rx_2', message_id: 'msg_seed_2', user_id: 'usr_jordan', emoji: '🔥', created_at: new Date().toISOString() }],
    },
    {
      id: 'msg_seed_3',
      sender_id: 'usr_jordan',
      receiver_id: '11111111-1111-4111-8111-111111111111',
      content: 'Agreed! Check out the UI layout I just uploaded.',
      message_type: 'image',
      media_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      media_size: 142000,
      media_name: 'inspire_design_mock.jpg',
      reply_to_id: null,
      is_deleted_sender: false,
      is_deleted_receiver: false,
      is_read: true,
      read_at: '2026-10-23T10:10:00Z',
      created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
      reactions: [],
    },
    {
      id: 'msg_seed_4',
      sender_id: 'usr_jordan',
      receiver_id: '11111111-1111-4111-8111-111111111111',
      content: 'Sent you a quick voice note with ideas for the smart search and summarizer.',
      message_type: 'voice_note',
      media_url: 'https://actions.google.com/sounds/v1/ambiences/outdoor_water_fountain.ogg',
      media_size: 320000,
      media_name: 'voice_note.ogg',
      reply_to_id: null,
      is_deleted_sender: false,
      is_deleted_receiver: false,
      is_read: false,
      read_at: null,
      created_at: new Date(Date.now() - 180000).toISOString(),
      reactions: [],
    },
  ],
};

export function useMessages(partnerId: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  const loadMessages = useCallback(async () => {
    if (!user || !partnerId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    if (!isConfigured) {
      // Local seed messages
      const seeded = SEED_MESSAGES[partnerId] || SEED_MESSAGES.partner_jordan || [];
      setMessages(seeded);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          reply_to:reply_to_id (*),
          reactions (*)
        `)
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.warn('Failed to load messages:', error);
      } else if (data) {
        setMessages(data as Message[]);
      }
    } catch (err) {
      console.warn('Message fetch exception:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, partnerId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime subscription for incoming messages and reactions
  useEffect(() => {
    if (!isConfigured || !user || !partnerId) return;

    const channel = supabase
      .channel(`chat_${user.id}_${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Check if it belongs to this conversation
          const isThisChat =
            (newMsg.sender_id === user.id && newMsg.receiver_id === partnerId) ||
            (newMsg.sender_id === partnerId && newMsg.receiver_id === user.id);

          if (isThisChat) {
            setMessages((prev) => {
              // Avoid duplicates if optimistically added
              if (prev.some((m) => m.id === newMsg.id)) {
                return prev.map((m) => (m.id === newMsg.id ? { ...m, ...newMsg } : m));
              }
              return [...prev, { ...newMsg, reactions: [] }];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reactions',
        },
        () => {
          // Refresh reactions
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, partnerId, loadMessages]);

  const addLocalMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) {
        return prev;
      }
      return [...prev, { ...msg, reactions: msg.reactions || [] }];
    });
  }, []);

  const sendMessage = async (
    content: string,
    messageType: MessageType = 'text',
    mediaDetails?: { url: string; size?: number; name?: string },
    replyToId?: string
  ): Promise<Message | null> => {
    if (!user || !partnerId) return null;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const optimisticMessage: Message = {
      id: tempId,
      sender_id: user.id,
      receiver_id: partnerId,
      content: content || null,
      message_type: messageType,
      media_url: mediaDetails?.url || null,
      media_size: mediaDetails?.size || null,
      media_name: mediaDetails?.name || null,
      reply_to_id: replyToId || null,
      is_deleted_sender: false,
      is_deleted_receiver: false,
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
      reactions: [],
      reply_to: replyToId ? messages.find((m) => m.id === replyToId) || null : null,
    };

    // Optimistic append
    addLocalMessage(optimisticMessage);

    if (!isConfigured) {
      return optimisticMessage;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: partnerId,
          content: content || null,
          message_type: messageType,
          media_url: mediaDetails?.url || null,
          media_size: mediaDetails?.size || null,
          media_name: mediaDetails?.name || null,
          reply_to_id: replyToId || null,
        })
        .select()
        .single();

      if (error) {
        console.warn('Failed to insert message into Supabase:', error);
        return optimisticMessage;
      }

      const savedMessage = data as Message;
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...savedMessage, reactions: [] } : m))
      );
      return savedMessage;
    } catch (err) {
      console.warn('Exception sending message:', err);
      return optimisticMessage;
    }
  };

  const deleteMessage = async (messageId: string, forEveryone: boolean) => {
    if (!user) return;

    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg) return;

    const isSender = targetMsg.sender_id === user.id;

    let updates: Partial<Message>;
    if (forEveryone && isSender) {
      updates = {
        is_deleted_sender: true,
        is_deleted_receiver: true,
        content: null,
      };
    } else {
      updates = isSender ? { is_deleted_sender: true } : { is_deleted_receiver: true };
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, ...updates } : m))
    );

    if (isConfigured) {
      try {
        await supabase.from('messages').update(updates).eq('id', messageId);
      } catch (err) {
        console.warn('Delete message error:', err);
      }
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    const newReaction: Reaction = {
      id: `rx_${Date.now()}`,
      message_id: messageId,
      user_id: user.id,
      emoji,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === messageId) {
          const filtered = (m.reactions || []).filter((r) => r.user_id !== user.id);
          return { ...m, reactions: [...filtered, newReaction] };
        }
        return m;
      })
    );

    if (isConfigured) {
      try {
        await supabase
          .from('reactions')
          .upsert({ message_id: messageId, user_id: user.id, emoji });
      } catch (err) {
        console.warn('Reaction upsert error:', err);
      }
    }
  };

  const markAsRead = useCallback(async () => {
    if (!user || !partnerId) return;

    const hasUnread = messagesRef.current.some(
      (m) => m.sender_id === partnerId && !m.is_read
    );
    if (!hasUnread) return;

    // Mark unread messages sent by partner as read
    setMessages((prev) =>
      prev.map((m) =>
        m.sender_id === partnerId && !m.is_read
          ? { ...m, is_read: true, read_at: new Date().toISOString() }
          : m
      )
    );

    if (isConfigured) {
      try {
        await supabase
          .from('messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('sender_id', partnerId)
          .eq('receiver_id', user.id)
          .eq('is_read', false);
      } catch (err) {
        console.warn('Mark as read error:', err);
      }
    }
  }, [user, partnerId]);

  return {
    messages,
    isLoading,
    sendMessage,
    deleteMessage,
    addReaction,
    markAsRead,
    addLocalMessage,
    refreshMessages: loadMessages,
  };
}
