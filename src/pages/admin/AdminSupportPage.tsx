import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { SupportTicket, SupportMessage } from '../../types';

export const AdminSupportPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');

  const [tickets, setTickets] = useState<SupportTicket[]>(() => {
    // Scan localStorage or default seed
    const allTkts: SupportTicket[] = [
      {
        id: 'tkt_001',
        user_id: 'usr_jordan',
        subject: '[BUG] Cannot activate screen share on mobile Chrome',
        status: 'open',
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        messages_count: 2,
      },
      {
        id: 'tkt_002',
        user_id: '11111111-1111-4111-8111-111111111111',
        subject: '[CALLS] WebRTC TURN server connection timeout in office WiFi',
        status: 'in_progress',
        created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
        messages_count: 3,
      },
      {
        id: 'tkt_003',
        user_id: 'usr_sam',
        subject: '[ACCOUNT] Request username alias change to @samuel_ai',
        status: 'resolved',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        messages_count: 4,
      },
    ];
    return allTkts;
  });

  const loadTicketMessages = (ticketId: string) => {
    const saved = localStorage.getItem(`inspire_support_msgs_${ticketId}`);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
        return;
      } catch {
        // fallback
      }
    }

    const defaultMsgs: SupportMessage[] = [
      {
        id: `smsg_${ticketId}_1`,
        ticket_id: ticketId,
        sender_id: 'usr_jordan',
        is_admin: false,
        content:
          'When I tap on Screen Share in video calls from Android Chrome, it says not supported.',
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
    ];
    setMessages(defaultMsgs);
  };

  const handleSelectTicket = (tkt: SupportTicket) => {
    setSelectedTicket(tkt);
    loadTicketMessages(tkt.id);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    const newMsg: SupportMessage = {
      id: `smsg_${Date.now()}`,
      ticket_id: selectedTicket.id,
      sender_id: user?.id || 'admin',
      is_admin: true,
      content: replyText.trim(),
      created_at: new Date().toISOString(),
    };

    const updated = [...messages, newMsg];
    setMessages(updated);
    localStorage.setItem(`inspire_support_msgs_${selectedTicket.id}`, JSON.stringify(updated));
    setReplyText('');
    toast('Support reply sent to user', 'success');
  };

  const handleUpdateStatus = (newStatus: 'open' | 'in_progress' | 'resolved') => {
    if (!selectedTicket) return;
    const updated = { ...selectedTicket, status: newStatus };
    setSelectedTicket(updated);
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    toast(`Ticket marked as ${newStatus}`, 'info');
  };

  const filteredTickets = tickets.filter((t) => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  return (
    <AdminSidebar>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-black dark:text-white">
              Customer Support Helpdesk
            </h1>
            <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-1">
              Review incoming user tickets, troubleshoot connection & account issues, and respond directly.
            </p>
          </div>

          <div className="flex space-x-1.5 bg-white dark:bg-[#161B2B] p-1 rounded-2xl border border-[#E5E7EB] dark:border-[#2A3348]">
            {(['all', 'open', 'resolved'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors ${
                  filter === tab
                    ? 'bg-[#0E2A6E] text-white shadow-xs'
                    : 'text-gray-400 hover:text-black dark:hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tickets Column */}
          <div className="space-y-3">
            <h2 className="font-extrabold text-xs uppercase text-gray-500">
              Tickets ({filteredTickets.length})
            </h2>
            <div className="space-y-2">
              {filteredTickets.map((tkt) => (
                <div
                  key={tkt.id}
                  onClick={() => handleSelectTicket(tkt)}
                  className={`p-4 rounded-3xl border transition-all cursor-pointer ${
                    selectedTicket?.id === tkt.id
                      ? 'bg-blue-50/50 dark:bg-blue-950/20 border-[#0E2A6E] shadow-sm'
                      : 'bg-white dark:bg-[#161B2B] border-[#E5E7EB] dark:border-[#2A3348] hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-black text-xs text-[#0E2A6E] dark:text-[#3D6FE0]">
                      #{tkt.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        tkt.status === 'resolved'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : tkt.status === 'in_progress'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      {tkt.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs line-clamp-1">{tkt.subject}</h3>
                  <p className="text-[10px] text-gray-400 mt-1">
                    User: {tkt.user_id} • {new Date(tkt.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Ticket Resolution / Conversation Pane */}
          <div className="md:col-span-2 bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm flex flex-col justify-between min-h-[480px]">
            {selectedTicket ? (
              <>
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB] dark:border-[#2A3348]">
                    <div>
                      <h3 className="font-black text-sm">{selectedTicket.subject}</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Opened by User ID: <code className="font-mono">{selectedTicket.user_id}</code>
                      </p>
                    </div>

                    <div className="flex space-x-1.5">
                      <button
                        onClick={() => handleUpdateStatus('in_progress')}
                        className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold"
                      >
                        In Progress
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('resolved')}
                        className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="py-4 space-y-3 max-h-[320px] overflow-y-auto">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex flex-col ${
                          m.is_admin ? 'items-end' : 'items-start'
                        }`}
                      >
                        <span className="text-[10px] font-bold text-gray-400 mb-1 px-1">
                          {m.is_admin ? 'Admin Response 🛡️' : 'User Message'}
                        </span>
                        <div
                          className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-xs ${
                            m.is_admin
                              ? 'bg-[#0E2A6E] text-white rounded-tr-sm'
                              : 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white rounded-tl-sm'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reply Form */}
                <form
                  onSubmit={handleSendReply}
                  className="pt-4 border-t border-[#E5E7EB] dark:border-[#2A3348] flex space-x-2"
                >
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type official admin reply to user…"
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    className="px-5 py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47] disabled:opacity-50"
                  >
                    Reply
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <span className="text-4xl mb-3">💬</span>
                <h3 className="font-extrabold text-sm">Select a support ticket</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">
                  Choose a ticket from the left column to view message thread and reply.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
};
