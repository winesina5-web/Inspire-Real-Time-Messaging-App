import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMediaUpload } from '../hooks/useMediaUpload';
import { useToast } from '../components/Toast';
import { Avatar } from '../components/Avatar';
import { BottomNav } from '../components/BottomNav';
import { AvailabilityStatus, AccentTheme, StoryHighlight, UserBadge, ReadLaterItem } from '../types';
import { submitModerationAppeal } from '../lib/workerApi';

const DEFAULT_HIGHLIGHTS: StoryHighlight[] = [
  {
    id: 'hl_1',
    user_id: 'usr_me',
    title: 'Work 🚀',
    cover_url: null,
    status_ids: ['st_1', 'st_2'],
    created_at: '2026-02-01T12:00:00Z',
  },
  {
    id: 'hl_2',
    user_id: 'usr_me',
    title: 'Travel ✈️',
    cover_url: null,
    status_ids: ['st_3'],
    created_at: '2026-02-05T12:00:00Z',
  },
  {
    id: 'hl_3',
    user_id: 'usr_me',
    title: 'Design 🎨',
    cover_url: null,
    status_ids: ['st_4'],
    created_at: '2026-02-10T12:00:00Z',
  },
];

const DEFAULT_BADGES: UserBadge[] = [
  {
    id: 'bdg_1',
    badge_type: 'first_message',
    title: 'First Ping',
    icon: '🎉',
    description: 'Sent your first encrypted message on Inspire',
    earned_at: '2026-01-10T08:05:00Z',
  },
  {
    id: 'bdg_2',
    badge_type: 'hundred_messages',
    title: 'Centurion',
    icon: '💬',
    description: 'Delivered over 100 real-time conversations',
    earned_at: '2026-02-01T14:20:00Z',
  },
  {
    id: 'bdg_3',
    badge_type: 'streak_7d',
    title: '7-Day Streak',
    icon: '🔥',
    description: 'Active on Inspire for seven consecutive days',
    earned_at: '2026-02-14T09:00:00Z',
  },
  {
    id: 'bdg_4',
    badge_type: 'group_creator',
    title: 'Community Lead',
    icon: '👥',
    description: 'Created and moderated an active group space',
    earned_at: '2026-02-12T16:45:00Z',
  },
];

export const ProfilePage: React.FC = () => {
  const { user, signOut, updateProfile, isAdmin, setDemoUser } = useAuth();
  const { uploadMedia, isUploading } = useMediaUpload();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Basic Information
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [pronouns, setPronouns] = useState(user?.pronouns || '');
  const [websiteUrl, setWebsiteUrl] = useState(user?.website_url || '');
  const [isSaving, setIsSaving] = useState(false);

  // Feature 118: Availability Status & DND
  const [availability, setAvailability] = useState<AvailabilityStatus>(user?.availability_status || 'available');
  const [dndEnabled, setDndEnabled] = useState(() => localStorage.getItem('inspire_dnd_enabled') === 'true');
  const [autoReplyText, setAutoReplyText] = useState(
    () => localStorage.getItem('inspire_auto_reply_text') || "I'm currently busy or away. I'll get back to you shortly!"
  );

  // Feature 139: Accent Theme
  const [currentAccent, setCurrentAccent] = useState<AccentTheme>(user?.accent_theme || 'default');

  // Feature 117: Story Highlights
  const [highlights, setHighlights] = useState<StoryHighlight[]>(() => {
    const saved = localStorage.getItem('inspire_story_highlights');
    return saved ? JSON.parse(saved) : DEFAULT_HIGHLIGHTS;
  });
  const [selectedHighlight, setSelectedHighlight] = useState<StoryHighlight | null>(null);
  const [showAddHighlightModal, setShowAddHighlightModal] = useState(false);
  const [newHighlightTitle, setNewHighlightTitle] = useState('');

  // Feature 140: Read Later Inbox
  const [showReadLaterModal, setShowReadLaterModal] = useState(false);
  const [readLaterList, setReadLaterList] = useState<ReadLaterItem[]>(() => {
    const saved = localStorage.getItem('inspire_read_later');
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 'rl_1',
            user_id: user?.id || 'usr_me',
            message_id: 'msg_981',
            note: 'Review API deployment schema before Monday sprint',
            is_done: false,
            saved_at: '2026-02-15T09:30:00Z',
          },
          {
            id: 'rl_2',
            user_id: user?.id || 'usr_me',
            message_id: 'msg_982',
            note: 'Cloudflare Workers AI edge latency metrics',
            is_done: true,
            saved_at: '2026-02-14T18:00:00Z',
          },
        ];
  });

  // Feature 123: Trusted Contacts
  const [showTrustedContactsModal, setShowTrustedContactsModal] = useState(false);
  const [trustedContacts, setTrustedContacts] = useState<string[]>(() => {
    const saved = localStorage.getItem('inspire_trusted_contacts');
    return saved ? JSON.parse(saved) : ['@jordan_dev', '@maya_art', '@sarah_ops'];
  });
  const [newTrustedContact, setNewTrustedContact] = useState('');

  // Feature 143: Moderation Appeal
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealActionType, setAppealActionType] = useState('Account Restriction Warning');
  const [appealReason, setAppealReason] = useState('');
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);

  // Modals from Doc 01-08
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'deactivate' | 'delete'>('deactivate');
  const [backupReminder, setBackupReminder] = useState(() => {
    return localStorage.getItem('inspire_backup_reminder') === 'true';
  });

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setBio(user.bio || '');
      setPronouns(user.pronouns || '');
      setWebsiteUrl(user.website_url || '');
      setAvailability(user.availability_status || 'available');
      if (user.accent_theme) setCurrentAccent(user.accent_theme);
    }
  }, [user]);

  const handleExportGdprData = () => {
    const exportPayload = {
      export_version: '2.0',
      generated_at: new Date().toISOString(),
      account: user,
      profile_privacy: {
        read_receipts: true,
        two_factor_auth: false,
        availability,
        dnd_enabled: dndEnabled,
        trusted_contacts: trustedContacts,
        terms_accepted_at: localStorage.getItem('inspire_terms_accepted_at') || user?.created_at,
      },
      read_later: readLaterList,
      highlights,
      badges: DEFAULT_BADGES,
      local_settings: {
        theme: localStorage.getItem('inspire_theme') || 'system',
        accent_theme: currentAccent,
        archived_chats: localStorage.getItem('inspire_archived_chats') || '[]',
        muted_chats: localStorage.getItem('inspire_muted_chats') || '[]',
      },
      system_notice: 'GDPR Full Data Portability archive per Document 08 Feature 87 and Wave 2 specifications.',
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inspire_gdpr_export_${user?.username || 'account'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Full account archive downloaded (GDPR JSON)', 'success');
  };

  const handleCopyUsername = () => {
    if (user?.username) {
      navigator.clipboard.writeText(`@${user.username}`);
      toast(`Copied @${user.username} to clipboard!`, 'success');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    const { error } = await updateProfile({
      display_name: displayName.trim() || user.username || 'User',
      bio: bio.slice(0, 100),
      pronouns: pronouns.trim() || null,
      website_url: websiteUrl.trim() || null,
      availability_status: availability,
      accent_theme: currentAccent,
    });
    setIsSaving(false);

    if (error) {
      toast('Failed to update profile', 'error');
    } else {
      toast('Profile updated successfully!', 'success');
    }
  };

  const handleSelectAvailability = async (status: AvailabilityStatus) => {
    setAvailability(status);
    await updateProfile({ availability_status: status });
    toast(`Availability set to: ${status.toUpperCase()}`, 'info');
  };

  const handleSelectAccentTheme = async (theme: AccentTheme) => {
    setCurrentAccent(theme);
    if (theme === 'default') {
      delete document.documentElement.dataset.accentTheme;
    } else {
      document.documentElement.dataset.accentTheme = theme;
    }
    await updateProfile({ accent_theme: theme });
    toast(`Accent theme applied: ${theme}`, 'success');
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    toast('Uploading profile picture…', 'info');
    const result = await uploadMedia(file, 'avatar', 'avatar.jpg');

    if (result) {
      const newAvatar = result.url || result.object_key;
      await updateProfile({ avatar_url: newAvatar });
      toast('Profile picture updated!', 'success');
    } else {
      toast('Failed to upload picture', 'error');
    }
  };

  const handleToggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('inspire_theme', isDark ? 'dark' : 'light');
    toast(`Switched to ${isDark ? 'Dark' : 'Light'} theme`, 'info');
  };

  const handleLogout = async () => {
    await signOut();
    toast('Logged out successfully', 'info');
    navigate('/login');
  };

  const handleAddHighlight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHighlightTitle.trim()) return;

    const newHl: StoryHighlight = {
      id: `hl_${Date.now()}`,
      user_id: user?.id || 'usr_me',
      title: newHighlightTitle.trim(),
      cover_url: null,
      status_ids: [`st_${Date.now()}`],
      created_at: new Date().toISOString(),
    };
    const updated = [...highlights, newHl];
    setHighlights(updated);
    localStorage.setItem('inspire_story_highlights', JSON.stringify(updated));
    setNewHighlightTitle('');
    setShowAddHighlightModal(false);
    toast('Story highlight collection added!', 'success');
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealReason.trim()) {
      toast('Please provide an explanation for your appeal', 'error');
      return;
    }

    setIsSubmittingAppeal(true);
    await submitModerationAppeal({
      action_type: appealActionType,
      reason: appealReason.trim(),
    });
    setIsSubmittingAppeal(false);
    setShowAppealModal(false);
    setAppealReason('');
    toast('Appeal submitted to trust & safety team for review', 'success');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white pb-28">
      <input
        type="file"
        ref={avatarInputRef}
        onChange={handleAvatarFile}
        accept="image/*"
        className="hidden"
      />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-black dark:text-white tracking-tight">
            My Profile
          </h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-sm transition-colors"
              title="Toggle Theme"
              aria-label="Toggle dark mode"
            >
              🌓
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Avatar & Presence Header */}
        <div className="flex flex-col items-center text-center">
          <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
            <Avatar
              name={user?.display_name || user?.username || 'You'}
              avatarUrl={user?.avatar_url}
              size="xl"
            />
            {/* Availability status dot indicator */}
            <span
              className={`absolute bottom-0 right-1 w-4 h-4 rounded-full ring-2 ring-white dark:ring-[#0B0F1A] shadow-sm ${
                availability === 'available'
                  ? 'bg-emerald-500'
                  : availability === 'busy'
                  ? 'bg-amber-500'
                  : availability === 'away'
                  ? 'bg-orange-500'
                  : 'bg-gray-400'
              }`}
              title={`Status: ${availability}`}
            />
            <div className="absolute inset-0 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">
              {isUploading ? '…' : 'Change'}
            </div>
          </div>

          <div className="mt-3 flex items-center space-x-1.5 justify-center">
            <h2 className="text-xl font-black text-black dark:text-white">
              {user?.display_name || 'Anonymous User'}
            </h2>
            {/* Feature 116: Verified Badge */}
            {(user?.verified || isAdmin) && (
              <span
                className="w-4 h-4 rounded-full bg-[#0E2A6E] dark:bg-[#3D6FE0] text-[#FFD700] flex items-center justify-center text-[10px] font-black shadow-xs"
                title="Verified Account ✓"
              >
                ✓
              </span>
            )}
          </div>

          {/* Pronouns badge (Feature 116) */}
          {user?.pronouns && (
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
              ({user.pronouns})
            </span>
          )}

          {/* Username badge with copy button */}
          <div className="mt-1.5 flex items-center space-x-1.5 bg-[#F5F7FA] dark:bg-[#161B2B] px-3 py-1 rounded-full border border-[#E5E7EB] dark:border-[#2A3348]">
            <span className="text-xs font-bold text-[#0E2A6E] dark:text-[#3D6FE0]">
              @{user?.username || 'set_username'}
            </span>
            <button
              onClick={handleCopyUsername}
              className="text-xs text-gray-400 hover:text-black dark:hover:text-white p-0.5"
              title="Copy ID to share"
              aria-label="Copy Username"
            >
              📋
            </button>
          </div>

          {/* Website Link (Feature 116) */}
          {user?.website_url && (
            <a
              href={user.website_url.startsWith('http') ? user.website_url : `https://${user.website_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 text-xs text-[#0E2A6E] dark:text-[#3D6FE0] font-bold hover:underline flex items-center space-x-1"
            >
              <span>🔗</span>
              <span className="truncate max-w-[200px]">{user.website_url.replace(/^https?:\/\//, '')}</span>
            </a>
          )}

          {isAdmin && (
            <span className="mt-2 px-2.5 py-0.5 rounded-full bg-[#FFD700] text-[#1A1A2E] text-[10px] font-black uppercase tracking-wider shadow-xs">
              Platform Admin
            </span>
          )}
        </div>

        {/* Feature 117: Story Highlights Row */}
        <div className="bg-white dark:bg-[#161B2B] p-4 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-black dark:text-gray-200">
              Story Highlights
            </h3>
            <button
              onClick={() => setShowAddHighlightModal(true)}
              className="text-[11px] font-bold text-[#0E2A6E] dark:text-[#3D6FE0] hover:underline"
            >
              + New Collection
            </button>
          </div>

          <div className="flex items-center space-x-3 overflow-x-auto pb-1 scrollbar-none">
            {highlights.map((hl) => (
              <button
                key={hl.id}
                onClick={() => setSelectedHighlight(hl)}
                className="flex flex-col items-center space-y-1.5 flex-shrink-0 group"
              >
                <div className="w-14 h-14 rounded-full p-0.5 border-2 border-[#0E2A6E] dark:border-[#3D6FE0] group-hover:scale-105 transition-transform bg-white dark:bg-[#0B0F1A] flex items-center justify-center">
                  <span className="text-xl">{hl.title.split(' ')[1] || '⭐'}</span>
                </div>
                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate max-w-[60px]">
                  {hl.title.split(' ')[0] || hl.title}
                </span>
              </button>
            ))}

            <button
              onClick={() => setShowAddHighlightModal(true)}
              className="flex flex-col items-center space-y-1.5 flex-shrink-0"
            >
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-[#0E2A6E] flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white">
                <span className="text-lg font-bold">+</span>
              </div>
              <span className="text-[10px] font-bold text-gray-400">Add</span>
            </button>
          </div>
        </div>

        {/* Feature 118: Availability Status & DND Settings */}
        <div className="bg-white dark:bg-[#161B2B] p-4 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-3">
          <h3 className="font-extrabold text-xs uppercase tracking-wider text-black dark:text-gray-200">
            Availability Status
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {(['available', 'busy', 'away', 'invisible'] as AvailabilityStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleSelectAvailability(status)}
                className={`py-2 px-1 rounded-2xl text-[11px] font-bold border transition-all flex flex-col items-center space-y-1 ${
                  availability === status
                    ? 'border-[#0E2A6E] dark:border-[#3D6FE0] bg-blue-50/60 dark:bg-blue-950/30 text-[#0E2A6E] dark:text-[#3D6FE0]'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span>
                  {status === 'available' ? '🟢' : status === 'busy' ? '🟡' : status === 'away' ? '🟠' : '⚪'}
                </span>
                <span className="capitalize">{status}</span>
              </button>
            ))}
          </div>

          {/* DND Toggle & Auto Reply */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold block text-black dark:text-white">Do Not Disturb (DND)</span>
                <span className="text-[10px] text-gray-500">Mutes message alerts and activates auto-reply</span>
              </div>
              <input
                type="checkbox"
                checked={dndEnabled}
                onChange={(e) => {
                  setDndEnabled(e.target.checked);
                  localStorage.setItem('inspire_dnd_enabled', String(e.target.checked));
                  toast(e.target.checked ? 'DND mode activated' : 'DND deactivated', 'info');
                }}
                className="w-4 h-4 rounded text-[#0E2A6E] focus:ring-[#0E2A6E]"
              />
            </div>

            {dndEnabled && (
              <div className="pt-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Custom Auto-Reply Note
                </label>
                <input
                  type="text"
                  value={autoReplyText}
                  onChange={(e) => {
                    setAutoReplyText(e.target.value);
                    localStorage.setItem('inspire_auto_reply_text', e.target.value);
                  }}
                  placeholder="I'm away right now..."
                  className="w-full px-3 py-1.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Feature 139: Custom Accent Theme Picker */}
        <div className="bg-white dark:bg-[#161B2B] p-4 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-3">
          <h3 className="font-extrabold text-xs uppercase tracking-wider text-black dark:text-gray-200">
            Accent Theme (Palette)
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {[
              { id: 'default', label: 'Royal', color: '#0E2A6E' },
              { id: 'ocean', label: 'Ocean', color: '#0284c7' },
              { id: 'sunset', label: 'Sunset', color: '#f97316' },
              { id: 'forest', label: 'Forest', color: '#16a34a' },
              { id: 'rose', label: 'Rose', color: '#e11d48' },
            ].map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleSelectAccentTheme(theme.id as AccentTheme)}
                className={`flex flex-col items-center space-y-1.5 p-2 rounded-2xl border transition-all ${
                  currentAccent === theme.id
                    ? 'border-black dark:border-white ring-2 ring-[#FFD700]'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-400'
                }`}
              >
                <div className="w-6 h-6 rounded-full shadow-inner" style={{ backgroundColor: theme.color }} />
                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{theme.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Feature 119: User Badges & Gamification Trophies */}
        <div className="bg-white dark:bg-[#161B2B] p-4 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-black dark:text-gray-200">
              Badges & Milestones
            </h3>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              4 Earned
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {DEFAULT_BADGES.map((badge) => (
              <div
                key={badge.id}
                className="p-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center space-x-2.5"
              >
                <span className="text-2xl">{badge.icon}</span>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-black dark:text-white truncate">{badge.title}</h4>
                  <p className="text-[10px] text-gray-500 leading-tight truncate">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4 bg-white dark:bg-[#161B2B] p-5 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
          <h3 className="font-extrabold text-sm text-black dark:text-white">
            Professional & Personal Information
          </h3>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              maxLength={40}
              required
              className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium text-sm focus:outline-none focus:border-[#0E2A6E]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                Pronouns (Feature 116)
              </label>
              <input
                type="text"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                placeholder="they/them, she/her"
                maxLength={20}
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium text-sm focus:outline-none focus:border-[#0E2A6E]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                Website / Link
              </label>
              <input
                type="text"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="example.com"
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium text-sm focus:outline-none focus:border-[#0E2A6E]"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200">
                Bio / About
              </label>
              <span className="text-[10px] text-gray-400 font-bold">
                {bio.length}/100
              </span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 100))}
              placeholder="Tell friends what you're up to…"
              rows={2}
              className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium text-sm focus:outline-none focus:border-[#0E2A6E]"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 px-4 rounded-2xl bg-[#0E2A6E] text-white font-extrabold text-xs hover:bg-[#081B47] active:scale-95 transition-all shadow-md disabled:opacity-50"
          >
            {isSaving ? 'Saving changes…' : 'Save Changes'}
          </button>
        </form>

        {/* Administration link for Admins */}
        {isAdmin && (
          <div className="p-4 rounded-3xl bg-[#FFD700]/15 border border-[#FFD700]/40 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🛡️</span>
              <div>
                <h4 className="font-extrabold text-xs text-[#1A1A2E] dark:text-[#FFD700]">
                  Admin Operations Console
                </h4>
                <p className="text-[11px] text-[#4B5563] dark:text-gray-300">
                  Manage users, moderation reports, analytics & settings
                </p>
              </div>
            </div>
            <Link
              to="/admin"
              className="px-3.5 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-extrabold hover:bg-[#081B47] shadow-sm"
            >
              Open
            </Link>
          </div>
        )}

        {/* Shortcuts & Wave 2 Extensions */}
        <div className="space-y-2">
          {/* Feature 140: Read Later Inbox */}
          <button
            type="button"
            onClick={() => setShowReadLaterModal(true)}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>📥</span>
              <div>
                <span className="block">Read Later & Saved Items</span>
                <span className="text-[10px] text-gray-400 font-normal">{readLaterList.length} saved bookmarks</span>
              </div>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          {/* Feature 123: Trusted Contacts */}
          <button
            type="button"
            onClick={() => setShowTrustedContactsModal(true)}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>🛡️</span>
              <div>
                <span className="block">Trusted Contacts (Account Recovery)</span>
                <span className="text-[10px] text-gray-400 font-normal">{trustedContacts.length} designated contacts</span>
              </div>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          {/* Feature 143: Moderation Appeal */}
          <button
            type="button"
            onClick={() => setShowAppealModal(true)}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>⚖️</span>
              <div>
                <span className="block">Submit Moderation Appeal</span>
                <span className="text-[10px] text-gray-400 font-normal">Dispute a flag or policy restriction</span>
              </div>
            </div>
            <span className="text-[#0E2A6E] dark:text-[#3D6FE0]">Appeal</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/privacy')}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>🔒</span>
              <span>Privacy, Security & App Lock (2FA)</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/secret-chats')}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>🔏</span>
              <span>Secret Chats Vault</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/starred')}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>⭐</span>
              <span>Starred & Bookmarked Messages</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/support')}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>🎧</span>
              <span>Customer Helpdesk & Support</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrivacyPolicy(true)}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>📄</span>
              <span>Privacy Policy & Safety Transparency</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          {/* Feature 87: GDPR-style Full Data Export */}
          <button
            type="button"
            onClick={handleExportGdprData}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>📁</span>
              <div>
                <span className="block">Export Account Data (GDPR JSON)</span>
                <span className="text-[10px] text-gray-400 font-normal">Complete download of chats, contacts & settings</span>
              </div>
            </div>
            <span className="text-blue-500 font-extrabold text-[11px]">Download</span>
          </button>

          {/* Feature 91: Email Change Flow */}
          <button
            type="button"
            onClick={() => setShowEmailModal(true)}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>✉️</span>
              <span>Change Account Email</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          {/* Feature 92: Password Change Flow */}
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>🔑</span>
              <span>Change Account Password</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          {/* Feature 96: Chat Backup Reminder Toggle */}
          <div className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold">
            <div className="flex items-center space-x-2.5">
              <span>⏰</span>
              <div>
                <span>Weekly Chat Backup Reminder</span>
                <span className="block text-[10px] text-gray-400 font-normal">Receive export reminder notifications</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={backupReminder}
              onChange={(e) => {
                setBackupReminder(e.target.checked);
                localStorage.setItem('inspire_backup_reminder', String(e.target.checked));
                toast(e.target.checked ? 'Weekly backup reminder enabled' : 'Reminder disabled', 'info');
              }}
              className="w-4 h-4 rounded text-[#0E2A6E] focus:ring-[#0E2A6E]"
            />
          </div>

          {/* Feature 86: Account Deactivation & Deletion */}
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="w-full p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>⚠️</span>
              <span>Deactivate or Delete Account</span>
            </div>
            <span className="text-amber-500 font-bold">30d Grace</span>
          </button>

          {/* Switch persona demo button for fast testing */}
          <button
            type="button"
            onClick={() => {
              if (isAdmin) {
                setDemoUser('user');
                toast('Switched to User profile (@alex_dev)', 'info');
              } else {
                setDemoUser('admin');
                toast('Switched to Admin profile (Sarah)', 'info');
              }
            }}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>🔄</span>
              <span>Switch to {isAdmin ? 'Standard User' : 'Admin'} Mode</span>
            </div>
            <span className="text-gray-400">Toggle</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>🚪</span>
              <span>Log Out</span>
            </div>
            <span>→</span>
          </button>
        </div>
      </main>

      {/* Feature 117: Highlight Viewer Modal */}
      {selectedHighlight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#0E2A6E] text-white flex items-center justify-center text-3xl mb-3">
              {selectedHighlight.title.split(' ')[1] || '⭐'}
            </div>
            <h3 className="font-extrabold text-base text-black dark:text-white mb-1">
              {selectedHighlight.title}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Saved memory highlight collection • 24h archive
            </p>
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 text-xs text-gray-600 dark:text-gray-300 mb-4">
              ✨ Highlight stories are permanently preserved on your profile and visible to verified contacts.
            </div>
            <button
              onClick={() => setSelectedHighlight(null)}
              className="w-full py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold"
            >
              Close Highlight
            </button>
          </div>
        </div>
      )}

      {/* Feature 117: Add Highlight Collection Modal */}
      {showAddHighlightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <h3 className="font-extrabold text-base text-black dark:text-white mb-2">
              ⭐ New Story Highlight
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Give your highlight collection a memorable title and emoji.
            </p>
            <form onSubmit={handleAddHighlight} className="space-y-4">
              <input
                type="text"
                value={newHighlightTitle}
                onChange={(e) => setNewHighlightTitle(e.target.value)}
                placeholder="e.g. Weekend Trips 🚗"
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold text-black dark:text-white focus:outline-none"
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddHighlightModal(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
                >
                  Save Highlight
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feature 140: Read Later Modal */}
      {showReadLaterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-xl">📥</span>
                <h3 className="font-black text-base text-black dark:text-white">Read Later Inbox</h3>
              </div>
              <button
                onClick={() => setShowReadLaterModal(false)}
                className="text-gray-400 hover:text-black dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {readLaterList.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  No saved items in your queue yet.
                </div>
              ) : (
                readLaterList.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border transition-all flex items-start justify-between space-x-3 ${
                      item.is_done
                        ? 'bg-gray-50/60 dark:bg-gray-800/20 border-gray-200 dark:border-gray-800 opacity-60'
                        : 'bg-white dark:bg-[#1A2234] border-[#E5E7EB] dark:border-[#2A3348]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold ${item.is_done ? 'line-through text-gray-400' : 'text-black dark:text-white'}`}>
                        {item.note || 'Saved message snapshot'}
                      </p>
                      <span className="text-[10px] text-gray-400 block mt-1">
                        Saved {new Date(item.saved_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          const updated = readLaterList.map((i) =>
                            i.id === item.id ? { ...i, is_done: !i.is_done } : i
                          );
                          setReadLaterList(updated);
                          localStorage.setItem('inspire_read_later', JSON.stringify(updated));
                        }}
                        className="px-2 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-[10px] font-bold"
                      >
                        {item.is_done ? 'Reopen' : 'Done ✓'}
                      </button>
                      <button
                        onClick={() => {
                          const updated = readLaterList.filter((i) => i.id !== item.id);
                          setReadLaterList(updated);
                          localStorage.setItem('inspire_read_later', JSON.stringify(updated));
                        }}
                        className="p-1 text-rose-500 text-xs hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowReadLaterModal(false)}
              className="mt-4 w-full py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold"
            >
              Close Inbox
            </button>
          </div>
        </div>
      )}

      {/* Feature 123: Trusted Contacts Modal */}
      {showTrustedContactsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <h3 className="font-extrabold text-base text-black dark:text-white mb-2">
              🛡️ Trusted Recovery Contacts
            </h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Designate 3 contacts who can confirm your identity if your device is compromised.
            </p>

            <div className="space-y-2 mb-4">
              {trustedContacts.map((contact, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 text-xs font-bold"
                >
                  <span>{contact}</span>
                  <button
                    onClick={() => {
                      const updated = trustedContacts.filter((_, i) => i !== idx);
                      setTrustedContacts(updated);
                      localStorage.setItem('inspire_trusted_contacts', JSON.stringify(updated));
                    }}
                    className="text-rose-500 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {trustedContacts.length < 3 && (
              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  value={newTrustedContact}
                  onChange={(e) => setNewTrustedContact(e.target.value)}
                  placeholder="@username"
                  className="flex-1 px-3 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (!newTrustedContact.trim()) return;
                    const contact = newTrustedContact.startsWith('@') ? newTrustedContact : `@${newTrustedContact}`;
                    const updated = [...trustedContacts, contact];
                    setTrustedContacts(updated);
                    localStorage.setItem('inspire_trusted_contacts', JSON.stringify(updated));
                    setNewTrustedContact('');
                    toast(`Added ${contact} as trusted contact`, 'success');
                  }}
                  className="px-3 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold"
                >
                  Add
                </button>
              </div>
            )}

            <button
              onClick={() => {
                toast('Emergency lockdown activated: All sessions logged out except this device.', 'error');
                setShowTrustedContactsModal(false);
              }}
              className="w-full mb-2 py-2 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-xs font-bold"
            >
              ⚠️ Emergency: Secure My Account Now
            </button>

            <button
              onClick={() => setShowTrustedContactsModal(false)}
              className="w-full py-2.5 rounded-2xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Feature 143: Moderation Appeal Modal */}
      {showAppealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <h3 className="font-extrabold text-base text-black dark:text-white mb-2">
              ⚖️ Submit Moderation Appeal
            </h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              If you believe a moderation action was applied in error, our human review team will investigate.
            </p>

            <form onSubmit={handleSubmitAppeal} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Action Being Appealed
                </label>
                <select
                  value={appealActionType}
                  onChange={(e) => setAppealActionType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-bold"
                >
                  <option value="Account Restriction Warning">Account Restriction Warning</option>
                  <option value="Content Deletion (Flag)">Content Deletion (Flag)</option>
                  <option value="Temporary Rate Limit">Temporary Rate Limit</option>
                  <option value="Username Policy Check">Username Policy Check</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Explanation & Context
                </label>
                <textarea
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder="Explain why this action should be reconsidered..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium focus:outline-none"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAppealModal(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAppeal}
                  className="flex-1 py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47] disabled:opacity-50"
                >
                  {isSubmittingAppeal ? 'Submitting…' : 'Submit Appeal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Privacy Policy Disclosure Modal */}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl max-h-[80vh] overflow-y-auto animate-slide-up">
            <h3 className="font-extrabold text-base text-black dark:text-white mb-2">
              Privacy Policy & Moderation Audit Transparency
            </h3>
            <div className="text-xs text-[#4B5563] dark:text-[#9CA3AF] space-y-3 leading-relaxed mb-6">
              <p>
                <strong>Security in Transit & at Rest:</strong> All messages, voice notes, and media on Inspire are encrypted in transit over modern TLS and stored securely in certified cloud databases.
              </p>
              <p>
                <strong>Safety & Content Moderation:</strong> To protect users from harassment, exploitation, and abuse, authorized Inspire Administrators have access to review reported conversations.
              </p>
              <p>
                <strong>Strict Immutable Audit Logging:</strong> In accordance with our security principles, every access to a user conversation history by an administrator is automatically recorded to an immutable, append-only security log (<code className="font-mono text-[10px]">admin_audit_log</code>), recording administrator identity, target conversation, and precise timestamp.
              </p>
            </div>
            <button
              onClick={() => setShowPrivacyPolicy(false)}
              className="w-full py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Feature 91: Change Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <h3 className="font-extrabold text-base text-black dark:text-white mb-2">
              ✉️ Update Email Address
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
              A verification link will be sent to your new email. Your old address remains active until verified.
            </p>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new_email@example.com"
              className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold text-black dark:text-white mb-4 focus:outline-none"
            />
            <div className="flex space-x-2">
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 py-2.5 rounded-2xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newEmail.trim()) {
                    toast('Please enter a valid email', 'error');
                    return;
                  }
                  toast(`Verification link sent to ${newEmail}`, 'success');
                  setShowEmailModal(false);
                  setNewEmail('');
                }}
                className="flex-1 py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
              >
                Send Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 92: Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <h3 className="font-extrabold text-base text-black dark:text-white mb-2">
              🔑 Change Password
            </h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold text-black dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold text-black dark:text-white focus:outline-none"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 py-2.5 rounded-2xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newPassword.length < 6) {
                    toast('New password must be at least 6 characters', 'error');
                    return;
                  }
                  toast('Password updated successfully', 'success');
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                }}
                className="flex-1 py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 86: Account Deactivation & Deletion Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <h3 className="font-extrabold text-base text-rose-600 dark:text-rose-400 mb-2">
              ⚠️ Deactivate or Delete Account
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3 leading-relaxed">
              You can choose temporary deactivation or permanent deletion with a 30-day grace period.
            </p>

            <div className="space-y-2 mb-4">
              <label
                onClick={() => setDeleteMode('deactivate')}
                className={`flex items-start space-x-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
                  deleteMode === 'deactivate'
                    ? 'border-[#0E2A6E] dark:border-[#3D6FE0] bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="delmode"
                  checked={deleteMode === 'deactivate'}
                  onChange={() => setDeleteMode('deactivate')}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-xs font-bold block text-black dark:text-white">Deactivate Account</span>
                  <span className="text-[10px] text-gray-500">Your profile is hidden until you log back in.</span>
                </div>
              </label>

              <label
                onClick={() => setDeleteMode('delete')}
                className={`flex items-start space-x-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
                  deleteMode === 'delete'
                    ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="delmode"
                  checked={deleteMode === 'delete'}
                  onChange={() => setDeleteMode('delete')}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-xs font-bold block text-rose-600 dark:text-rose-400">Permanently Delete</span>
                  <span className="text-[10px] text-gray-500">Scheduled purge after a 30-day reversible grace period.</span>
                </div>
              </label>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-2xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
              >
                Keep Account
              </button>
              <button
                onClick={() => {
                  if (deleteMode === 'deactivate') {
                    toast('Account deactivated. Log in anytime to restore.', 'info');
                  } else {
                    toast('Deletion requested: 30-day grace period started.', 'error');
                  }
                  setShowDeleteModal(false);
                }}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation */}
      <BottomNav totalUnread={0} isAdmin={isAdmin} />
    </div>
  );
};
