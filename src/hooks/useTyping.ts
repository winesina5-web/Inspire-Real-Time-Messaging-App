import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isConfigured } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

export function useTyping(partnerId: string) {
  const { user } = useAuth();
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user || !partnerId || !isConfigured) return;

    const channelName = `typing_${[user.id, partnerId].sort().join('_')}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.sender_id === partnerId) {
          setIsPartnerTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsPartnerTyping(false);
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (sendDebounceRef.current) clearTimeout(sendDebounceRef.current);
      sendDebounceRef.current = null;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [user, partnerId]);

  const notifyTyping = useCallback(() => {
    if (!user || !partnerId || !isConfigured) return;

    if (sendDebounceRef.current) return;

    const channel = channelRef.current;
    if (!channel) return;

    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { sender_id: user.id },
    }).catch((err) => {
      console.warn('Typing broadcast failed:', err);
    });

    sendDebounceRef.current = setTimeout(() => {
      sendDebounceRef.current = null;
    }, 1500);
  }, [user, partnerId]);

  return { isPartnerTyping, notifyTyping };
}
