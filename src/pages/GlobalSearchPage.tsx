import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { matchSearchQuery, formatMessageTime } from '../utils/helpers';
import { BottomNav } from '../components/BottomNav';

interface SearchResultItem {
  id: string;
  conversationId: string;
  conversationName: string;
  isGroup: boolean;
  avatarText: string;
  senderName: string;
  content: string;
  timestamp: string;
}

const MOCK_MESSAGES_POOL: SearchResultItem[] = [
  {
    id: 'sm_1',
    conversationId: 'usr_jordan',
    conversationName: 'Jordan Lee',
    isGroup: false,
    avatarText: 'JL',
    senderName: 'Jordan Lee',
    content: 'Sent you a quick voice note with ideas for the smart search and summarizer.',
    timestamp: new Date(Date.now() - 180000).toISOString(),
  },
  {
    id: 'sm_2',
    conversationId: 'usr_jordan',
    conversationName: 'Jordan Lee',
    isGroup: false,
    avatarText: 'JL',
    senderName: 'Jordan Lee',
    content: 'Let us sync on the new WebRTC audio calling implementation this afternoon.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'sm_3',
    conversationId: 'usr_maya',
    conversationName: 'Maya Patel',
    isGroup: false,
    avatarText: 'MP',
    senderName: 'Maya Patel',
    content: 'The new dark royal blue and yellow theme looks stunning!',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'sm_4',
    conversationId: 'usr_maya',
    conversationName: 'Maya Patel',
    isGroup: false,
    avatarText: 'MP',
    senderName: 'Maya Patel',
    content: 'Can you export the meeting plan to .ics calendar format?',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'sm_5',
    conversationId: 'group-eng',
    conversationName: 'Inspire Core Engineering 🚀',
    isGroup: true,
    avatarText: '👥',
    senderName: 'Marcus Vance',
    content: 'Architecture, real-time messaging sync, and Cloudflare R2 media pipelines are deployed.',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'sm_6',
    conversationId: 'group-eng',
    conversationName: 'Inspire Core Engineering 🚀',
    isGroup: true,
    avatarText: '👥',
    senderName: 'Elena Rostova',
    content: 'Interactive polls and group collaboration have been tested with 100% test coverage.',
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
];

export default function GlobalSearchPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'direct' | 'groups'>('all');

  const filteredResults = useMemo(() => {
    if (!query.trim()) return [];
    return MOCK_MESSAGES_POOL.filter((item) => {
      if (filterType === 'direct' && item.isGroup) return false;
      if (filterType === 'groups' && !item.isGroup) return false;
      return matchSearchQuery(item.content, query) || matchSearchQuery(item.conversationName, query);
    });
  }, [query, filterType]);

  const highlightMatch = (text: string, search: string) => {
    if (!search.trim()) return text;
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === search.toLowerCase() ? (
        <mark key={i} className="bg-[#FFD700] text-[#1A1A2E] font-extrabold rounded px-1">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white pb-24 select-none">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#1E2638] px-4 py-3">
        <div className="max-w-md mx-auto flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#161B2B] flex items-center justify-center text-sm font-bold hover:bg-gray-200 transition-colors"
            aria-label="Back"
          >
            ←
          </button>
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all chats, groups & messages…"
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white text-sm font-semibold focus:outline-none focus:border-[#0E2A6E] focus:ring-1 focus:ring-[#0E2A6E]"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="max-w-md mx-auto mt-2.5 flex items-center space-x-2">
          {(['all', 'direct', 'groups'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-all ${
                filterType === type
                  ? 'bg-[#0E2A6E] text-[#FFD700] shadow-sm'
                  : 'bg-gray-100 dark:bg-[#161B2B] text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              {type === 'all' ? 'All Messages' : type === 'direct' ? '1:1 Chats' : 'Groups'}
            </button>
          ))}
          <span className="text-[11px] text-gray-400 ml-auto font-medium">
            {query.trim() ? `${filteredResults.length} found` : 'Cmd+K'}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-4">
        {!query.trim() ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/20 text-[#0E2A6E] dark:text-[#3D6FE0] text-3xl flex items-center justify-center mx-auto">
              🔍
            </div>
            <h3 className="font-extrabold text-base">Global Message Search</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
              Instantly search messages, shared files, voice notes, and announcements across all your 1:1 and group conversations.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-1.5">
              {['voice note', 'theme', 'architecture', 'meeting', 'poll'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setQuery(tag)}
                  className="px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-[#161B2B] text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                >
                  "{tag}"
                </button>
              ))}
            </div>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <div className="text-4xl">🏜️</div>
            <h3 className="font-bold text-sm">No matching messages</h3>
            <p className="text-xs text-gray-500">
              No results found for "<span className="font-semibold">{query}</span>". Try different keywords or filter.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredResults.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.isGroup) {
                    navigate(`/group/${item.conversationId}`);
                  } else {
                    navigate(`/chat/${item.conversationId}`);
                  }
                }}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] hover:border-[#0E2A6E] dark:hover:border-[#3D6FE0] cursor-pointer transition-all shadow-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-lg bg-[#0E2A6E] text-white text-[10px] font-black flex items-center justify-center">
                      {item.avatarText}
                    </div>
                    <span className="font-extrabold text-xs text-black dark:text-white">
                      {item.conversationName}
                    </span>
                    {item.isGroup && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded">
                        Group
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {formatMessageTime(item.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {highlightMatch(item.content, query)}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav totalUnread={0} isAdmin={user?.role === 'admin'} />
    </div>
  );
}
