import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { SupportTicket, SupportMessage } from '../types';

export const SupportPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'tickets' | 'new' | 'faq'>('tickets');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  // New ticket state
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('account');
  const [initialMessage, setInitialMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ticket chat state
  const [ticketMessages, setTicketMessages] = useState<SupportMessage[]>([]);
  const [replyInput, setReplyInput] = useState('');

  // Local storage backing for demo and offline persistence
  const [tickets, setTickets] = useState<SupportTicket[]>(() => {
    const saved = localStorage.getItem(`inspire_support_tickets_${user?.id || 'usr'}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return [
      {
        id: 'tkt_001',
        user_id: user?.id || 'usr_1',
        subject: 'Welcome to Inspire & Account Guide',
        status: 'resolved',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        messages_count: 2,
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem(
      `inspire_support_tickets_${user?.id || 'usr'}`,
      JSON.stringify(tickets)
    );
  }, [tickets, user?.id]);

  const loadTicketMessages = (ticketId: string) => {
    const saved = localStorage.getItem(`inspire_support_msgs_${ticketId}`);
    if (saved) {
      try {
        setTicketMessages(JSON.parse(saved));
        return;
      } catch {
        // fallback
      }
    }

    // Default seeded conversation
    const initial: SupportMessage[] = [
      {
        id: 'smsg_1',
        ticket_id: ticketId,
        sender_id: user?.id || 'usr_1',
        is_admin: false,
        content: 'Hi Support team, how do I set up my username and verify calls?',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'smsg_2',
        ticket_id: ticketId,
        sender_id: 'admin_sys',
        is_admin: true,
        content:
          'Welcome to Inspire! You can configure your unique username in Profile, and voice/video calling works automatically with WebRTC turn credentials.',
        created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
      },
    ];
    setTicketMessages(initial);
    localStorage.setItem(`inspire_support_msgs_${ticketId}`, JSON.stringify(initial));
  };

  const handleSelectTicket = (tkt: SupportTicket) => {
    setSelectedTicket(tkt);
    loadTicketMessages(tkt.id);
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !initialMessage.trim()) {
      toast('Please fill in both subject and description', 'error');
      return;
    }

    setIsSubmitting(true);
    const newId = `tkt_${Date.now()}`;
    const newTkt: SupportTicket = {
      id: newId,
      user_id: user?.id || 'usr_1',
      subject: `[${category.toUpperCase()}] ${subject.trim()}`,
      status: 'open',
      created_at: new Date().toISOString(),
      messages_count: 1,
    };

    const firstMsg: SupportMessage = {
      id: `smsg_${Date.now()}`,
      ticket_id: newId,
      sender_id: user?.id || 'usr_1',
      is_admin: false,
      content: initialMessage.trim(),
      created_at: new Date().toISOString(),
    };

    localStorage.setItem(`inspire_support_msgs_${newId}`, JSON.stringify([firstMsg]));

    setTickets((prev) => [newTkt, ...prev]);
    setIsSubmitting(false);
    setSubject('');
    setInitialMessage('');
    toast('Support ticket submitted successfully!', 'success');
    handleSelectTicket(newTkt);
    setActiveTab('tickets');
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !selectedTicket) return;

    const newMsg: SupportMessage = {
      id: `smsg_${Date.now()}`,
      ticket_id: selectedTicket.id,
      sender_id: user?.id || 'usr_1',
      is_admin: false,
      content: replyInput.trim(),
      created_at: new Date().toISOString(),
    };

    const updated = [...ticketMessages, newMsg];
    setTicketMessages(updated);
    localStorage.setItem(`inspire_support_msgs_${selectedTicket.id}`, JSON.stringify(updated));
    setReplyInput('');

    // Simulate instant support auto-reply
    setTimeout(() => {
      const autoResp: SupportMessage = {
        id: `smsg_${Date.now() + 1}`,
        ticket_id: selectedTicket.id,
        sender_id: 'admin_sys',
        is_admin: true,
        content: 'Thank you for your message! An Inspire agent has received this and will review shortly.',
        created_at: new Date().toISOString(),
      };
      const withResp = [...updated, autoResp];
      setTicketMessages(withResp);
      localStorage.setItem(`inspire_support_msgs_${selectedTicket.id}`, JSON.stringify(withResp));
    }, 1200);
  };

  const FAQS = [
    {
      q: 'Are my chats private?',
      a: 'Yes, conversations are secured in transit and at rest. For extra device-level privacy, use the PIN-protected Secret Chats Vault.',
    },
    {
      q: 'How does voice and video calling work?',
      a: 'Calls use secure WebRTC peer connections with automated TURN credential negotiation for low-latency audio, video, and screen sharing.',
    },
    {
      q: 'What is the file upload limit?',
      a: 'Images and voice notes are optimized directly on your device. High-res documents up to 50MB are supported via Cloudflare R2.',
    },
    {
      q: 'How can I report abusive behavior?',
      a: 'Long-press any message or open user options and tap "Report User". Our safety team will review the flagged context under strict audit logs.',
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                if (selectedTicket) {
                  setSelectedTicket(null);
                } else {
                  navigate('/profile');
                }
              }}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-lg"
              aria-label="Back"
            >
              ←
            </button>
            <h1 className="text-lg font-black text-black dark:text-white">
              {selectedTicket ? 'Ticket #' + selectedTicket.id.slice(-4) : 'Help & Support'}
            </h1>
          </div>
          <span className="text-xl">🎧</span>
        </div>

        {/* Tab switchers if not viewing a ticket */}
        {!selectedTicket && (
          <div className="max-w-md mx-auto mt-3 flex space-x-2">
            <button
              onClick={() => setActiveTab('tickets')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${
                activeTab === 'tickets'
                  ? 'bg-[#0E2A6E] text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-black dark:hover:text-white'
              }`}
            >
              My Tickets ({tickets.length})
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${
                activeTab === 'new'
                  ? 'bg-[#0E2A6E] text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-black dark:hover:text-white'
              }`}
            >
              + New Ticket
            </button>
            <button
              onClick={() => setActiveTab('faq')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${
                activeTab === 'faq'
                  ? 'bg-[#0E2A6E] text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-black dark:hover:text-white'
              }`}
            >
              FAQ
            </button>
          </div>
        )}
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        {selectedTicket ? (
          /* Ticket Chat Conversation */
          <div className="space-y-4">
            <div className="p-4 rounded-3xl bg-gray-50 dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#0E2A6E] dark:text-[#3D6FE0]">
                  {selectedTicket.subject}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    selectedTicket.status === 'resolved'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-amber-500/10 text-amber-600'
                  }`}
                >
                  {selectedTicket.status}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Opened {new Date(selectedTicket.created_at).toLocaleString()}
              </p>
            </div>

            {/* Messages Thread */}
            <div className="space-y-3 min-h-[300px] max-h-[450px] overflow-y-auto p-2">
              {ticketMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.is_admin ? 'items-start' : 'items-end'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 mb-1 px-1">
                    <span className="text-[10px] font-bold text-gray-400">
                      {msg.is_admin ? 'Inspire Support 🛡️' : 'You'}
                    </span>
                    <span className="text-[9px] text-gray-400">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs font-medium leading-relaxed ${
                      msg.is_admin
                        ? 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white rounded-tl-sm'
                        : 'bg-[#0E2A6E] text-white rounded-tr-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Reply Input Bar */}
            <form onSubmit={handleSendReply} className="flex items-center space-x-2 pt-2">
              <input
                type="text"
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                placeholder="Type your reply to support…"
                className="flex-1 px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs focus:outline-none focus:border-[#0E2A6E]"
              />
              <button
                type="submit"
                disabled={!replyInput.trim()}
                className="px-4 py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47] disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        ) : activeTab === 'tickets' ? (
          /* Ticket list */
          <div className="space-y-3">
            {tickets.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl">
                  📬
                </div>
                <h3 className="font-extrabold text-sm">No support tickets</h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Have a question or encounter a bug? Open a ticket and our team will get right back to you.
                </p>
                <button
                  onClick={() => setActiveTab('new')}
                  className="px-4 py-2 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold"
                >
                  Create Ticket
                </button>
              </div>
            ) : (
              tickets.map((tkt) => (
                <div
                  key={tkt.id}
                  onClick={() => handleSelectTicket(tkt)}
                  className="p-4 rounded-3xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm hover:border-[#0E2A6E] cursor-pointer transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs truncate max-w-[240px]">
                      {tkt.subject}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        tkt.status === 'resolved'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      {tkt.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>Opened {new Date(tkt.created_at).toLocaleDateString()}</span>
                    <span className="text-[#0E2A6E] dark:text-[#3D6FE0] font-bold">
                      View conversation →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'new' ? (
          /* New Ticket Form */
          <form
            onSubmit={handleCreateTicket}
            className="bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4"
          >
            <h2 className="font-extrabold text-sm text-black dark:text-white">
              Create Support Ticket
            </h2>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium focus:outline-none"
              >
                <option value="account">Account & Username</option>
                <option value="calls">Calling & WebRTC Audio/Video</option>
                <option value="privacy">Security & Privacy Vault</option>
                <option value="bug">Report a Bug / Issue</option>
                <option value="other">General Question</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your question"
                required
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium focus:outline-none focus:border-[#0E2A6E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                Description & Details
              </label>
              <textarea
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                placeholder="Please describe the issue or what you need assistance with..."
                rows={4}
                required
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium focus:outline-none focus:border-[#0E2A6E]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-2xl bg-[#0E2A6E] text-white font-bold text-xs hover:bg-[#081B47] disabled:opacity-50 transition-colors shadow-md"
            >
              {isSubmitting ? 'Submitting…' : 'Submit Ticket'}
            </button>
          </form>
        ) : (
          /* FAQ Section */
          <div className="space-y-3">
            <h2 className="font-extrabold text-sm mb-2">Frequently Asked Questions</h2>
            {FAQS.map((faq, i) => (
              <details
                key={i}
                className="group p-4 rounded-3xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] shadow-xs"
              >
                <summary className="font-bold text-xs cursor-pointer list-none flex justify-between items-center text-black dark:text-white">
                  <span>{faq.q}</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">
                    ▾
                  </span>
                </summary>
                <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-2.5 leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
