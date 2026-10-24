import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { useToast } from '../../components/Toast';
import { Report, ReportStatus } from '../../types';
import { supabase, isConfigured } from '../../lib/supabaseClient';

const SEED_REPORTS: Report[] = [
  {
    id: 'rep_1',
    reporter_id: '11111111-1111-4111-8111-111111111111',
    reported_user_id: 'usr_bad_actor',
    reported_message_id: 'msg_flagged_101',
    reason: 'Spam or harmful behavior',
    note: 'Repeatedly sending unwanted promotional links in DM',
    status: 'open',
    moderation_verdict: 'flagged_commercial_spam',
    moderation_confidence: 0.94,
    resolved_by: null,
    resolved_at: null,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    reporter: {
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
    },
    reported_user: {
      id: 'usr_bad_actor',
      username: 'spammer_99',
      display_name: 'Bad Actor',
      bio: null,
      avatar_url: null,
      role: 'user',
      status: 'suspended',
      is_online: false,
      last_seen: '2026-10-18T10:00:00Z',
      created_at: '2026-10-15T08:00:00Z',
    },
    reported_message: {
      id: 'msg_flagged_101',
      sender_id: 'usr_bad_actor',
      receiver_id: '11111111-1111-4111-8111-111111111111',
      content: 'Click here to claim free crypto bonus right now! http://shady-link.example.com',
      message_type: 'text',
      media_url: null,
      media_size: null,
      media_name: null,
      reply_to_id: null,
      is_deleted_sender: false,
      is_deleted_receiver: false,
      is_read: true,
      read_at: null,
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
  },
  {
    id: 'rep_2',
    reporter_id: 'usr_jordan',
    reported_user_id: 'usr_maya',
    reported_message_id: null,
    reason: 'Profile impersonation inquiry',
    note: 'Verifying if this is the genuine Maya from design team',
    status: 'open',
    moderation_verdict: 'safe_legitimate',
    moderation_confidence: 0.99,
    resolved_by: null,
    resolved_at: null,
    created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
    reporter: {
      id: 'usr_jordan',
      username: 'jordan_ai',
      display_name: 'Jordan Lee',
      bio: null,
      avatar_url: null,
      role: 'user',
      status: 'active',
      is_online: true,
      last_seen: new Date().toISOString(),
      created_at: '2026-01-15T09:00:00Z',
    },
    reported_user: {
      id: 'usr_maya',
      username: 'maya_tech',
      display_name: 'Maya Patel',
      bio: null,
      avatar_url: null,
      role: 'user',
      status: 'active',
      is_online: true,
      last_seen: new Date().toISOString(),
      created_at: '2026-02-01T11:00:00Z',
    },
  },
];

export const AdminReportsPage: React.FC = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>(SEED_REPORTS);
  const [filterStatus, setFilterStatus] = useState<ReportStatus>('open');

  useEffect(() => {
    if (!isConfigured) return;

    const fetchReports = async () => {
      try {
        const { data } = await supabase
          .from('reports')
          .select(`
            *,
            reporter:reporter_id (*),
            reported_user:reported_user_id (*),
            reported_message:reported_message_id (*)
          `)
          .order('created_at', { ascending: false });

        if (data) {
          setReports(data as Report[]);
        }
      } catch (err) {
        console.warn('Reports fetch error:', err);
      }
    };

    fetchReports();
  }, []);

  const handleUpdateStatus = async (reportId: string, newStatus: ReportStatus) => {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
    );

    if (isConfigured) {
      try {
        await supabase
          .from('reports')
          .update({ status: newStatus, resolved_at: new Date().toISOString() })
          .eq('id', reportId);
      } catch (e: unknown) {
        console.warn('Report update error:', e);
      }
    }

    toast(`Report marked as ${newStatus}`, 'success');
  };

  const handleDeleteMessage = async (reportId: string, messageId?: string) => {
    if (messageId && isConfigured) {
      try {
        await supabase.from('messages').delete().eq('id', messageId);
      } catch (e: unknown) {
        console.warn('Delete message error:', e);
      }
    }
    await handleUpdateStatus(reportId, 'resolved');
    toast('Offending message removed from database', 'info');
  };

  const handleSuspendUser = async (reportId: string, userId: string) => {
    if (isConfigured) {
      try {
        await supabase.from('profiles').update({ status: 'suspended' }).eq('id', userId);
      } catch (e: unknown) {
        console.warn('Suspend user error:', e);
      }
    }
    await handleUpdateStatus(reportId, 'resolved');
    toast('Reported user suspended app-wide', 'success');
  };

  const filtered = reports.filter((r) => r.status === filterStatus);

  return (
    <AdminSidebar>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">
              Safety Reports
            </h1>
            <p className="text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
              Review user-flagged content with AI moderation verdicts
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex rounded-2xl bg-white dark:bg-[#161B2B] p-1 border border-[#E5E7EB] dark:border-[#2A3348]">
            {(['open', 'resolved', 'dismissed'] as ReportStatus[]).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-4 py-1.5 rounded-xl text-xs font-extrabold capitalize transition-all ${
                  filterStatus === st
                    ? 'bg-[#0E2A6E] text-white shadow-sm'
                    : 'text-[#4B5563] dark:text-[#9CA3AF] hover:text-black dark:hover:text-white'
                }`}
              >
                {st} ({reports.filter((r) => r.status === st).length})
              </button>
            ))}
          </div>
        </div>

        {/* Reports List */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-[#161B2B] p-12 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] text-center">
            <span className="text-4xl block mb-2">🎉</span>
            <h4 className="font-bold text-sm text-black dark:text-white">
              No {filterStatus} reports
            </h4>
            <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-1">
              Inspire community is clean and safe.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((report) => (
              <div
                key={report.id}
                className="bg-white dark:bg-[#161B2B] p-6 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4"
              >
                {/* Report Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-black">
                      {report.reason}
                    </span>
                    <span className="text-xs text-[#4B5563] dark:text-[#9CA3AF]">
                      Reported {new Date(report.created_at).toLocaleString()}
                    </span>
                  </div>

                  {report.moderation_verdict && (
                    <div className="flex items-center space-x-1.5 bg-[#FFD700]/20 px-3 py-1 rounded-full text-xs font-bold text-[#1A1A2E] dark:text-[#FFD700]">
                      <span>✨ AI Verdict:</span>
                      <strong className="underline">{report.moderation_verdict}</strong>
                      {report.moderation_confidence && (
                        <span>({Math.round(report.moderation_confidence * 100)}%)</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Reporter vs Reported info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-2xl">
                    <span className="font-bold text-gray-500 uppercase text-[10px] block mb-1">
                      Reporter
                    </span>
                    <p className="font-black text-black dark:text-white">
                      {report.reporter?.display_name || 'Anonymous User'} (@{report.reporter?.username || 'user'})
                    </p>
                    {report.note && (
                      <p className="mt-1 text-gray-600 dark:text-gray-300 italic">
                        "{report.note}"
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-2xl">
                    <span className="font-bold text-gray-500 uppercase text-[10px] block mb-1">
                      Reported Account
                    </span>
                    <p className="font-black text-black dark:text-white">
                      {report.reported_user?.display_name || 'Unknown User'} (@{report.reported_user?.username || 'user'})
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      User Status: {report.reported_user?.status}
                    </p>
                  </div>
                </div>

                {/* Attached Message Preview if reported message */}
                {report.reported_message && (
                  <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/60 text-xs">
                    <span className="font-black text-rose-700 dark:text-rose-400 block mb-1 text-[10px] uppercase">
                      Reported Message Content:
                    </span>
                    <p className="font-medium text-black dark:text-white">
                      {report.reported_message.content || `[${report.reported_message.message_type}]`}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                {report.status === 'open' && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={() => handleUpdateStatus(report.id, 'dismissed')}
                      className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Dismiss Report
                    </button>

                    <button
                      onClick={() => handleUpdateStatus(report.id, 'resolved')}
                      className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-xs font-bold text-black dark:text-white hover:bg-gray-300"
                    >
                      Warn User (Note)
                    </button>

                    {report.reported_message_id && (
                      <button
                        onClick={() => handleDeleteMessage(report.id, report.reported_message_id || undefined)}
                        className="px-4 py-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-200"
                      >
                        Delete Message
                      </button>
                    )}

                    <button
                      onClick={() => handleSuspendUser(report.id, report.reported_user_id)}
                      className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black hover:bg-rose-700 shadow-sm"
                    >
                      Suspend Reported User
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminSidebar>
  );
};
