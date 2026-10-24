import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { ChannelSubscription, ChannelPost } from '../types';

const SEED_CHANNELS: ChannelSubscription[] = [
  {
    id: 'chn_inspire_official',
    owner_id: 'usr_admin',
    name: 'Inspire Official Announcements 📣',
    description: 'Product updates, real-time architecture releases, and feature rollouts.',
    avatar_url: null,
    subscriber_count: 1420,
    is_public: true,
    is_subscribed: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'chn_tech_radar',
    owner_id: 'usr_jordan',
    name: 'Cloudflare & Distributed Web 🌐',
    description: 'Deep dives into Cloudflare Workers AI, R2 storage, and edge computing.',
    avatar_url: null,
    subscriber_count: 865,
    is_public: true,
    is_subscribed: true,
    created_at: '2026-02-10T10:00:00Z',
  },
  {
    id: 'chn_ui_design',
    owner_id: 'usr_maya',
    name: 'Design Systems & Micro-Interactions 🎨',
    description: 'Color tokens, typography, dark mode parity, and motion polish.',
    avatar_url: null,
    subscriber_count: 530,
    is_public: true,
    is_subscribed: false,
    created_at: '2026-03-01T12:00:00Z',
  },
];

const SEED_POSTS: Record<string, ChannelPost[]> = {
  chn_inspire_official: [
    {
      id: 'post_101',
      channel_id: 'chn_inspire_official',
      content: '🚀 Inspire Wave 2 is live! We have introduced 55+ new ultra-advanced features: threaded group replies, custom emoji reactions, smart compose ghost-text autocomplete, in-chat bill splitting, and collaborative shared notes.',
      media_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
      message_type: 'image',
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      view_count: 1240,
      reaction_count: 342,
      reactions: { '🔥': 180, '🎉': 120, '❤️': 42 },
      my_reaction: '🔥',
    },
    {
      id: 'post_102',
      channel_id: 'chn_inspire_official',
      content: '⚡ Privacy Update: Secret Chats and Incognito Read Mode are now fully supported across all devices, ensuring zero read-receipt leakage whenever enabled.',
      media_url: null,
      message_type: 'text',
      created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
      view_count: 980,
      reaction_count: 156,
      reactions: { '👍': 90, '✨': 66 },
      my_reaction: null,
    },
  ],
  chn_tech_radar: [
    {
      id: 'post_201',
      channel_id: 'chn_tech_radar',
      content: 'Using native R2 bucket bindings inside Cloudflare Workers guarantees zero egress cost while providing sub-50ms signed media downloads for videos and voice notes.',
      media_url: null,
      message_type: 'text',
      created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
      view_count: 420,
      reaction_count: 88,
      reactions: { '💡': 65, '🚀': 23 },
      my_reaction: null,
    },
  ],
};

export const ChannelsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [channels, setChannels] = useState<ChannelSubscription[]>(SEED_CHANNELS);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('chn_inspire_official');
  const [activeTab, setActiveTab] = useState<'subscribed' | 'discover'>('subscribed');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');

  const activeChannel = channels.find((c) => c.id === selectedChannelId) || channels[0];
  const channelPosts = SEED_POSTS[selectedChannelId] || [];

  const handleToggleSubscribe = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => {
        if (c.id === channelId) {
          const next = !c.is_subscribed;
          toast(next ? `Subscribed to ${c.name}` : `Unsubscribed from ${c.name}`, 'info');
          return {
            ...c,
            is_subscribed: next,
            subscriber_count: c.subscriber_count + (next ? 1 : -1),
          };
        }
        return c;
      })
    );
  };

  const handleReactPost = (postId: string, emoji: string) => {
    toast(`Reacted with ${emoji}`, 'info');
  };

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const newChan: ChannelSubscription = {
      id: `chn_${Date.now()}`,
      owner_id: user?.id || 'me',
      name: newChannelName.trim(),
      description: newChannelDesc.trim() || 'Broadcast channel on Inspire',
      subscriber_count: 1,
      is_public: true,
      is_subscribed: true,
      created_at: new Date().toISOString(),
    };

    setChannels((prev) => [newChan, ...prev]);
    setSelectedChannelId(newChan.id);
    setShowCreateModal(false);
    setNewChannelName('');
    setNewChannelDesc('');
    toast('Public Channel created!', 'success');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📢</span>
            <h1 className="text-xl font-extrabold text-black dark:text-white">
              Broadcast Channels
            </h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1 rounded-full bg-[#0E2A6E] text-white text-xs font-bold shadow-xs active:scale-95"
          >
            + Create
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="max-w-md mx-auto mt-2.5 flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <button
            onClick={() => setActiveTab('subscribed')}
            className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'subscribed'
                ? 'bg-white dark:bg-[#161B2B] text-black dark:text-white shadow-xs'
                : 'text-gray-500'
            }`}
          >
            Subscribed
          </button>
          <button
            onClick={() => setActiveTab('discover')}
            className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'discover'
                ? 'bg-white dark:bg-[#161B2B] text-black dark:text-white shadow-xs'
                : 'text-gray-500'
            }`}
          >
            Discover Channels 🔍
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {activeTab === 'subscribed' ? (
          <>
            {/* Channel Selection Horizontal Pills */}
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1">
              {channels
                .filter((c) => c.is_subscribed)
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChannelId(c.id)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                      selectedChannelId === c.id
                        ? 'bg-[#0E2A6E] text-white dark:bg-[#3D6FE0]'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
            </div>

            {/* Active Channel Header Card */}
            {activeChannel && (
              <div className="p-4 rounded-3xl bg-gray-50 dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-black dark:text-white">
                      {activeChannel.name}
                    </h3>
                    <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF]">
                      {activeChannel.subscriber_count.toLocaleString()} subscribers • One-way broadcast
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleSubscribe(activeChannel.id)}
                    className="px-3 py-1 rounded-full border border-gray-300 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300"
                  >
                    {activeChannel.is_subscribed ? 'Following' : '+ Follow'}
                  </button>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {activeChannel.description}
                </p>
              </div>
            )}

            {/* Posts Feed */}
            <div className="space-y-4 pt-2">
              <span className="text-xs font-black uppercase tracking-wider text-gray-400">
                Recent Broadcasts
              </span>

              {channelPosts.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-400">
                  No broadcasts posted in this channel yet.
                </div>
              ) : (
                channelPosts.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 rounded-3xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-3"
                  >
                    {post.media_url && (
                      <img
                        src={post.media_url}
                        alt="Channel Media"
                        className="w-full max-h-56 object-cover rounded-2xl"
                      />
                    )}
                    <p className="text-xs leading-relaxed text-black dark:text-white whitespace-pre-wrap">
                      {post.content}
                    </p>

                    {/* Footer: View count & Reactions */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500">
                      <span className="font-semibold">👁️ {post.view_count} views</span>
                      <div className="flex items-center space-x-1.5">
                        {post.reactions &&
                          Object.entries(post.reactions).map(([em, cnt]) => (
                            <button
                              key={em}
                              onClick={() => handleReactPost(post.id, em)}
                              className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-[#FFD700]/20 font-bold flex items-center space-x-1"
                            >
                              <span>{em}</span>
                              <span className="text-[10px]">{cnt}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* Discover Channels Tab */
          <div className="space-y-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels by topic or name…"
              className="w-full px-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold focus:outline-none"
            />

            <div className="space-y-2.5 pt-2">
              {channels
                .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between space-x-3"
                  >
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-xs text-black dark:text-white truncate">
                        {c.name}
                      </h4>
                      <p className="text-[11px] text-gray-500 truncate">{c.description}</p>
                      <span className="text-[10px] font-bold text-gray-400">
                        {c.subscriber_count} subscribers
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleSubscribe(c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        c.is_subscribed
                          ? 'border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                          : 'bg-[#0E2A6E] text-white hover:bg-[#081B47]'
                      }`}
                    >
                      {c.is_subscribed ? 'Following' : 'Follow'}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>

      {/* Create Channel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
          <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up space-y-4">
            <h3 className="font-extrabold text-base text-black dark:text-white">
              Create Broadcast Channel
            </h3>
            <p className="text-xs text-gray-500">
              Reach unlimited subscribers with one-way broadcasts, media, and reactions.
            </p>

            <form onSubmit={handleCreateChannel} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. Design & Tech Dispatch 🚀"
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What is this channel about?"
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium focus:outline-none resize-none"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};
