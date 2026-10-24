import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { ChannelSubscription, ChannelPost } from '../types';
import { supabase, isConfigured } from '../lib/supabaseClient';

export const ChannelsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [channels, setChannels] = useState<ChannelSubscription[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [activeTab, setActiveTab] = useState<'subscribed' | 'discover'>('subscribed');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [loading, setLoading] = useState(true);

  // Load channels and user subscriptions
  const loadChannels = async () => {
    if (!user) return;
    setLoading(true);

    if (isConfigured) {
      try {
        const { data: channelRows, error } = await supabase
          .from('channel_subscriptions')
          .select('*')
          .order('subscriber_count', { ascending: false });

        if (error) {
          console.warn('Channel fetch error:', error.message);
        } else if (channelRows) {
          // Check user memberships
          const { data: memberRows } = await supabase
            .from('channel_members')
            .select('channel_id')
            .eq('user_id', user.id);

          const mySubIds = new Set((memberRows || []).map((m: any) => m.channel_id));

          const formatted: ChannelSubscription[] = channelRows.map((ch: any) => ({
            id: ch.id,
            owner_id: ch.owner_id,
            name: ch.name,
            description: ch.description,
            avatar_url: ch.avatar_url,
            subscriber_count: ch.subscriber_count || 0,
            is_public: ch.is_public,
            is_subscribed: mySubIds.has(ch.id) || ch.owner_id === user.id,
            created_at: ch.created_at,
          }));

          setChannels(formatted);
          if (formatted.length > 0 && !selectedChannelId) {
            setSelectedChannelId(formatted[0].id);
          }
        }
      } catch (err) {
        console.warn('Error loading channels:', err);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, [user]);

  // Load posts for the selected channel
  useEffect(() => {
    if (!selectedChannelId) return;

    const loadPosts = async () => {
      if (isConfigured) {
        try {
          const { data, error } = await supabase
            .from('channel_posts')
            .select('*')
            .eq('channel_id', selectedChannelId)
            .order('created_at', { ascending: false });

          if (!error && data) {
            setPosts(
              data.map((p: any) => ({
                id: p.id,
                channel_id: p.channel_id,
                content: p.content,
                media_url: p.media_url,
                message_type: p.message_type,
                created_at: p.created_at,
                view_count: 1,
                reaction_count: 0,
                reactions: {},
                my_reaction: null,
              }))
            );
          }
        } catch (err) {
          console.warn('Error loading channel posts:', err);
        }
      }
    };

    loadPosts();
  }, [selectedChannelId]);

  const handleToggleSubscribe = async (channelId: string, currentStatus: boolean) => {
    if (!user) return;

    if (isConfigured) {
      try {
        if (currentStatus) {
          await supabase
            .from('channel_members')
            .delete()
            .eq('channel_id', channelId)
            .eq('user_id', user.id);
        } else {
          await supabase.from('channel_members').insert({
            channel_id: channelId,
            user_id: user.id,
          });
        }
      } catch (err) {
        console.warn('Subscription toggle error:', err);
      }
    }

    setChannels((prev) =>
      prev.map((c) =>
        c.id === channelId
          ? {
              ...c,
              is_subscribed: !currentStatus,
              subscriber_count: currentStatus ? Math.max(0, c.subscriber_count - 1) : c.subscriber_count + 1,
            }
          : c
      )
    );
    toast(currentStatus ? 'Unsubscribed from channel' : 'Subscribed to channel updates! 🔔', 'success');
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() || !user) return;

    const newChannelData = {
      owner_id: user.id,
      name: newChannelName.trim(),
      description: newChannelDesc.trim() || null,
      is_public: true,
      subscriber_count: 1,
    };

    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('channel_subscriptions')
          .insert(newChannelData)
          .select()
          .single();

        if (error) {
          toast(error.message, 'error');
          return;
        }

        if (data) {
          // Auto add owner as member
          await supabase.from('channel_members').insert({
            channel_id: data.id,
            user_id: user.id,
          });

          const created: ChannelSubscription = {
            id: data.id,
            owner_id: data.owner_id,
            name: data.name,
            description: data.description,
            avatar_url: data.avatar_url,
            subscriber_count: 1,
            is_public: true,
            is_subscribed: true,
            created_at: data.created_at,
          };
          setChannels((prev) => [created, ...prev]);
          setSelectedChannelId(data.id);
        }
      } catch (err) {
        console.warn('Channel creation error:', err);
      }
    }

    setShowCreateModal(false);
    setNewChannelName('');
    setNewChannelDesc('');
    toast('Channel created successfully!', 'success');
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !selectedChannelId) return;

    const postData = {
      channel_id: selectedChannelId,
      content: newPostContent.trim(),
      media_url: newPostImage.trim() || null,
      message_type: newPostImage.trim() ? 'image' : 'text',
    };

    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('channel_posts')
          .insert(postData)
          .select()
          .single();

        if (!error && data) {
          const newPost: ChannelPost = {
            id: data.id,
            channel_id: data.channel_id,
            content: data.content,
            media_url: data.media_url,
            message_type: data.message_type,
            created_at: data.created_at,
            view_count: 1,
            reaction_count: 0,
            reactions: {},
            my_reaction: null,
          };
          setPosts((prev) => [newPost, ...prev]);
        }
      } catch (err) {
        console.warn('Create post error:', err);
      }
    }

    setShowPostModal(false);
    setNewPostContent('');
    setNewPostImage('');
    toast('Post published to channel subscribers!', 'success');
  };

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);
  const isOwner = selectedChannel?.owner_id === user?.id;

  const displayedChannels = channels.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    return activeTab === 'subscribed' ? c.is_subscribed : true;
  });

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center text-lg font-black shadow-sm">
              📣
            </div>
            <h1 className="text-xl font-extrabold text-black dark:text-white">
              Channels
            </h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 rounded-full bg-[#0E2A6E] text-white text-xs font-bold shadow-sm active:scale-95 hover:bg-[#081B47]"
          >
            + Create
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-md mx-auto px-4 pt-3">
        <div className="flex rounded-2xl bg-gray-100 dark:bg-gray-800 p-1">
          <button
            onClick={() => setActiveTab('subscribed')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'subscribed' ? 'bg-white dark:bg-[#161B2B] text-black dark:text-white shadow-xs' : 'text-gray-500'
            }`}
          >
            Subscribed
          </button>
          <button
            onClick={() => setActiveTab('discover')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'discover' ? 'bg-white dark:bg-[#161B2B] text-black dark:text-white shadow-xs' : 'text-gray-500'
            }`}
          >
            Discover All
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedChannels.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-xs space-y-3">
            <div className="text-4xl">📢</div>
            <p className="font-semibold text-black dark:text-white">
              {activeTab === 'subscribed' ? 'No subscribed channels' : 'No public channels found'}
            </p>
            <p className="text-gray-400">
              {activeTab === 'subscribed'
                ? 'Discover channels to get one-way broadcast updates or create your own.'
                : 'Create the first broadcast channel to share news with your community.'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-[#0E2A6E] text-white font-bold"
            >
              Create a Channel
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Channel Cards */}
            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none">
              {displayedChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannelId(ch.id)}
                  className={`flex-shrink-0 p-3.5 rounded-2xl border text-left w-52 transition-all ${
                    selectedChannelId === ch.id
                      ? 'bg-[#0E2A6E] text-white border-[#0E2A6E] shadow-md'
                      : 'bg-white dark:bg-[#161B2B] text-black dark:text-white border-[#E5E7EB] dark:border-[#2A3348]'
                  }`}
                >
                  <div className="font-bold text-xs truncate">{ch.name}</div>
                  <div className={`text-[10px] truncate mt-0.5 ${selectedChannelId === ch.id ? 'text-blue-200' : 'text-gray-400'}`}>
                    {ch.description || 'Broadcast Channel'}
                  </div>
                  <div className={`text-[10px] font-bold mt-2 ${selectedChannelId === ch.id ? 'text-[#FFD700]' : 'text-[#0E2A6E] dark:text-[#3D6FE0]'}`}>
                    {ch.subscriber_count} subscribers
                  </div>
                </button>
              ))}
            </div>

            {/* Selected Channel Feed */}
            {selectedChannel && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-3xl bg-gray-50 dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between">
                  <div>
                    <h2 className="font-extrabold text-base">{selectedChannel.name}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedChannel.description}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isOwner && (
                      <button
                        onClick={() => setShowPostModal(true)}
                        className="px-3 py-1 rounded-full bg-[#FFD700] text-[#1A1A2E] text-xs font-black shadow-xs"
                      >
                        + Post
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleSubscribe(selectedChannel.id, Boolean(selectedChannel.is_subscribed))}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        selectedChannel.is_subscribed
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                          : 'bg-[#0E2A6E] text-white'
                      }`}
                    >
                      {selectedChannel.is_subscribed ? 'Following' : 'Follow'}
                    </button>
                  </div>
                </div>

                {/* Posts Feed */}
                {posts.length === 0 ? (
                  <div className="text-center py-10 text-xs text-gray-400">
                    No posts published in this channel yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {posts.map((post) => (
                      <div
                        key={post.id}
                        className="p-4 rounded-3xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] shadow-xs space-y-2.5"
                      >
                        <p className="text-xs leading-relaxed font-normal whitespace-pre-wrap">
                          {post.content}
                        </p>
                        {post.media_url && (
                          <img
                            src={post.media_url}
                            alt="Channel Post Media"
                            className="rounded-2xl w-full max-h-60 object-cover"
                          />
                        )}
                        <div className="text-[10px] text-gray-400 pt-1">
                          {new Date(post.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create Channel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161B2B] rounded-3xl max-w-sm w-full p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-black dark:text-white">Create Broadcast Channel</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleCreateChannel} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Channel Name</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. Inspire Product Updates"
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold focus:outline-hidden focus:border-[#0E2A6E]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Description</label>
                <textarea
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What is this channel about?"
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold focus:outline-hidden focus:border-[#0E2A6E]"
                />
              </div>
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Post Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161B2B] rounded-3xl max-w-sm w-full p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-black dark:text-white">Publish Channel Post</h3>
              <button onClick={() => setShowPostModal(false)} className="text-gray-400 text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleCreatePost} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Content</label>
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Write message to channel subscribers..."
                  rows={4}
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold focus:outline-hidden focus:border-[#0E2A6E]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Image URL (Optional)</label>
                <input
                  type="url"
                  value={newPostImage}
                  onChange={(e) => setNewPostImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold focus:outline-hidden focus:border-[#0E2A6E]"
                />
              </div>
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold"
                >
                  Publish
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
