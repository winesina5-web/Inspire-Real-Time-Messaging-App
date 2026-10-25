import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { StatusPost, Profile } from '../types';
import { supabase, isConfigured } from '../lib/supabaseClient';

export const StatusPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [statuses, setStatuses] = useState<StatusPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStory, setActiveStory] = useState<StatusPost | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStatusText, setNewStatusText] = useState('');
  const [newStatusImage, setNewStatusImage] = useState('');
  const [newStatusPrivacy, setNewStatusPrivacy] = useState<'contacts' | 'except' | 'only'>('contacts');

  const loadStatuses = async () => {
    if (!user) return;
    setLoading(true);

    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('statuses')
          .select(`
            id,
            user_id,
            media_type,
            content,
            media_url,
            privacy,
            created_at,
            expires_at,
            user:profiles!user_id(id, username, display_name, avatar_url)
          `)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Error fetching statuses:', error.message);
        } else if (data) {
          // Fetch status views for current user
          const statusIds = data.map((s: any) => s.id);
          let myViews: string[] = [];
          if (statusIds.length > 0) {
            const { data: viewData } = await supabase
              .from('status_views')
              .select('status_id')
              .eq('viewer_id', user.id)
              .in('status_id', statusIds);
            if (viewData) {
              myViews = viewData.map((v: any) => v.status_id);
            }
          }

          const formatted: StatusPost[] = data.map((s: any) => ({
            id: s.id,
            user_id: s.user_id,
            media_type: s.media_type,
            content: s.content,
            media_url: s.media_url,
            privacy: s.privacy,
            created_at: s.created_at,
            expires_at: s.expires_at,
            views_count: 0,
            has_viewed: myViews.includes(s.id),
            user: s.user,
          }));

          setStatuses(formatted);
        }
      } catch (err) {
        console.warn('Status fetch error:', err);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatuses();
  }, [user]);

  useEffect(() => {
    const targetUserId = searchParams.get('userId');
    if (!targetUserId || loading) return;
    const targetStatus = statuses.find((item) => item.user_id === targetUserId);
    if (targetStatus) setActiveStory(targetStatus);
  }, [searchParams, statuses, loading]);

  const handleOpenStory = async (st: StatusPost) => {
    setActiveStory(st);

    // Record view in database
    if (isConfigured && user && !st.has_viewed && st.user_id !== user.id) {
      try {
        await supabase.from('status_views').upsert({
          status_id: st.id,
          viewer_id: user.id,
          viewed_at: new Date().toISOString(),
        });
        setStatuses((prev) =>
          prev.map((s) => (s.id === st.id ? { ...s, has_viewed: true } : s))
        );
      } catch (err) {
        console.warn('Failed to record status view:', err);
      }
    }
  };

  const handlePostStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusText.trim() && !newStatusImage) return;
    if (!user) return;

    const payload = {
      user_id: user.id,
      media_type: newStatusImage ? 'image' : 'text',
      content: newStatusText.trim() || null,
      media_url: newStatusImage || null,
      privacy: newStatusPrivacy,
      expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    };

    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('statuses')
          .insert(payload)
          .select(`
            id,
            user_id,
            media_type,
            content,
            media_url,
            privacy,
            created_at,
            expires_at,
            user:profiles!user_id(id, username, display_name, avatar_url)
          `)
          .single();

        if (error) {
          toast(error.message, 'error');
          return;
        }

        if (data) {
          const newPost: StatusPost = {
            id: data.id,
            user_id: data.user_id,
            media_type: data.media_type,
            content: data.content,
            media_url: data.media_url,
            privacy: data.privacy,
            created_at: data.created_at,
            expires_at: data.expires_at,
            views_count: 0,
            has_viewed: true,
            user: (Array.isArray(data.user) ? data.user[0] : data.user) as unknown as Profile,
          };
          setStatuses((prev) => [newPost, ...prev]);
        }
      } catch (err) {
        console.warn('Post status error:', err);
      }
    } else {
      const localPost: StatusPost = {
        id: `st_${Date.now()}`,
        user_id: user.id,
        media_type: newStatusImage ? 'image' : 'text',
        content: newStatusText.trim(),
        media_url: newStatusImage || null,
        privacy: newStatusPrivacy,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        views_count: 0,
        has_viewed: true,
        user,
      };
      setStatuses((prev) => [localPost, ...prev]);
    }

    setShowCreateModal(false);
    setNewStatusText('');
    setNewStatusImage('');
    toast('Status shared with contacts (expires in 24 hours)', 'success');
  };

  const myStatus = statuses.find((s) => s.user_id === user?.id);
  const contactStatuses = statuses.filter((s) => s.user_id !== user?.id);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center text-lg font-black shadow-sm">
              ✨
            </div>
            <h1 className="text-xl font-extrabold text-black dark:text-white">
              Status & Stories
            </h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 rounded-full bg-[#0E2A6E] text-white text-xs font-bold shadow-sm active:scale-95 hover:bg-[#081B47]"
          >
            + Update
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 py-4 space-y-6">
        {/* My Status Card */}
        <div className="bg-white dark:bg-[#161B2B] p-4 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="relative">
              <Avatar
                name={user?.display_name || 'My Profile'}
                avatarUrl={user?.avatar_url}
                size="lg"
              />
              <button
                onClick={() => setShowCreateModal(true)}
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0E2A6E] text-white flex items-center justify-center text-xs font-black border-2 border-white dark:border-[#161B2B]"
              >
                +
              </button>
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-black dark:text-white">My Status</h3>
              <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
                {myStatus ? 'Active for next 24h • Tap to view' : 'Tap to share photos or thoughts'}
              </p>
            </div>
          </div>
          {myStatus && (
            <button
              onClick={() => handleOpenStory(myStatus)}
              className="text-xs font-bold text-[#0E2A6E] dark:text-[#3D6FE0] underline"
            >
              View
            </button>
          )}
        </div>

        {/* Contact Statuses List */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#4B5563] dark:text-[#9CA3AF] mb-3 px-1">
            Recent Contact Updates
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : contactStatuses.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs space-y-2">
              <div className="text-3xl">🌅</div>
              <p className="font-semibold text-black dark:text-white">No active stories from contacts</p>
              <p className="text-gray-400">Statuses from your contacts will appear here for 24 hours.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A3348]">
              {contactStatuses.map((st) => (
                <div
                  key={st.id}
                  onClick={() => handleOpenStory(st)}
                  className="flex items-center justify-between py-3.5 px-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="relative">
                      <Avatar
                        name={st.user?.display_name || 'User'}
                        avatarUrl={st.user?.avatar_url}
                        size="md"
                      />
                      {!st.has_viewed && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#FFD700] border-2 border-white dark:border-[#0B0F1A]" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-black dark:text-white">
                        {st.user?.display_name || 'Contact'}
                      </h4>
                      <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
                        {new Date(st.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs text-[#0E2A6E] dark:text-[#3D6FE0] font-bold">
                    View
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Story Viewer Modal */}
      {activeStory && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 text-white animate-fade-in"
          onClick={() => setActiveStory(null)}
        >
          {/* Progress bar */}
          <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden mb-4">
            <div className="bg-[#FFD700] h-full w-full animate-[progress_5s_linear]" />
          </div>

          {/* Story Author Header */}
          <div className="flex items-center justify-between z-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center space-x-2.5">
              <Avatar
                name={activeStory.user?.display_name || 'User'}
                avatarUrl={activeStory.user?.avatar_url}
                size="sm"
              />
              <div>
                <div className="text-xs font-bold text-white">
                  {activeStory.user?.display_name || 'User'}
                </div>
                <div className="text-[10px] text-gray-400">
                  {new Date(activeStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveStory(null)}
              className="text-white text-lg font-bold px-2 py-1"
            >
              ✕
            </button>
          </div>

          {/* Story Center Content */}
          <div className="flex-1 flex items-center justify-center text-center p-6" onClick={(e) => e.stopPropagation()}>
            {activeStory.media_type === 'image' && activeStory.media_url ? (
              <img
                src={activeStory.media_url}
                alt="Story"
                className="max-h-[70vh] max-w-full rounded-2xl object-contain shadow-2xl"
              />
            ) : (
              <p className="text-2xl font-black max-w-md leading-relaxed text-[#FFD700]">
                {activeStory.content}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 pb-4">
            Tap anywhere to close
          </div>
        </div>
      )}

      {/* Create Story Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161B2B] rounded-3xl max-w-sm w-full p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-black dark:text-white">
                Share 24h Status
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePostStatus} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Status Message
                </label>
                <textarea
                  value={newStatusText}
                  onChange={(e) => setNewStatusText(e.target.value)}
                  placeholder="What's on your mind today?"
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold focus:outline-hidden focus:border-[#0E2A6E]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={newStatusImage}
                  onChange={(e) => setNewStatusImage(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold focus:outline-hidden focus:border-[#0E2A6E]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Privacy Audience
                </label>
                <select
                  value={newStatusPrivacy}
                  onChange={(e) => setNewStatusPrivacy(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold"
                >
                  <option value="contacts">My Contacts</option>
                  <option value="except">Contacts Except…</option>
                  <option value="only">Only Share With…</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
                >
                  Post Status
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
