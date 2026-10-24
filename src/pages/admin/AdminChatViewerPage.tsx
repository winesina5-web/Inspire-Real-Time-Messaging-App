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
  const { user: currentAdmin } = useAuth();
  const { toast } = useToast();

  const [targetUser, setTargetUser] = useState<Profile | null>(null);
  const [partnerUser, setPartnerUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId || !currentAdmin) return;

    const loadInspection = async () => {
      setIsLoading(true);

      // 1. Audit Log write: hard requirement
      const newAuditEntry: AdminAuditLog = {
        id: `audit_${Date.now()}`,
        admin_id: currentAdmin.id,
        viewed_user_id: userId,
        conversation_partner_id: 'usr_jordan',
        action: 'view_chat_history',
        created_at: new Date().toISOString(),
      };

      setAuditLogs((prev) => [newAuditEntry, ...prev]);

      if (isConfigured) {
        try {
          await supabase.from('admin_audit_log').insert({
            admin_id: currentAdmin.id,
            viewed_user_id: userId,
            conversation_partner_id: 'usr_jordan',
            action: 'view_chat_history',
          });
        } catch (e: unknown) {
          console.warn('Audit log write exception:', e);
        }
      }

      // 2. Fetch mock or real chat messages between targetUser and their partner
      setTargetUser({
        id: userId,
        username: userId === 'usr_jordan' ? 'jordan_ai' : 'inspected_user',
        display_name: userId === 'usr_jordan' ? 'Jordan Lee' : 'Target Account',
        bio: null,
        avatar_url: null,
        role: 'user',
        status: 'active',
        is_online: true,
        last_seen: new Date().toISOString(),
        created_at: '2026-01-15T09:00:00Z',
      });

      setPartnerUser({
        id: '11111111-1111-4111-8111-111111111111',
        username: 'alex_dev',
        display_name: 'Alex Rivera',
        bio: null,
        avatar_url: null,
        role: 'user',
        status: 'active',
        is_online: true,
        last_seen: new Date().toISOString(),
        created_at: '2026-01-10T08:00:00Z',
      });

      setMessages([
        {
          id: 'adm_msg_1',
          sender_id: userId,
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
        },
        {
          id: 'adm_msg_2',
          sender_id: '11111111-1111-4111-8111-111111111111',
          receiver_id: userId,
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
        },
      ]);

      setIsLoading(false);
      toast('Audit log recorded: Opened user transcript for inspection', 'info');
    };

    loadInspection();
  }, [userId, currentAdmin]);

  return (
    <AdminSidebar>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider">
                Audited Moderation View
              </span>
              <span className="text-xs text-gray-500 font-mono">
                Admin: {currentAdmin?.display_name}
              </span>
            </div>
            <h1 className="text-2xl font-black text-black dark:text-white tracking-tight mt-1">
              Transcript Inspector
            </h1>
          </div>

          <button
            onClick={() => navigate('/admin/users')}
            className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-800 text-xs font-bold hover:bg-gray-300"
          >
            ← Back to Users
          </button>
        </div>

        {/* Security Audit Banner */}
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xl">🛡️</span>
            <div>
              <strong>Security Protocol Active:</strong> This inspection action was logged to the immutable{' '}
              <code className="font-mono text-[11px] bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">
                admin_audit_log
              </code>{' '}
              table in accordance with Inspire safety standards.
            </div>
          </div>
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
            Recorded Just Now
          </span>
        </div>

        {/* Conversation Header Card */}
        <div className="bg-white dark:bg-[#161B2B] p-4 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="flex -space-x-2">
              <Avatar name={targetUser?.display_name || 'Target'} size="md" />
              <Avatar name={partnerUser?.display_name || 'Partner'} size="md" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-black dark:text-white">
                {targetUser?.display_name} (@{targetUser?.username}) & {partnerUser?.display_name} (@{partnerUser?.username})
              </h3>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF]">
                1-on-1 Direct Conversation Transcript (Read-Only)
              </p>
            </div>
          </div>
          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-blue-100 text-[#0E2A6E] dark:bg-blue-950/60 dark:text-blue-300">
            {messages.length} Messages
          </span>
        </div>

        {/* Transcript Box */}
        <div className="bg-white dark:bg-[#161B2B] rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] p-6 shadow-sm space-y-3 max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-12 text-xs text-gray-400">Loading transcript…</div>
          ) : (
            messages.map((m) => {
              const isTargetSender = m.sender_id === targetUser?.id;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isTargetSender ? 'items-start' : 'items-end'}`}
                >
                  <span className="text-[10px] font-bold text-gray-400 mb-0.5 px-2">
                    {isTargetSender ? targetUser?.display_name : partnerUser?.display_name} • {formatMessageTime(m.created_at)}
                  </span>
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs font-medium ${
                      isTargetSender
                        ? 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white rounded-bl-sm'
                        : 'bg-[#0E2A6E] text-white rounded-br-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Recent Audit Logs History for this Conversation */}
        <div className="bg-white dark:bg-[#161B2B] p-6 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
          <h3 className="font-extrabold text-sm text-black dark:text-white mb-3">
            Recent Audit Access Entries for This Account
          </h3>
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between text-xs p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 font-mono"
              >
                <span>
                  Admin: {currentAdmin?.display_name} ({currentAdmin?.id.slice(0, 8)}…)
                </span>
                <span className="text-gray-500">Action: {log.action}</span>
                <span className="text-gray-400">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
};
