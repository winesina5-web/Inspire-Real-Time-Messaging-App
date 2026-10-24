import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { SupportTicket, SupportMessage } from '../../types';
import { supabase, isConfigured } from '../../lib/supabaseClient';

export const AdminSupportPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTickets = async () => {
    setLoading(true);
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('support_tickets')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setTickets(data as SupportTicket[]);
        }
      } catch (err) {
        console.warn('Error loading support tickets:', err);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTicketMessages = async (ticketId: string) => {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('support_messages')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          setMessages(data as SupportMessage[]);
        }
      } catch (err) {
        console.warn('Error loading support messages:', err);
      }
    }
  };

  const handleSelectTicket = (tkt: SupportTicket) => {
    setSelectedTicket(tkt);
    loadTicketMessages(tkt.id);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket || !user) return;

    const payload = {
      ticket_id: selectedTicket.id,
      sender_id: user.id,
      is_admin: true,
      content: replyText.trim(),
    };

    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('support_messages')
          .insert(payload)
          .select()
          .single();

        if (!error && data) {
          setMessages((prev) => [...prev, data as SupportMessage]);
        }
      } catch (err) {
        console.warn('Error sending support message:', err);
      }
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: `smsg_${Date.now()}`,
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          is_admin: true,
          content: replyText.trim(),
          created_at: new Date().toISOString(),
        },
      ]);
    }

    setReplyText('');
    toast('Support reply dispatched to user', 'success');
  };

  const handleUpdateStatus = async (newStatus: 'open' | 'in_progress' | 'resolved') => {
    if (!selectedTicket) return;

    if (isConfigured) {
      try {
        await supabase
          .from('support_tickets')
          .update({ status: newStatus })
          .eq('id', selectedTicket.id);
      } catch (err) {
        console.warn('Update ticket error:', err);
      }
    }

    const updated = { ...selectedTicket, status: newStatus };
    setSelectedTicket(updated);
    setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
    toast(`Ticket marked ${newStatus.replace('_', ' ')}`, 'success');
  };

  const filtered = tickets.filter((t) => {
    if (filter === 'open') return t.status === 'open' || t.status === 'in_progress';
    if (filter === 'resolved') return t.status === 'resolved';
    return true;
  });

  return (
    <AdminSidebar>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#E5E7EB] dark:border-[#2A3348] gap-4">
          <div>
            <h1 className="text-2xl font-black text-black dark:text-white">
              Customer Support Desk
            </h1>
            <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-1">
              Live in-app user ticket system with threaded responses (Feature 61).
            </p>
          </div>

          <div className="flex space-x-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
            {(['all', 'open', 'resolved'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                  filter === tab
                    ? 'bg-white dark:bg-[#161B2B] text-black dark:text-white shadow-xs'
                    : 'text-gray-500'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tickets List */}
            <div className="lg:col-span-1 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Tickets ({filtered.length})
              </h2>

              {filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 bg-white dark:bg-[#161B2B] rounded-3xl border border-gray-100 dark:border-gray-800">
                  No tickets found.
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((tkt) => (
                    <div
                      key={tkt.id}
                      onClick={() => handleSelectTicket(tkt)}
                      className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                        selectedTicket?.id === tkt.id
                          ? 'bg-[#0E2A6E] text-white border-[#0E2A6E] shadow-md'
                          : 'bg-white dark:bg-[#161B2B] text-black dark:text-white border-[#E5E7EB] dark:border-[#2A3348] hover:bg-gray-50 dark:hover:bg-gray-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            tkt.status === 'open'
                              ? 'bg-amber-100 text-amber-800'
                              : tkt.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {tkt.status.replace('_', ' ')}
                        </span>
                        <span
                          className={`text-[10px] ${
                            selectedTicket?.id === tkt.id ? 'text-blue-200' : 'text-gray-400'
                          }`}
                        >
                          {new Date(tkt.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold line-clamp-2">{tkt.subject}</h4>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ticket Conversation View */}
            <div className="lg:col-span-2">
              {selectedTicket ? (
                <div className="bg-white dark:bg-[#161B2B] rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm flex flex-col h-[520px]">
                  {/* Ticket Header */}
                  <div className="p-4 bg-gray-50 dark:bg-[#1A2234] border-b border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black text-black dark:text-white">
                        {selectedTicket.subject}
                      </h3>
                      <p className="text-[10px] text-gray-400">Ticket ID: {selectedTicket.id}</p>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => handleUpdateStatus(e.target.value as any)}
                        className="px-2.5 py-1 rounded-xl bg-white dark:bg-gray-800 border text-xs font-bold"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                  </div>

                  {/* Message Feed */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.is_admin ? 'items-end' : 'items-start'}`}
                      >
                        <div className="text-[10px] font-bold text-gray-400 mb-1 px-1">
                          {msg.is_admin ? 'Inspire Support' : 'Customer'}
                        </div>
                        <div
                          className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                            msg.is_admin
                              ? 'bg-[#0E2A6E] text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply Composer */}
                  <form onSubmit={handleSendReply} className="p-3 border-t border-gray-100 dark:border-gray-800 flex space-x-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type official support reply..."
                      className="flex-1 px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-[#1A2234] border text-xs font-semibold focus:outline-hidden"
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className="px-4 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47] disabled:opacity-50"
                    >
                      Reply
                    </button>
                  </form>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#161B2B] rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] p-12 text-center text-xs text-gray-400 flex flex-col items-center justify-center h-[520px]">
                  <span className="text-4xl mb-2">🎫</span>
                  <p className="font-bold text-black dark:text-white">Select a support ticket</p>
                  <p className="mt-1">View user issues and reply directly to tickets.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminSidebar>
  );
};
