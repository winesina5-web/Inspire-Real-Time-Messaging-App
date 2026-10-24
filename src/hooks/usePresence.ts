import { useState, useEffect, useCallback } from 'react';
import { supabase, isConfigured } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

export function usePresence() {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set(['usr_jordan', 'usr_maya']));

  useEffect(() => {
    if (!user) return;

    if (!isConfigured) {
      setOnlineUserIds((prev) => new Set([...prev, user.id]));
      return;
    }

    const room = supabase.channel('online_presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    room
      .on('presence', { event: 'sync' }, () => {
        const state = room.presenceState();
        const ids = new Set<string>();
        Object.keys(state).forEach((key) => ids.add(key));
        setOnlineUserIds(ids);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUserIds((prev) => new Set([...prev, key]));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await room.track({
            online_at: new Date().toISOString(),
            user_id: user.id,
          });
          // Update profile snapshot
          try {
            await supabase
              .from('profiles')
              .update({ is_online: true, last_seen: new Date().toISOString() })
              .eq('id', user.id);
          } catch {
            // ignore
          }
        }
      });

    return () => {
      room.untrack().catch(() => {});
      supabase.removeChannel(room);
      // Mark offline on unmount
      try {
        supabase
          .from('profiles')
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq('id', user.id);
      } catch {
        // ignore
      }
    };
  }, [user]);

  const isOnline = useCallback(
    (userId: string) => {
      return onlineUserIds.has(userId);
    },
    [onlineUserIds]
  );

  return { onlineUserIds, isOnline };
}
