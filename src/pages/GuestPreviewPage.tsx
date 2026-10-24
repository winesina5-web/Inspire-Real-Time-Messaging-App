import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Message } from '../types';
import { formatMessageTime } from '../utils/helpers';
import { supabase, isConfigured } from '../lib/supabaseClient';

export const GuestPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchPreview = async () => {
      setLoading(true);
      if (isConfigured) {
        try {
          const { data: previewData, error: prevErr } = await supabase
            .from('chat_previews')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (prevErr || !previewData) {
            setExpired(true);
            setLoading(false);
            return;
          }

          if (new Date(previewData.expires_at).getTime() < Date.now()) {
            setExpired(true);
            setLoading(false);
            return;
          }

          // Fetch messages
          if (Array.isArray(previewData.message_ids) && previewData.message_ids.length > 0) {
            const { data: msgRows } = await supabase
              .from('messages')
              .select('*')
              .in('id', previewData.message_ids)
              .order('created_at', { ascending: true });

            if (msgRows) {
              setMessages(
                msgRows.map((m: any) => ({
                  id: m.id,
                  sender_id: m.sender_id,
                  receiver_id: m.receiver_id,
                  content: m.content,
                  message_type: m.message_type,
                  media_url: m.media_url,
                  media_size: m.media_size,
                  media_name: m.media_name,
                  reply_to_id: m.reply_to_id,
                  is_deleted_sender: false,
                  is_deleted_receiver: false,
                  is_read: true,
                  read_at: m.read_at,
                  created_at: m.created_at,
                  reactions: [],
                }))
              );
            }
          }
        } catch (err) {
          console.warn('Preview fetch error:', err);
          setExpired(true);
        } finally {
          setLoading(false);
        }
      } else {
        // Fallback demo snapshot for dev inspection
        setMessages([
          {
            id: 'prev_m1',
            sender_id: 'usr_jordan',
            content: 'Real-time messaging with sub-50ms latency across Cloudflare edge nodes.',
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
          },
        ]);
        setLoading(false);
      }
    };

    fetchPreview();
  }, [id]);

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
          className="px-3.5 py-1.5 rounded-full bg-[#0E2A6E] text-white text-xs font-bold shadow-sm hover:bg-[#081B47]"
        >
          Join Inspire
        </Link>
      </header>

      {/* Main Messages Feed */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-4 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : expired ? (
          <div className="text-center py-20 text-gray-500 text-xs space-y-3">
            <div className="text-4xl">⌛</div>
            <p className="font-bold text-sm text-black dark:text-white">This preview has expired or is invalid</p>
            <p>Shared chat previews automatically expire 48 hours after generation.</p>
            <Link to="/login" className="inline-block mt-3 px-4 py-2 rounded-xl bg-[#0E2A6E] text-white font-bold">
              Sign In to Inspire
            </Link>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-xs">
            No messages included in this preview.
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex flex-col space-y-1">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] shadow-xs max-w-[85%] space-y-1">
                <div className="text-xs font-normal leading-relaxed text-black dark:text-white">
                  {m.content}
                </div>
                <div className="text-[10px] text-gray-400 text-right">
                  {formatMessageTime(m.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      {/* Guest Banner */}
      <footer className="sticky bottom-0 z-20 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-t border-[#E5E7EB] dark:border-[#2A3348] p-3 text-center">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <span className="text-xs text-gray-500 font-semibold">Like what you see? Connect with users.</span>
          <Link
            to="/signup"
            className="px-4 py-1.5 rounded-full bg-[#FFD700] text-[#1A1A2E] text-xs font-black shadow-sm"
          >
            Create Account
          </Link>
        </div>
      </footer>
    </div>
  );
};
