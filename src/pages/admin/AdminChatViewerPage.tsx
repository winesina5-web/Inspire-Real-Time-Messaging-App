import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { Avatar } from '../../components/Avatar';
import { Message, Profile, AdminAuditLog } from '../../types';
import { supabase, isConfigured } from '../../lib/supabaseClient';
import { formatMessageTime } from '../../utils/helpers';

export const AdminChatViewerPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentAdmin, isAdmin } = useAuth();
  const { toast } = useToast();

  const [targetUser, setTargetUser] = useState<Profile | null>(null);
  const [partnerUser, setPartnerUser] = useState<Profile | null>(null);
  const [conversationPartners, setConversationPartners] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Gating: only role === 'admin' allowed
  useEffect(() => {
    if (!isAdmin) {
      toast('Access denied: Administrator privileges required.', 'error');
      navigate('/chats');
    }
  }, [isAdmin, navigate, toast]);

  // Load target user profile and active conversation partners
  useEffect(() => {
    if (!userId || !currentAdmin || !isAdmin) return;

    const loadInspection = async () => {
      setIsLoading(true);

      if (isConfigured) {
        try {
          // 1. Fetch target user
          const { data: targetData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          if (targetData) {
            setTargetUser(targetData as Profile);
          }

          // 2. Discover target user's conversation partners from messages
          const { data: userMsgs } = await supabase
            .from('messages')
            .select('sender_id, receiver_id')
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(100);

          const partnerIds = new Set<string>();
          (userMsgs || []).forEach((m: any) => {
            const pId = m.sender_id === userId ? m.receiver_id : m.sender_id;
            if (pId && pId !== userId) partnerIds.add(pId);
          });

          if (partnerIds.size > 0) {
            const { data: partnerProfiles } = await supabase
              .from('profiles')
              .select('*')
              .in('id', Array.from(partnerIds));

            if (partnerProfiles && partnerProfiles.length > 0) {
              setConversationPartners(partnerProfiles as Profile[]);
              setPartnerUser(partnerProfiles[0] as Profile);
            }
          }

          // 3. Fetch past audit logs for this target user
          const { data: logs } = await supabase
            .from('admin_audit_log')
            .select('*')
            .eq('viewed_user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

          if (logs) {
            setAuditLogs(logs as AdminAuditLog[]);
          }
        } catch (e: any) {
          console.warn('Admin chat viewer inspection error:', e);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    loadInspection();
  }, [userId, currentAdmin, isAdmin]);

  // When partnerUser changes, fetch real conversation and write an audit log
  useEffect(() => {
    if (!userId || !partnerUser || !currentAdmin || !isAdmin) return;

    const loadConversation = async () => {
      // 1. Mandatory Append-Only Audit Log Insert
      if (isConfigured) {
        try {
          const { data: auditData, error: auditErr } = await supabase
            .from('admin_audit_log')
            .insert({
              admin_id: currentAdmin.id,
              viewed_user_id: userId,
              conversation_partner_id: partnerUser.id,
              action: 'view_chat_history',
            })
            .select()
            .single();

          if (!auditErr && auditData) {
            setAuditLogs((prev) => [auditData as AdminAuditLog, ...prev]);
          }
        } catch (err) {
          console.warn('Failed to record admin audit log:', err);
        }

        // 2. Query real conversation messages
        try {
          const { data: msgRows, error: msgErr } = await supabase
            .from('messages')
            .select('*')
            .or(
              `and(sender_id.eq.${userId},receiver_id.eq.${partnerUser.id}),and(sender_id.eq.${partnerUser.id},receiver_id.eq.${userId})`
            )
            .order('created_at', { ascending: true });

          if (!msgErr && msgRows) {
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
                is_deleted_sender: m.is_deleted_sender,
                is_deleted_receiver: m.is_deleted_receiver,
                is_read: m.is_read,
                read_at: m.read_at,
                created_at: m.created_at,
                reactions: [],
              }))
            );
          } else {
            setMessages([]);
          }
        } catch (err) {
          console.warn('Failed to load inspected messages:', err);
        }
      }
    };

    loadConversation();
  }, [userId, partnerUser, currentAdmin, isAdmin]);

  return (
    <AdminSidebar>
      <div className="space-y-6 animate-fade-in">
        {/* Navigation & Warnings */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/admin/users')}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              ←
            </button>
            <div>
              <h1 className="text-xl font-black text-black dark:text-white">
                Chat History Inspection
              </h1>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF]">
                Reviewing communications for safety and compliance
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              🛡️ Audit-Logged Access
            </span>
          </div>
        </div>

        {/* Audit Notification Banner */}
        <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex items-start space-x-3 text-xs text-amber-900 dark:text-amber-200">
          <span className="text-base">⚠️</span>
          <div>
            <p className="font-bold">Strict Audit Protocol Active</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              Opening this conversation record generates an append-only row in the <code>admin_audit_log</code> table
              storing your admin identity, timestamp, and target user IDs. This is required for safety compliance.
            </p>
          </div>
        </div>

        {/* Conversation Partner Selector */}
        {conversationPartners.length > 0 && (
          <div className="bg-white dark:bg-[#161B2B] p-4 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
              Select Conversation with @{targetUser?.username}:
            </span>
            <div className="flex flex-wrap gap-2">
              {conversationPartners.map((partner) => (
                <button
                  key={partner.id}
                  onClick={() => setPartnerUser(partner)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    partnerUser?.id === partner.id
                      ? 'bg-[#0E2A6E] text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {partner.display_name} (@{partner.username})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Transcript Stage */}
        <div className="bg-white dark:bg-[#161B2B] rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm overflow-hidden flex flex-col h-[520px]">
          {/* Transcript Header */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-[#1A2234] border-b border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar name={targetUser?.display_name || 'Target'} size="sm" />
              <div>
                <span className="text-xs font-black text-black dark:text-white block">
                  {targetUser?.display_name} (@{targetUser?.username})
                </span>
                <span className="text-[10px] text-gray-400">
                  Inspected Account • Status: {targetUser?.status}
                </span>
              </div>
            </div>

            <div className="text-xs font-bold text-gray-500">
              Partner: {partnerUser ? `${partnerUser.display_name} (@${partnerUser.username})` : 'None selected'}
            </div>
          </div>

          {/* Transcript Messages Feed */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-white dark:bg-[#0B0F1A]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-3 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs space-y-2">
                <span className="text-4xl">📭</span>
                <p className="font-bold text-black dark:text-white">No messages found between these participants</p>
                <p>Select another partner above or verify user activity.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isTargetSender = msg.sender_id === userId;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isTargetSender ? 'items-start' : 'items-end'}`}
                  >
                    <div className="text-[10px] font-bold text-gray-400 mb-1 px-1">
                      {isTargetSender ? `@${targetUser?.username}` : `@${partnerUser?.username || 'partner'}`}
                    </div>
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                        isTargetSender
                          ? 'bg-gray-100 dark:bg-[#1A2234] text-black dark:text-white border border-[#E5E7EB] dark:border-[#2A3348]'
                          : 'bg-[#0E2A6E] text-white'
                      }`}
                    >
                      {msg.content}
                      <div
                        className={`text-[9px] text-right mt-1.5 ${
                          isTargetSender ? 'text-gray-400' : 'text-blue-200'
                        }`}
                      >
                        {formatMessageTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-white dark:bg-[#161B2B] p-5 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#4B5563] dark:text-[#9CA3AF]">
            Recent Audit Access Trail for this Target
          </h2>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-gray-400">No prior audit access rows recorded for this target.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-bold text-black dark:text-white">{log.action}</span>
                    <span className="text-gray-400">• Admin ID: {log.admin_id.slice(0, 8)}…</span>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminSidebar>
  );
};
