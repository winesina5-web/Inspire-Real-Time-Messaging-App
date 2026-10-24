import React, { useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { StatusPost } from '../types';

const SEED_STATUSES: StatusPost[] = [
  {
    id: 'st_1',
    user_id: 'usr_jordan',
    media_type: 'image',
    content: 'Inspire real-time engine running at full speed! 🚀',
    media_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
    privacy: 'contacts',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    expires_at: new Date(Date.now() + 3600000 * 20).toISOString(),
    views_count: 14,
    has_viewed: false,
    user: {
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
  },
  {
    id: 'st_2',
    user_id: 'usr_maya',
    media_type: 'text',
    content: 'Loving the new Dark Royal Blue & Yellow palette in Inspire v1.0! 🎨✨',
    media_url: null,
    privacy: 'contacts',
    created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    expires_at: new Date(Date.now() + 3600000 * 23).toISOString(),
    views_count: 8,
    has_viewed: true,
    user: {
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

export const StatusPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [statuses, setStatuses] = useState<StatusPost[]>(SEED_STATUSES);
  const [activeStory, setActiveStory] = useState<StatusPost | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStatusText, setNewStatusText] = useState('');
  const [newStatusImage, setNewStatusImage] = useState('');

  const handlePostStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusText.trim() && !newStatusImage) return;

    const newPost: StatusPost = {
      id: `st_${Date.now()}`,
      user_id: user?.id || 'me',
      media_type: newStatusImage ? 'image' : 'text',
      content: newStatusText.trim(),
      media_url: newStatusImage || null,
      privacy: 'contacts',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000 * 24).toISOString(),
      views_count: 0,
      has_viewed: true,
      user: user || undefined,
    };

    setStatuses((prev) => [newPost, ...prev]);
    setShowCreateModal(false);
    setNewStatusText('');
    setNewStatusImage('');
    toast('Status shared with your contacts for 24 hours!', 'success');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center text-lg font-black shadow-sm">
              ⭕
            </div>
            <h1 className="text-xl font-extrabold text-black dark:text-white">
              Status & Stories
            </h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 rounded-full bg-[#0E2A6E] text-white text-xs font-bold shadow-sm active:scale-95"
          >
            + Add Status
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-3 space-y-4">
        {/* My Status Card */}
        <div
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-3.5 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 cursor-pointer hover:bg-gray-100"
        >
          <div className="relative">
            <Avatar name={user?.display_name || 'You'} avatarUrl={user?.avatar_url} size="md" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center font-black text-xs border-2 border-white dark:border-[#0B0F1A]">
              +
            </div>
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-black dark:text-white">My Status</h4>
            <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF]">Tap to share text, photos or moments</p>
          </div>
        </div>

        {/* Recent Updates Header */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#4B5563] dark:text-[#9CA3AF] px-1">
            Recent Contacts Updates
          </span>

          <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A3348] mt-2">
            {statuses.map((post) => (
              <div
                key={post.id}
                onClick={() => setActiveStory(post)}
                className="flex items-center space-x-3.5 py-3.5 px-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
              >
                <div className="relative p-0.5 rounded-full ring-2 ring-[#FFD700]">
                  <Avatar name={post.user?.display_name || 'User'} avatarUrl={post.user?.avatar_url} size="md" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-sm text-black dark:text-white truncate">
                    {post.user?.display_name}
                  </h4>
                  <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] truncate">
                    {post.content || '[Photo Story]'}
                  </p>
                </div>
                <span className="text-[10px] text-gray-400 font-bold">24h active</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Full Screen Story Viewer */}
      {activeStory && (
        <div
          onClick={() => setActiveStory(null)}
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 text-white animate-fade-in select-none"
        >
          {/* Story Progress Bar */}
          <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-[#FFD700] h-full w-full animate-[progress_5s_linear]" />
          </div>

          {/* Story User Header */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center space-x-2.5">
              <Avatar name={activeStory.user?.display_name || 'User'} size="sm" />
              <div>
                <h4 className="font-bold text-xs">{activeStory.user?.display_name}</h4>
                <span className="text-[10px] opacity-75">{new Date(activeStory.created_at).toLocaleTimeString()}</span>
              </div>
            </div>
            <button onClick={() => setActiveStory(null)} className="p-2 font-bold text-sm">✕</button>
          </div>

          {/* Story Content Canvas */}
          <div className="flex-1 flex flex-col items-center justify-center my-4">
            {activeStory.media_url ? (
              <img src={activeStory.media_url} alt="Story visual" className="max-h-[60vh] max-w-full rounded-3xl object-contain shadow-2xl" />
            ) : null}
            {activeStory.content && (
              <p className="text-lg font-extrabold text-center max-w-sm mt-4 px-4 drop-shadow-md">
                {activeStory.content}
              </p>
            )}
          </div>

          <div className="text-center text-xs text-white/60 pb-2">
            👁️ Viewed by {activeStory.views_count || 1} contacts • Tap to dismiss
          </div>
        </div>
      )}

      {/* Create Story Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
          <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-extrabold text-sm text-black dark:text-white">Create 24h Status</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 font-bold">✕</button>
            </div>

            <form onSubmit={handlePostStatus} className="space-y-4 my-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1">
                  Status Text
                </label>
                <textarea
                  value={newStatusText}
                  onChange={(e) => setNewStatusText(e.target.value)}
                  placeholder="What's on your mind?…"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1">
                  Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={newStatusImage}
                  onChange={(e) => setNewStatusImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-black shadow-md hover:bg-[#081B47]"
                >
                  Post Story
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav hasUnseenStatus={true} isAdmin={isAdmin} />
    </div>
  );
};
