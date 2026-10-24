import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePresence } from '../hooks/usePresence';
import { useToast } from '../components/Toast';
import { BottomNav } from '../components/BottomNav';
import { Avatar } from '../components/Avatar';
import { supabase, isConfigured } from '../lib/supabaseClient';
import { ConversationItem, Profile, Message, Group } from '../types';
import { formatLastSeen, triggerHaptic } from '../utils/helpers';

// Seed demo contacts for rich offline experience
const SEED_PROFILES: Profile[] = [
  {
    id: 'usr_jordan',
    username: 'jordan_ai',
    display_name: 'Jordan Lee',
    bio: 'AI researcher and open source builder',
    avatar_url: null,
    role: 'user',
    status: 'active',
    is_online: true,
    last_seen: new Date().toISOString(),
    created_at: '2026-01-15T09:00:00Z',
  },
  {
    id: 'usr_maya',
    username: 'maya_tech',
    display_name: 'Maya Patel',
    bio: 'Product Designer & UI specialist ✨',
    avatar_url: null,
    role: 'user',
    status: 'active',
    is_online: true,
    last_seen: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    created_at: '2026-02-01T11:00:00Z',
  },
  {
    id: 'usr_sam',
    username: 'sam_systems',
    display_name: 'Sam Miller',
    bio: 'Distributed systems & cloud infra',
    avatar_url: null,
    role: 'user',
    status: 'active',
    is_online: false,
    last_seen: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    created_at: '2026-02-14T14:30:00Z',
  },
];

export const ChatListPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { isOnline } = usePresence();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'chats' | 'contacts'>('chats');
  const [activeFolder, setActiveFolder] = useState<'all' | 'unread' | 'groups' | 'work' | 'archived'>('all');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [archivedChatIds, setArchivedChatIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('inspire_archived_chats');
    return saved ? JSON.parse(saved) : [];
  });
  const [manualUnreadChatIds, setManualUnreadChatIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('inspire_manual_unread_chats');
    return saved ? JSON.parse(saved) : [];
  });
  const [mutedChatIds, setMutedChatIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('inspire_muted_chats');
    return saved ? JSON.parse(saved) : [];
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeMenuPartnerId, setActiveMenuPartnerId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem('inspire_user_groups');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return [
      {
        id: 'grp_eng_core',
        name: 'Inspire Core Engineering 🚀',
        description: 'Architecture, real-time messaging sync, and Cloudflare R2 media pipelines',
        avatar_url: null,
        created_by: '11111111-1111-4111-8111-111111111111',
        created_at: '2026-02-01T10:00:00Z',
        members_count: 5,
        role: 'admin',
      },
      {
        id: 'grp_design_team',
        name: 'Inspire UI/UX & Motion 🎨',
        description: 'Tokens, dark mode parity, and interactive components',
        avatar_url: null,
        created_by: 'usr_maya',
        created_at: '2026-02-10T12:00:00Z',
        members_count: 4,
        role: 'member',
      },
    ];
  });
  const [isLoading, setIsLoading] = useState(true);

  // Add Contact & Group Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load conversations and contacts
  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    if (!isConfigured) {
      // Local seed data
      const convList: ConversationItem[] = [
        {
          id: 'conv_seed_1',
          partner: SEED_PROFILES[0],
          lastMessage: {
            id: 'seed_last_1',
            sender_id: 'usr_jordan',
            receiver_id: user.id,
            content: 'Sent you a quick voice note with ideas for the smart search and summarizer.',
            message_type: 'voice_note',
            media_url: 'https://actions.google.com/sounds/v1/ambiences/outdoor_water_fountain.ogg',
            media_size: 320000,
            media_name: 'voice_note.ogg',
            reply_to_id: null,
            is_deleted_sender: false,
            is_deleted_receiver: false,
            is_read: false,
            read_at: null,
            created_at: new Date(Date.now() - 180000).toISOString(),
          },
          unreadCount: 1,
        },
        {
          id: 'conv_seed_2',
          partner: SEED_PROFILES[1],
          lastMessage: {
            id: 'seed_last_2',
            sender_id: user.id,
            receiver_id: 'usr_maya',
            content: 'The new dark royal blue and yellow theme looks stunning!',
            message_type: 'text',
            media_url: null,
            media_size: null,
            media_name: null,
            reply_to_id: null,
            is_deleted_sender: false,
            is_deleted_receiver: false,
            is_read: true,
            read_at: new Date(Date.now() - 3600000 * 4).toISOString(),
            created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
          },
          unreadCount: 0,
        },
      ];
      setConversations(convList);
      setContacts(SEED_PROFILES);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch user's contacts
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('contact_id, profile:contact_id (*)')
        .eq('user_id', user.id);

      const loadedContacts = (contactsData || [])
        .map((c: { profile: unknown }) => c.profile as Profile)
        .filter(Boolean);
      setContacts(loadedContacts);

      // Fetch all messages visible to me to aggregate conversations correctly
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (messagesData) {
        // Group by partner
        const partnerMap = new Map<string, { lastMsg: Message; unread: number }>();
        const partnerIds = new Set<string>();

        for (const msg of messagesData as Message[]) {
          const isSender = msg.sender_id === user.id;
          const isDeleted = isSender ? msg.is_deleted_sender : msg.is_deleted_receiver;
          if (isDeleted) continue;

          const partnerId = isSender ? msg.receiver_id : msg.sender_id;
          if (!partnerId) continue;
          partnerIds.add(partnerId);

          if (!partnerMap.has(partnerId)) {
            partnerMap.set(partnerId, {
              lastMsg: msg,
              unread: !isSender && !msg.is_read ? 1 : 0,
            });
          } else if (!isSender && !msg.is_read) {
            const entry = partnerMap.get(partnerId)!;
            entry.unread += 1;
          }
        }

        if (partnerIds.size > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', Array.from(partnerIds));

          const profilesMap = new Map<string, Profile>();
          (profilesData || []).forEach((p: Profile) => profilesMap.set(p.id, p));

          const conversationList: ConversationItem[] = [];
          partnerMap.forEach((val, partnerId) => {
            const partnerProfile = profilesMap.get(partnerId) || {
              id: partnerId,
              username: 'user',
              display_name: 'Unknown User',
              bio: null,
              avatar_url: null,
              role: 'user',
              status: 'active',
              is_online: false,
              last_seen: new Date().toISOString(),
              created_at: new Date().toISOString(),
            };

            conversationList.push({
              id: partnerId,
              partner: partnerProfile,
              lastMessage: val.lastMsg,
              unreadCount: val.unread,
            });
          });

          // Sort by last message timestamp desc
          conversationList.sort((a, b) => {
            const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
            const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
            return timeB - timeA;
          });

          setConversations(conversationList);
        } else {
          setConversations([]);
        }
      }
    } catch (err) {
      console.warn('Error loading chat list:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePullRefresh = async () => {
    setIsRefreshing(true);
    triggerHaptic('light');
    await loadData();
    setTimeout(() => {
      setIsRefreshing(false);
      toast('Chat list up to date', 'info');
    }, 400);
  };

  const handleToggleArchive = (partnerId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveMenuPartnerId(null);
    triggerHaptic('medium');
    let updated: string[];
    if (archivedChatIds.includes(partnerId)) {
      updated = archivedChatIds.filter((id) => id !== partnerId);
      toast('Chat unarchived', 'info');
    } else {
      updated = [...archivedChatIds, partnerId];
      toast('Chat moved to Archived folder', 'info');
    }
    setArchivedChatIds(updated);
    localStorage.setItem('inspire_archived_chats', JSON.stringify(updated));
  };

  const handleToggleManualUnread = (partnerId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveMenuPartnerId(null);
    triggerHaptic('light');
    let updated: string[];
    if (manualUnreadChatIds.includes(partnerId)) {
      updated = manualUnreadChatIds.filter((id) => id !== partnerId);
      toast('Marked as read', 'info');
    } else {
      updated = [...manualUnreadChatIds, partnerId];
      toast('Marked as unread', 'info');
    }
    setManualUnreadChatIds(updated);
    localStorage.setItem('inspire_manual_unread_chats', JSON.stringify(updated));
  };

  const handleToggleMute = (partnerId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveMenuPartnerId(null);
    triggerHaptic('light');
    let updated: string[];
    if (mutedChatIds.includes(partnerId)) {
      updated = mutedChatIds.filter((id) => id !== partnerId);
      toast('Notifications unmuted', 'info');
    } else {
      updated = [...mutedChatIds, partnerId];
      toast('Muted notifications for this chat', 'info');
    }
    setMutedChatIds(updated);
    localStorage.setItem('inspire_muted_chats', JSON.stringify(updated));
  };

  const handleClearHistory = (partnerId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveMenuPartnerId(null);
    triggerHaptic('medium');
    setConversations((prev) =>
      prev.map((c) =>
        c.partner?.id === partnerId
          ? { ...c, lastMessage: null, unreadCount: 0 }
          : c
      )
    );
    toast('Chat history cleared for you', 'info');
  };

  // Search users by @username
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const q = searchQuery.trim().toLowerCase().replace(/^@/, '');

      if (!isConfigured) {
        const filtered = SEED_PROFILES.filter(
          (p) =>
            p.id !== user?.id &&
            (p.username?.toLowerCase().includes(q) ||
              p.display_name.toLowerCase().includes(q))
        );
        setSearchResults(filtered);
        setIsSearching(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', `%${q}%`)
          .neq('id', user?.id || '')
          .limit(10);

        if (!error && data) {
          setSearchResults(data as Profile[]);
        }
      } catch (err) {
        console.warn('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  const handleAddContact = async (contactUser: Profile) => {
    if (!user) return;

    if (!isConfigured) {
      if (!contacts.some((c) => c.id === contactUser.id)) {
        setContacts((prev) => [...prev, contactUser]);
      }
      toast(`Added @${contactUser.username} to your contacts!`, 'success');
      setShowAddModal(false);
      navigate(`/chat/${contactUser.id}`);
      return;
    }

    try {
      // Each user may create only their own contact row under RLS.
      const { error } = await supabase.from('contacts').upsert(
        { user_id: user.id, contact_id: contactUser.id },
        { onConflict: 'user_id,contact_id', ignoreDuplicates: true }
      );
      if (error) throw error;

      setContacts((prev) => prev.some((contact) => contact.id === contactUser.id)
        ? prev
        : [...prev, contactUser]);
      toast(`Added @${contactUser.username} to contacts!`, 'success');
      setShowAddModal(false);
      navigate(`/chat/${contactUser.id}`);
    } catch (err) {
      console.warn('Add contact error:', err);
      toast(err instanceof Error ? err.message : 'Failed to add contact', 'error');
    }
  };

  const totalUnread = useMemo(() => {
    return conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  }, [conversations]);

  const renderMessageSnippet = (msg: Message | null) => {
    if (!msg) return 'No messages yet';
    const isSender = msg.sender_id === user?.id;
    const isDeleted = isSender ? msg.is_deleted_sender : msg.is_deleted_receiver;
    if (isDeleted) return '🚫 Message deleted';

    switch (msg.message_type) {
      case 'image':
        return '📷 Photo';
      case 'video':
        return '🎬 Video';
      case 'audio':
        return '🎵 Audio';
      case 'voice_note':
        return '🎤 Voice note';
      default:
        return msg.content || '';
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !user) return;

    if (isConfigured) {
      try {
        const { data: createdGroup, error: groupError } = await supabase
          .from('groups')
          .insert({
            name: newGroupName.trim(),
            description: newGroupDesc.trim() || null,
            avatar_url: null,
            created_by: user.id,
            members_count: 1,
          })
          .select('*')
          .single();

        if (groupError || !createdGroup) {
          console.warn('Group creation failed:', groupError);
          toast(groupError?.message || 'Could not create group. Please try again.', 'error');
          return;
        }

        const { error: memberError } = await supabase.from('group_members').insert({
          group_id: createdGroup.id,
          user_id: user.id,
          role: 'admin',
        });
        if (memberError) {
          console.warn('Group membership creation failed:', memberError);
          await supabase.from('groups').delete().eq('id', createdGroup.id);
          toast('Group was created but membership could not be saved. Please try again.', 'error');
          return;
        }

        setShowCreateGroupModal(false);
        setNewGroupName('');
        setNewGroupDesc('');
        toast(`Group "${createdGroup.name}" created!`, 'success');
        navigate(`/group/${createdGroup.id}`);
        return;
      } catch (err) {
        console.warn('Group creation exception:', err);
        toast('Could not create group. Please try again.', 'error');
        return;
      }
    }

    const newGrp: Group = {
      id: `grp_${Date.now()}`,
      name: newGroupName.trim(),
      description: newGroupDesc.trim() || null,
      avatar_url: null,
      created_by: user.id,
      created_at: new Date().toISOString(),
      members_count: 1,
      role: 'admin',
    };
    const updated = [newGrp, ...groups];
    setGroups(updated);
    localStorage.setItem('inspire_user_groups', JSON.stringify(updated));
    setShowCreateGroupModal(false);
    setNewGroupName('');
    setNewGroupDesc('');
    toast(`Group "${newGrp.name}" created!`, 'success');
    navigate(`/group/${newGrp.id}`);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0E2A6E] flex items-center justify-center text-[#FFD700] text-xl font-black shadow-md">
              💬
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-black dark:text-white leading-tight">
                Inspire
              </h1>
              <span className="text-[11px] font-bold text-[#4B5563] dark:text-[#9CA3AF]">
                @{user?.username || 'user'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => navigate('/search')}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-sm transition-colors"
              title="Global Search (Cmd+K)"
              aria-label="Global Search"
            >
              🔍
            </button>
            <button
              onClick={handlePullRefresh}
              disabled={isRefreshing}
              className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-sm transition-colors ${
                isRefreshing ? 'animate-spin' : ''
              }`}
              title="Refresh chats"
              aria-label="Refresh chats"
            >
              🔄
            </button>
            <button
              onClick={() => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('inspire_theme', isDark ? 'dark' : 'light');
              }}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-sm transition-colors"
              title="Toggle theme"
              aria-label="Toggle dark mode"
            >
              🌓
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="p-0.5 rounded-full ring-2 ring-transparent hover:ring-[#0E2A6E] transition-all ml-1"
              aria-label="View profile"
            >
              <Avatar
                name={user?.display_name || user?.username || 'You'}
                avatarUrl={user?.avatar_url}
                size="sm"
              />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Chats vs Contacts */}
        <div className="max-w-md mx-auto mt-3 flex rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] p-1 border border-[#E5E7EB] dark:border-[#2A3348]">
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-1.5 text-xs font-extrabold rounded-xl transition-all ${
              activeTab === 'chats'
                ? 'bg-white dark:bg-[#161B2B] text-[#0E2A6E] dark:text-[#3D6FE0] shadow-sm'
                : 'text-[#4B5563] dark:text-[#9CA3AF] hover:text-black dark:hover:text-white'
            }`}
          >
            Chats ({conversations.length + groups.length})
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 py-1.5 text-xs font-extrabold rounded-xl transition-all ${
              activeTab === 'contacts'
                ? 'bg-white dark:bg-[#161B2B] text-[#0E2A6E] dark:text-[#3D6FE0] shadow-sm'
                : 'text-[#4B5563] dark:text-[#9CA3AF] hover:text-black dark:hover:text-white'
            }`}
          >
            Contacts ({contacts.length})
          </button>
        </div>

        {/* Feature 55 & Feature 75: Chat Folders & Category Filter */}
        {activeTab === 'chats' && (
          <div className="max-w-md mx-auto mt-2.5 flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
            {(['all', 'unread', 'groups', 'work', 'archived'] as const).map((folder) => (
              <button
                key={folder}
                onClick={() => setActiveFolder(folder)}
                className={`px-3 py-1 rounded-xl text-[11px] font-extrabold capitalize whitespace-nowrap transition-colors ${
                  activeFolder === folder
                    ? 'bg-[#0E2A6E] text-white shadow-xs'
                    : 'bg-[#F5F7FA] dark:bg-[#1A2234] text-gray-500 hover:text-black dark:hover:text-white border border-[#E5E7EB] dark:border-[#2A3348]'
                }`}
              >
                {folder === 'all'
                  ? 'All Chats'
                  : folder === 'unread'
                  ? `Unread (${totalUnread})`
                  : folder === 'groups'
                  ? `Groups (${groups.length})`
                  : folder === 'work'
                  ? 'Work'
                  : `Archived (${archivedChatIds.length})`}
              </button>
            ))}
          </div>
        )}

        {/* Quick Actions Shortcuts */}
        {activeTab === 'chats' && (
          <div className="max-w-md mx-auto mt-2 flex items-center space-x-2 overflow-x-auto pb-1">
            <button
              onClick={() => navigate('/search')}
              className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-[#0E2A6E] dark:text-[#3D6FE0] border border-blue-200 dark:border-blue-800 text-[10px] font-extrabold flex items-center space-x-1 whitespace-nowrap hover:bg-blue-100"
            >
              <span>🔍</span>
              <span>Search All</span>
            </button>
            <button
              onClick={() => navigate('/secret-chats')}
              className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-extrabold flex items-center space-x-1 whitespace-nowrap hover:bg-purple-100"
            >
              <span>🔏</span>
              <span>Secret Vault</span>
            </button>
            <button
              onClick={() => navigate('/starred')}
              className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-extrabold flex items-center space-x-1 whitespace-nowrap hover:bg-amber-100"
            >
              <span>⭐</span>
              <span>Starred</span>
            </button>
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-extrabold flex items-center space-x-1 whitespace-nowrap hover:bg-blue-100"
            >
              <span>👥</span>
              <span>+ New Group</span>
            </button>
            <button
              onClick={() => navigate('/support')}
              className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-extrabold flex items-center space-x-1 whitespace-nowrap hover:bg-emerald-100"
            >
              <span>🎧</span>
              <span>Support</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto px-4 py-2">
        {isLoading ? (
          // Skeleton loading rows
          <div className="space-y-3 pt-2" aria-label="Loading conversations">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center space-x-3 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800/60 animate-pulse"
              >
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800/60 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'chats' ? (
          /* Render Groups in Group Folder */
          activeFolder === 'groups' ? (
            <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A3348]">
              {groups.map((grp) => (
                <div
                  key={grp.id}
                  onClick={() => navigate(`/group/${grp.id}`)}
                  className="flex items-center space-x-3.5 py-3 px-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center text-xl font-bold shadow-sm">
                    👥
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-sm truncate">{grp.name}</h4>
                      <span className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-extrabold px-1.5 py-0.5 rounded">
                        {grp.members_count} members
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{grp.description}</p>
                  </div>
                </div>
              ))}
              <div className="pt-4 text-center">
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  className="px-4 py-2 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold shadow-sm"
                >
                  + Create New Group
                </button>
              </div>
            </div>
          ) : (
            /* Filtered Conversations */
            (() => {
              const displayList = conversations.filter((c) => {
                if (!c.partner) return false;
                const isArchived = archivedChatIds.includes(c.partner.id);
                if (activeFolder === 'archived') return isArchived;
                if (isArchived) return false;
                if (activeFolder === 'unread') {
                  return c.unreadCount > 0 || manualUnreadChatIds.includes(c.partner.id);
                }
                return true;
              });

              if (displayList.length === 0) {
                return (
                  <div className="text-center py-16 px-4 animate-fade-in">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-[#0E2A6E]/10 dark:bg-[#3D6FE0]/10 text-[#0E2A6E] dark:text-[#3D6FE0] flex items-center justify-center text-4xl shadow-inner">
                      {activeFolder === 'archived' ? '📦' : '💬'}
                    </div>
                    <h3 className="text-lg font-bold text-black dark:text-white">
                      {activeFolder === 'unread'
                        ? 'No unread messages'
                        : activeFolder === 'archived'
                        ? 'No archived conversations'
                        : 'No chats yet'}
                    </h3>
                    <p className="text-xs font-medium text-[#4B5563] dark:text-[#9CA3AF] max-w-xs mx-auto mt-1 mb-6 leading-relaxed">
                      {activeFolder === 'archived'
                        ? 'Archived conversations stay safe here without cluttering your main inbox.'
                        : 'Connect with anyone using their unique @username or join a group chat.'}
                    </p>
                    {activeFolder !== 'archived' && (
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="inline-flex items-center space-x-2 px-5 py-3 rounded-2xl bg-[#0E2A6E] text-white font-extrabold text-xs hover:bg-[#081B47] active:scale-95 shadow-md transition-all"
                      >
                        <span>➕</span>
                        <span>Find or Add Contact</span>
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A3348]">
                  {/* Also show top group if on All */}
                  {activeFolder === 'all' && groups.length > 0 && (
                    <div
                      onClick={() => navigate(`/group/${groups[0].id}`)}
                      className="flex items-center space-x-3.5 py-3 px-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer transition-colors bg-blue-50/30 dark:bg-blue-950/10 mb-1"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center text-lg font-bold shadow-xs">
                        👥
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="font-extrabold text-sm truncate">{groups[0].name}</h4>
                          <span className="text-[10px] text-gray-400">Group</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{groups[0].description}</p>
                      </div>
                    </div>
                  )}

                  {displayList.map(({ partner, lastMessage, unreadCount }) => {
                    if (!partner) return null;
                    const partnerOnline = isOnline(partner.id);
                    const isManualUnread = manualUnreadChatIds.includes(partner.id);
                    const effectiveUnread = unreadCount > 0 || isManualUnread;
                    const isMuted = mutedChatIds.includes(partner.id);
                    const isArchived = archivedChatIds.includes(partner.id);
                    const isMenuOpen = activeMenuPartnerId === partner.id;

                    return (
                      <div
                        key={partner.id}
                        className="relative group/row"
                      >
                        <div
                          onClick={() => navigate(`/chat/${partner.id}`)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && navigate(`/chat/${partner.id}`)}
                          className="flex items-center space-x-3.5 py-3 px-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer transition-colors"
                        >
                          <div className="relative">
                            <Avatar
                              name={partner.display_name || partner.username || 'User'}
                              avatarUrl={partner.avatar_url}
                              size="md"
                              showOnlineStatus={true}
                              isOnline={partnerOnline}
                            />
                            {partner.availability_status && partner.availability_status !== 'available' && (
                              <span
                                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white dark:ring-[#0B0F1A] ${
                                  partner.availability_status === 'busy'
                                    ? 'bg-amber-500'
                                    : partner.availability_status === 'away'
                                    ? 'bg-orange-500'
                                    : 'bg-gray-400'
                                }`}
                                title={`Availability: ${partner.availability_status}`}
                              />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center space-x-1.5 truncate">
                                <h4 className="font-extrabold text-sm text-black dark:text-white truncate">
                                  {partner.display_name}
                                </h4>
                                {partner.verified && (
                                  <span
                                    className="w-3.5 h-3.5 rounded-full bg-[#0E2A6E] dark:bg-[#3D6FE0] text-[#FFD700] inline-flex items-center justify-center text-[9px] font-black shrink-0"
                                    title="Verified Account"
                                  >
                                    ✓
                                  </span>
                                )}
                                {isMuted && <span className="text-xs text-gray-400" title="Muted">🔕</span>}
                              </div>
                              {lastMessage && (
                                <span className="text-[11px] font-normal text-[#4B5563] dark:text-[#9CA3AF] flex-shrink-0 ml-2">
                                  {formatLastSeen(lastMessage.created_at)}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <p
                                className={`text-xs truncate ${
                                  effectiveUnread
                                    ? 'font-bold text-black dark:text-white'
                                    : 'font-normal text-[#4B5563] dark:text-[#9CA3AF]'
                                }`}
                              >
                                {renderMessageSnippet(lastMessage)}
                              </p>

                              <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                                {effectiveUnread && (
                                  <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-[#FFD700] text-[#1A1A2E] shadow-sm flex-shrink-0 animate-fade-in">
                                    {unreadCount || 1}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuPartnerId(isMenuOpen ? null : partner.id);
                                  }}
                                  className="w-7 h-7 rounded-full text-gray-400 hover:text-black dark:hover:text-white flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors"
                                  aria-label="Conversation options"
                                >
                                  ⋮
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Dropdown Context Menu (Feature 75, 76, 77, 50) */}
                        {isMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-2 top-12 z-40 w-44 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl py-1 text-xs font-bold animate-slide-up"
                          >
                            <button
                              onClick={(e) => handleToggleArchive(partner.id, e)}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-gray-700 dark:text-gray-200"
                            >
                              <span>{isArchived ? '📂' : '📦'}</span>
                              <span>{isArchived ? 'Unarchive' : 'Archive Chat'}</span>
                            </button>
                            <button
                              onClick={(e) => handleToggleManualUnread(partner.id, e)}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-gray-700 dark:text-gray-200"
                            >
                              <span>{isManualUnread ? '👁️' : '✉️'}</span>
                              <span>{isManualUnread ? 'Mark as Read' : 'Mark as Unread'}</span>
                            </button>
                            <button
                              onClick={(e) => handleToggleMute(partner.id, e)}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-gray-700 dark:text-gray-200"
                            >
                              <span>{isMuted ? '🔔' : '🔕'}</span>
                              <span>{isMuted ? 'Unmute' : 'Mute Notifications'}</span>
                            </button>
                            <button
                              onClick={(e) => handleClearHistory(partner.id, e)}
                              className="w-full px-3 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center space-x-2 text-rose-600 dark:text-rose-400 border-t border-gray-100 dark:border-gray-800 mt-1 pt-1.5"
                            >
                              <span>🗑️</span>
                              <span>Clear History</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )
        ) : (
          // Contacts Tab List
          contacts.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-3xl">
                👥
              </div>
              <p className="text-sm font-bold text-black dark:text-white">
                No contacts added yet
              </p>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-1 mb-4">
                Add friends by searching their exact @username
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 rounded-xl bg-[#0E2A6E] text-white font-bold text-xs"
              >
                Add Contact
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A3348]">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between py-3 px-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900/50"
                >
                  <div
                    onClick={() => navigate(`/chat/${contact.id}`)}
                    className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0"
                  >
                    <Avatar
                      name={contact.display_name}
                      avatarUrl={contact.avatar_url}
                      size="sm"
                      showOnlineStatus={true}
                      isOnline={isOnline(contact.id)}
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-black dark:text-white truncate">
                        {contact.display_name}
                      </h4>
                      <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF]">
                        @{contact.username}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/chat/${contact.id}`)}
                    className="px-3 py-1.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47] active:scale-95 shadow-sm"
                  >
                    Message
                  </button>
                </div>
              ))}

              {/* Feature 147: Smart Contact Suggestions ("People You May Know") */}
              <div className="pt-6 pb-2">
                <div className="flex items-center justify-between mb-3 px-2">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    People You May Know ✨
                  </h4>
                  <span className="text-[10px] text-[#0E2A6E] dark:text-[#3D6FE0] font-bold">
                    Smart Suggestions
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      id: 'usr_elena',
                      username: 'elena_r',
                      display_name: 'Elena Rostova',
                      mutual_count: 3,
                      bio: 'Fullstack developer & WebSockets enthusiast',
                    },
                    {
                      id: 'usr_marcus',
                      username: 'marcus_v',
                      display_name: 'Marcus Vance',
                      mutual_count: 2,
                      bio: 'Security researcher & cryptographer',
                    },
                    {
                      id: 'usr_chloe',
                      username: 'chloe_ai',
                      display_name: 'Chloe Zhang',
                      mutual_count: 4,
                      bio: 'Product manager building real-time UX',
                    },
                  ]
                    .filter((sug) => !contacts.some((c) => c.id === sug.id))
                    .map((sug) => (
                      <div
                        key={sug.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] shadow-xs"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <Avatar name={sug.display_name} size="sm" />
                          <div className="min-w-0">
                            <h5 className="font-bold text-xs text-black dark:text-white truncate">
                              {sug.display_name}
                            </h5>
                            <p className="text-[10px] text-gray-400 truncate">
                              @{sug.username} • <span className="text-[#0E2A6E] dark:text-[#3D6FE0] font-bold">{sug.mutual_count} mutual contacts</span>
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            handleAddContact({
                              id: sug.id,
                              username: sug.username,
                              display_name: sug.display_name,
                              bio: sug.bio,
                              avatar_url: null,
                              role: 'user',
                              status: 'active',
                              is_online: true,
                              last_seen: new Date().toISOString(),
                              created_at: new Date().toISOString(),
                            });
                          }}
                          className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#0E2A6E] dark:text-[#3D6FE0] hover:bg-[#0E2A6E] hover:text-white text-[11px] font-bold transition-colors"
                        >
                          + Connect
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )
        )}
      </main>

      {/* Floating Action Button (Dark Royal Blue circle + Yellow plus glyph) */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-20 right-5 z-40 w-14 h-14 rounded-full bg-[#0E2A6E] text-[#FFD700] text-2xl font-black shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="Add new contact or start chat"
      >
        +
      </button>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-t-3xl sm:rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up max-h-[85vh] flex flex-col"
            role="dialog"
            aria-label="Add Contact"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] dark:border-[#2A3348]">
              <h3 className="font-extrabold text-base text-black dark:text-white">
                Add New Contact
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery('');
                }}
                className="p-1 rounded-full text-gray-400 hover:text-black dark:hover:text-white text-sm font-bold"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="my-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                Search by @username
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-gray-400 font-bold text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="type username to search…"
                  autoFocus
                  className="w-full pl-8 pr-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium focus:outline-none focus:border-[#0E2A6E] text-sm"
                />
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-[140px]">
              {isSearching ? (
                <div className="text-center py-8 text-xs text-gray-400 animate-pulse">
                  Searching for users…
                </div>
              ) : searchQuery && searchResults.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#4B5563] dark:text-[#9CA3AF]">
                  No users found matching "@{searchQuery}"
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((resUser) => (
                  <div
                    key={resUser.id}
                    className="flex items-center justify-between p-3 rounded-2xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar
                        name={resUser.display_name}
                        avatarUrl={resUser.avatar_url}
                        size="sm"
                      />
                      <div>
                        <h5 className="font-bold text-sm text-black dark:text-white">
                          {resUser.display_name}
                        </h5>
                        <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF]">
                          @{resUser.username}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAddContact(resUser)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47] active:scale-95 shadow-sm"
                    >
                      Add & Chat
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-[#4B5563] dark:text-[#9CA3AF]">
                  Tip: Ask friends for their @username to connect directly.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-t-3xl sm:rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up"
            role="dialog"
            aria-label="Create New Group"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] dark:border-[#2A3348]">
              <div className="flex items-center space-x-2">
                <span className="text-xl">👥</span>
                <h3 className="font-extrabold text-base text-black dark:text-white">
                  Create New Group
                </h3>
              </div>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-black dark:hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                  Group Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Design Sync, Family, Project Phoenix"
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium focus:outline-none focus:border-[#0E2A6E] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Group topic, guidelines or purpose..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium focus:outline-none focus:border-[#0E2A6E] text-sm"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation */}
      <BottomNav totalUnread={totalUnread} isAdmin={isAdmin} />
    </div>
  );
};
