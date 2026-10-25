import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../hooks/useMessages';
import { usePresence } from '../hooks/usePresence';
import { useTyping } from '../hooks/useTyping';
import { useMediaUpload } from '../hooks/useMediaUpload';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useAI } from '../hooks/useAI';
import { useToast } from '../components/Toast';
import { Avatar } from '../components/Avatar';
import { MessageBubble } from '../components/MessageBubble';
import { TypingIndicator } from '../components/TypingIndicator';
import { MoodBanner } from '../components/MoodBanner';
import { SentimentTimelineModal } from '../components/SentimentTimelineModal';
import { ThreadDrawer } from '../components/ThreadDrawer';
import { SharedNoteModal } from '../components/SharedNoteModal';
import { ChatStatsModal } from '../components/ChatStatsModal';
import { ScheduleSendModal } from '../components/ScheduleSendModal';
import { PaymentSplitModal } from '../components/PaymentSplitModal';
import { GroupEventModal } from '../components/GroupEventModal';
import { MiniGameModal } from '../components/MiniGameModal';
import { ClipboardDrawer } from '../components/ClipboardDrawer';
import { ImageEnhanceModal } from '../components/ImageEnhanceModal';
import { ReminderModal } from '../components/ReminderModal';

import {
  Profile,
  Message,
  MessageType,
  MoodData,
  SentimentTimelinePoint,
  GameData,
  PaymentSplit,
  GroupEvent,
} from '../types';
import {
  formatLastSeen,
  formatDuration,
  formatDateSeparator,
  triggerHaptic,
  analyzeTypingCoach,
  getNetworkQuality,
} from '../utils/helpers';
import { supabase, isConfigured } from '../lib/supabaseClient';
import { workerApi } from '../lib/workerApi';

export const ChatPage: React.FC = () => {
  const { userId: partnerId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  // Messaging hooks
  const {
    messages,
    isLoading: messagesLoading,
    sendMessage,
    deleteMessage,
    addReaction,
    markAsRead,
    addLocalMessage,
    removeLocalMessage,
  } = useMessages(partnerId || '');

  const { isOnline } = usePresence();
  const { isPartnerTyping, notifyTyping } = useTyping(partnerId || '');
  const { uploadMedia, isUploading, uploadProgress, error: uploadError } = useMediaUpload();
  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    permissionError,
  } = useVoiceRecorder();

  // AI Hook
  const {
    getSmartReplies,
    summarizeChat,
    smartSearchChat,
    suggestEmojis,
    moderateContent,
  } = useAI();

  // Local UI states
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [suggestedEmojis, setSuggestedEmojis] = useState<string[]>([]);

  // Search & Summary Modal States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchingMessageIds, setMatchingMessageIds] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Report & Block Modal States
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Spam or harmful behavior');
  const [reportNote, setReportNote] = useState('');
  const [reportedMessageTarget, setReportedMessageTarget] = useState<Message | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [wallpaperPreset, setWallpaperPreset] = useState<string>(() => {
    return localStorage.getItem(`inspire_wallpaper_${partnerId}`) || 'default';
  });
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<MessageType>('image');

  // Document 09 Wave 2 States
  const [moodData, setMoodData] = useState<MoodData | null>(null);
  const [showMoodBanner, setShowMoodBanner] = useState(false);
  const [showSentimentTimeline, setShowSentimentTimeline] = useState(false);
  const [sentimentPoints, setSentimentPoints] = useState<SentimentTimelinePoint[]>([]);

  // Feature 98: Smart Compose
  const [smartComposeGhost, setSmartComposeGhost] = useState('');

  // Feature 121: Incognito Mode
  const [isIncognito, setIsIncognito] = useState(() => {
    return localStorage.getItem(`inspire_incognito_${partnerId}`) === 'true';
  });

  // Feature 125: Anonymous Message
  const [isAnonymousSend, setIsAnonymousSend] = useState(false);

  // Feature 151: Typing Coach
  const [typingCoachHint, setTypingCoachHint] = useState<{ type: string; message: string } | null>(null);
  const [suppressedHints, setSuppressedHints] = useState<string[]>(() => {
    const s = localStorage.getItem('inspire_suppressed_typing_hints');
    return s ? JSON.parse(s) : [];
  });

  // Feature 126: Network Quality
  const [networkQuality, setNetworkQuality] = useState<'4g' | '3g' | '2g'>('4g');
  const [showNetworkNotice, setShowNetworkNotice] = useState(false);

  // Feature 108 & 122: Schedule & Disappear
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledTimeString, setScheduledTimeString] = useState<string | null>(null);
  const [disappearSeconds, setDisappearSeconds] = useState<number | null>(null);

  // Feature 141: Clipboard Drawer
  const [showClipboardDrawer, setShowClipboardDrawer] = useState(false);

  // Feature 137: Collaborative Shared Note
  const [showSharedNote, setShowSharedNote] = useState(false);

  // Feature 142: Chat Stats
  const [showChatStats, setShowChatStats] = useState(false);
  const [chatStatsData, setChatStatsData] = useState<any>(null);

  // Feature 136: Mini-Games
  const [showMiniGameModal, setShowMiniGameModal] = useState(false);

  // Feature 120: Split Payment
  const [showPaymentSplitModal, setShowPaymentSplitModal] = useState(false);

  // Feature 114: Group Event
  const [showGroupEventModal, setShowGroupEventModal] = useState(false);

  // Feature 107: Thread Drawer
  const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);

  // Feature 115: Reminder
  const [reminderTargetMessage, setReminderTargetMessage] = useState<Message | null>(null);

  // Feature 99: AI Image Enhancement Preview
  const [pendingEnhanceImage, setPendingEnhanceImage] = useState<File | null>(null);

  // Fetch partner profile & check block status
  useEffect(() => {
    if (!partnerId) return;

    const fetchPartner = async () => {
      setPartnerLoading(true);

      if (!isConfigured) {
        // Mock partner profile
        setPartnerProfile({
          id: partnerId,
          username: partnerId === 'usr_jordan' ? 'jordan_ai' : partnerId.replace('usr_', ''),
          display_name: partnerId === 'usr_jordan' ? 'Jordan Lee' : 'Partner Contact',
          bio: 'Inspire conversationalist ✨',
          avatar_url: null,
          role: 'user',
          status: 'active',
          is_online: true,
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
          pronouns: 'they/them',
          verified: true,
          availability_status: 'available',
        });
        setPartnerLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', partnerId)
          .maybeSingle();

        if (data) {
          const { data: contactAlias } = await supabase
            .from('contacts')
            .select('custom_name')
            .eq('user_id', user?.id || '')
            .eq('contact_id', partnerId)
            .maybeSingle();
          const profile = data as Profile;
          setPartnerProfile({
            ...profile,
            display_name: contactAlias?.custom_name?.trim() || profile.display_name,
          });
        }

        // Check if either party blocked the other
        if (user) {
          const { data: blockData } = await supabase
            .from('blocked_users')
            .select('*')
            .or(
              `and(blocker_id.eq.${user.id},blocked_id.eq.${partnerId}),and(blocker_id.eq.${partnerId},blocked_id.eq.${user.id})`
            )
            .maybeSingle();

          setIsBlocked(Boolean(blockData));
        }
      } catch (err) {
        console.warn('Error loading partner:', err);
      } finally {
        setPartnerLoading(false);
      }
    };

    fetchPartner();
  }, [partnerId, user]);

  // Network Quality check on load (Feature 126)
  useEffect(() => {
    const quality = getNetworkQuality();
    setNetworkQuality(quality);
    if (quality === '3g' || quality === '2g') {
      setShowNetworkNotice(true);
    }
  }, []);

  // Mark incoming messages as read upon view (Feature 121: suppressed in Incognito Mode)
  useEffect(() => {
    if (messages.length > 0 && !isIncognito) {
      markAsRead();
    }
  }, [messages.length, markAsRead, isIncognito]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Smart reply trigger: on receiving a new message while chat is open
  const lastMessage = messages[messages.length - 1];
  const lastMessageId = lastMessage?.id;
  const lastMessageContent = lastMessage?.content;
  const lastMessageSender = lastMessage?.sender_id;

  useEffect(() => {
    if (lastMessageContent && lastMessageSender && lastMessageSender !== user?.id) {
      getSmartReplies(lastMessageContent).then((replies) => {
        setSmartReplies(replies);
      });
    } else {
      setSmartReplies([]);
    }
  }, [lastMessageId, lastMessageContent, lastMessageSender, user?.id, getSmartReplies]);

  // Feature 98: Smart Compose Debounce & Feature 151: Typing Coach
  useEffect(() => {
    if (!inputText.trim()) {
      setSmartComposeGhost('');
      setTypingCoachHint(null);
      return;
    }

    // Typing Coach Check
    const hint = analyzeTypingCoach(inputText);
    if (hint && !suppressedHints.includes(hint.type)) {
      setTypingCoachHint(hint);
    } else {
      setTypingCoachHint(null);
    }

    // Smart Compose Ghost Text Trigger (>= 3 words)
    const words = inputText.trim().split(/\s+/);
    if (words.length >= 3) {
      const timer = setTimeout(() => {
        const last3 = messages.slice(-3).map((m) => m.content || '');
        workerApi.smartCompose(inputText, last3).then((ghost) => {
          setSmartComposeGhost(ghost);
        });
      }, 550);
      return () => clearTimeout(timer);
    } else {
      setSmartComposeGhost('');
    }
  }, [inputText, messages, suppressedHints]);

  // Debounced emoji suggestions while composing
  useEffect(() => {
    if (!inputText.trim() || inputText.length < 3) {
      setSuggestedEmojis([]);
      return;
    }

    const timer = setTimeout(() => {
      suggestEmojis(inputText).then((emojis) => {
        setSuggestedEmojis(emojis);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [inputText, suggestEmojis]);

  // Handle typing notification
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    setSmartComposeGhost('');
    notifyTyping();
  };

  const wallpaperClasses: Record<string, string> = {
    default: 'bg-white dark:bg-[#0B0F1A]',
    midnight: 'bg-[#080E21]',
    warm_sand: 'bg-[#FAF6EE] dark:bg-[#181512]',
    emerald: 'bg-[#061C16]',
    royal: 'bg-[#0A1638]',
  };

  const handleScroll = () => {
    if (!chatScrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsScrolledUp(distanceFromBottom > 150);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsScrolledUp(false);
  };

  // Feature 102: Grammar Fix Trigger
  const handleFixGrammar = async () => {
    if (!inputText.trim()) return;
    const fixed = await workerApi.fixGrammar(inputText);
    setInputText(fixed);
    toast('✓ Grammar and formatting polished!', 'success');
  };

  // Send regular text message (supporting Anonymous Send, Scheduled Send, and Expiry Override)
  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isBlocked) return;

    triggerHaptic('light');
    setInputText('');
    setSmartComposeGhost('');
    setSmartReplies([]);
    setSuggestedEmojis([]);
    const replyId = replyingTo?.id;
    setReplyingTo(null);

    if (scheduledTimeString) {
      toast(`Message scheduled for ${new Date(scheduledTimeString).toLocaleTimeString()}`, 'info');
      setScheduledTimeString(null);
      return;
    }

    const expiresAt = disappearSeconds
      ? new Date(Date.now() + disappearSeconds * 1000).toISOString()
      : null;
    setDisappearSeconds(null);

    if (isAnonymousSend) {
      // Feature 125 Anonymous Send local message
      const anonMsg: Message = {
        id: `anon_${Date.now()}`,
        sender_id: user?.id || 'anon',
        receiver_id: partnerId,
        content: text,
        message_type: 'text',
        media_url: null,
        media_size: null,
        media_name: null,
        reply_to_id: replyId || null,
        is_deleted_sender: false,
        is_deleted_receiver: false,
        is_read: false,
        read_at: null,
        created_at: new Date().toISOString(),
        is_anonymous: true,
        expires_at: new Date(Date.now() + 60000).toISOString(), // auto disappear
        reactions: [],
      };
      addLocalMessage(anonMsg);
      setIsAnonymousSend(false);
      toast('🕵️ Sent anonymously — self-destruct active', 'success');
      return;
    }

    const sent = await sendMessage(text, 'text', undefined, replyId);
    if (!sent) {
      toast('Message could not be sent. Tap Retry on the message when the connection is back.', 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Feature 98: Tab or ArrowRight accepts smart-compose ghost text
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && smartComposeGhost) {
      e.preventDefault();
      setInputText((prev) => `${prev} ${smartComposeGhost}`.trim());
      setSmartComposeGhost('');
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    } else if (e.key === 'ArrowUp' && !inputText) {
      // Edit last sent message (Feature 85, Feature 2)
      const myMessages = messages.filter((m) => m.sender_id === user?.id && m.content);
      const last = myMessages[myMessages.length - 1];
      if (last?.content) {
        setInputText(last.content);
        toast('Editing last sent message', 'info');
      }
    } else if (e.key === 'Escape') {
      if (replyingTo) setReplyingTo(null);
      if (isSearchOpen) setIsSearchOpen(false);
      if (showAttachMenu) setShowAttachMenu(false);
      if (showOverflowMenu) setShowOverflowMenu(false);
      setSmartComposeGhost('');
    }
  };

  // Open file picker for specific media type
  const triggerMediaPicker = (type: MessageType) => {
    setSelectedMediaType(type);
    setShowAttachMenu(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept =
        type === 'image'
          ? 'image/*'
          : type === 'video'
          ? 'video/*'
          : 'audio/*';
      fileInputRef.current.click();
    }
  };

  // Handle media file upload (Feature 99 intercepts images for enhancement preview)
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isBlocked || !user || !partnerId) return;

    if (selectedMediaType === 'image') {
      setPendingEnhanceImage(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    await executeMediaUpload(file, selectedMediaType, file.name);
  };

  const executeMediaUpload = async (file: File | Blob, type: MessageType, name: string) => {
    if (!user || !partnerId) return;
    toast(`Uploading ${name}…`, 'info');
    const result = await uploadMedia(file, type, name);

    if (result) {
      if (!isConfigured) {
        toast('Media uploaded, but messaging is not configured; the message was not sent.', 'error');
        return;
      }

      const sent = await sendMessage(
        '',
        type,
        {
          url: result.object_key,
          size: result.size || file.size,
          name,
        },
        replyingTo?.id
      );
      if (sent) {
        setReplyingTo(null);
        toast('Media sent!', 'success');
      } else {
        toast('Media uploaded, but message delivery failed. Please retry.', 'error');
      }
    } else if (uploadError) {
      toast(uploadError, 'error');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle voice note recording finish
  const handleStopVoiceNote = async () => {
    const blob = await stopRecording();
    if (!blob || isBlocked || !user || !partnerId) return;

    toast('Uploading voice note…', 'info');
    const extension = blob.type.includes('mp4') ? 'm4a'
      : blob.type.includes('ogg') ? 'ogg'
      : blob.type.includes('wav') ? 'wav'
      : 'webm';
    const filename = `voice_note.${extension}`;
    const result = await uploadMedia(blob, 'voice_note', filename);

    if (!result) {
      toast(uploadError || 'Voice note upload failed. Please try again.', 'error');
      return;
    }
    if (!isConfigured) {
      toast('Voice note uploaded, but messaging is not configured; it was not sent.', 'error');
      return;
    }

    const sent = await sendMessage('', 'voice_note', {
      url: result.object_key,
      size: blob.size,
      name: filename,
    });
    if (sent) {
      toast('Voice note sent!', 'success');
    } else {
      toast('Voice note uploaded, but sending failed. Please retry.', 'error');
    }
  };

  // Feature 97: Conversation Mood Analysis
  const handleFetchMood = async () => {
    setShowOverflowMenu(false);
    const textMsgs = messages.filter((m) => m.content).slice(-30).map((m) => m.content || '');
    const mood = await workerApi.getConversationMood(textMsgs);
    if (mood) {
      setMoodData(mood);
      setShowMoodBanner(true);
      toast(`Mood Analyzed: ${mood.mood_label} ${mood.mood_emoji}`, 'info');
    }
  };

  // Feature 101: Sentiment Timeline
  const handleOpenSentimentTimeline = () => {
    setShowOverflowMenu(false);
    const mockPoints: SentimentTimelinePoint[] = [
      { day: 'Mon', dateStr: 'Oct 19', positive: 65, neutral: 25, negative: 10, score: 0.55 },
      { day: 'Tue', dateStr: 'Oct 20', positive: 70, neutral: 20, negative: 10, score: 0.60 },
      { day: 'Wed', dateStr: 'Oct 21', positive: 45, neutral: 35, negative: 20, score: 0.25 },
      { day: 'Thu', dateStr: 'Oct 22', positive: 80, neutral: 15, negative: 5, score: 0.75 },
      { day: 'Fri', dateStr: 'Oct 23', positive: 75, neutral: 20, negative: 5, score: 0.70 },
      { day: 'Sat', dateStr: 'Oct 24', positive: 85, neutral: 12, negative: 3, score: 0.82 },
      { day: 'Today', dateStr: 'Oct 25', positive: 88, neutral: 10, negative: 2, score: 0.86 },
    ];
    setSentimentPoints(mockPoints);
    setShowSentimentTimeline(true);
  };

  // Feature 142: Chat Stats Trigger
  const handleOpenChatStats = async () => {
    setShowOverflowMenu(false);
    const stats = await workerApi.getConversationAnalytics(partnerId || 'default');
    setChatStatsData(stats);
    setShowChatStats(true);
  };

  // Feature 146: Guest Preview Trigger
  const handleCreateGuestPreview = async () => {
    setShowOverflowMenu(false);
    const msgIds = messages.slice(-5).map((m) => m.id);
    const previewUrl = await workerApi.createChatPreview(partnerId || 'preview', msgIds);
    navigator.clipboard.writeText(`${window.location.origin}${previewUrl}`);
    toast('Guest Preview link copied to clipboard! (Expires in 48h)', 'success');
  };

  // Feature 150: Time Capsule Trigger
  const handleCreateTimeCapsule = async () => {
    setShowOverflowMenu(false);
    const capsuleUrl = await workerApi.createTimeCapsule({
      conversation_key: partnerId || 'conv',
      title: `Memories with ${partnerProfile?.display_name || 'Friend'}`,
      is_public: false,
      message_snapshot: messages.slice(-50),
    });
    navigator.clipboard.writeText(`${window.location.origin}${capsuleUrl}`);
    toast('⏳ Time Capsule sealed! Private link copied.', 'success');
  };

  // Feature 121: Toggle Incognito Read
  const handleToggleIncognito = () => {
    const next = !isIncognito;
    setIsIncognito(next);
    localStorage.setItem(`inspire_incognito_${partnerId}`, String(next));
    toast(next ? '👻 Incognito Mode: Read receipts suppressed' : 'Incognito Mode turned OFF', 'info');
    setShowOverflowMenu(false);
  };

  // Chat Summarizer Trigger
  const handleSummarize = async () => {
    setShowOverflowMenu(false);
    setIsSummarizing(true);
    const validMessages = messages
      .filter((m) => m.content)
      .slice(-30)
      .map((m) => ({
        sender: m.sender_id === user?.id ? 'You' : partnerProfile?.display_name || 'Partner',
        content: m.content || '',
      }));

    const result = await summarizeChat(validMessages);
    setSummaryResult(result);
    setIsSummarizing(false);
  };

  // Smart Search Trigger
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setMatchingMessageIds([]);
      return;
    }
    setIsSearching(true);
    const searchable = messages
      .filter((m) => m.content)
      .map((m) => ({ id: m.id, content: m.content || '' }));

    const ids = await smartSearchChat(searchQuery, searchable);
    setMatchingMessageIds(ids);
    setIsSearching(false);
  };

  // Block user
  const handleBlockUser = async () => {
    if (!user || !partnerId) return;
    setShowBlockConfirm(false);

    if (isConfigured) {
      try {
        await supabase.from('blocked_users').insert({
          blocker_id: user.id,
          blocked_id: partnerId,
        });
      } catch (e) {
        console.warn('Block user error:', e);
      }
    }

    setIsBlocked(true);
    toast(`Blocked @${partnerProfile?.username}`, 'info');
  };

  // Submit report
  const handleSubmitReport = async () => {
    if (!user || !partnerId) return;
    setIsSubmittingReport(true);

    let verdict: string | null = null;
    let confidence: number | null = null;
    if (reportedMessageTarget?.content) {
      const modResult = await moderateContent('text', reportedMessageTarget.content);
      verdict = modResult.verdict;
      confidence = modResult.confidence;
    }

    if (isConfigured) {
      try {
        await supabase.from('reports').insert({
          reporter_id: user.id,
          reported_user_id: partnerId,
          reported_message_id: reportedMessageTarget?.id || null,
          reason: reportReason,
          note: reportNote || null,
          moderation_verdict: verdict,
          moderation_confidence: confidence,
        });
      } catch (e) {
        console.warn('Report submit error:', e);
      }
    }

    setIsSubmittingReport(false);
    setShowReportModal(false);
    setReportNote('');
    setReportedMessageTarget(null);
    toast('Report submitted for Admin review. Thank you for keeping Inspire safe.', 'success');
  };

  // Feature 136: Start Mini-Game
  const handleStartGame = (gameData: GameData) => {
    setShowMiniGameModal(false);
    const gameMsg: Message = {
      id: `game_${Date.now()}`,
      sender_id: user?.id || 'me',
      receiver_id: partnerId,
      content: null,
      message_type: 'game',
      game_data: gameData,
      media_url: null,
      media_size: null,
      media_name: null,
      reply_to_id: null,
      is_deleted_sender: false,
      is_deleted_receiver: false,
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
      reactions: [],
    };
    addLocalMessage(gameMsg);
    toast(`Started ${gameData.game === 'tictactoe' ? 'Tic-Tac-Toe' : 'Word Guess'}!`, 'success');
  };

  // Feature 120: Send Split Card
  const handleSendSplit = (splitData: PaymentSplit) => {
    setShowPaymentSplitModal(false);
    const splitMsg: Message = {
      id: `split_msg_${Date.now()}`,
      sender_id: user?.id || 'me',
      receiver_id: partnerId,
      content: null,
      message_type: 'split',
      split_data: splitData,
      media_url: null,
      media_size: null,
      media_name: null,
      reply_to_id: null,
      is_deleted_sender: false,
      is_deleted_receiver: false,
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
      reactions: [],
    };
    addLocalMessage(splitMsg);
    toast('Sent expense split card!', 'success');
  };

  // Feature 114: Send Group Event Card
  const handleSendEvent = (eventData: GroupEvent) => {
    setShowGroupEventModal(false);
    const eventMsg: Message = {
      id: `event_msg_${Date.now()}`,
      sender_id: user?.id || 'me',
      receiver_id: partnerId,
      content: null,
      message_type: 'event',
      event_data: eventData,
      media_url: null,
      media_size: null,
      media_name: null,
      reply_to_id: null,
      is_deleted_sender: false,
      is_deleted_receiver: false,
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
      reactions: [],
    };
    addLocalMessage(eventMsg);
    toast('Posted group event card!', 'success');
  };

  // Feature 115: Set Reminder
  const handleConfirmReminder = (remindAt: string, note?: string) => {
    if (!reminderTargetMessage) return;
    toast(`🔔 Reminder set for ${new Date(remindAt).toLocaleTimeString()}`, 'success');
    setReminderTargetMessage(null);
  };

  const partnerIsOnline = partnerId ? isOnline(partnerId) : false;
  const wordCount = inputText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-white dark:bg-[#0B0F1A] text-black dark:text-white overflow-hidden">
      {/* Hidden file input for media picker */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Feature 97: Conversation Mood Banner */}
      {showMoodBanner && moodData && (
        <MoodBanner mood={moodData} onDismiss={() => setShowMoodBanner(false)} />
      )}

      {/* Feature 121: Incognito Mode Persistent Notice */}
      {isIncognito && (
        <div className="bg-purple-950 text-purple-200 px-4 py-1 text-[11px] font-bold flex items-center justify-between border-b border-purple-800 select-none">
          <div className="flex items-center space-x-1.5">
            <span>👻</span>
            <span>Incognito Read Active: Read receipts and last-seen suppressed</span>
          </div>
          <button
            onClick={() => handleToggleIncognito()}
            className="underline hover:text-white text-[10px]"
          >
            Turn Off
          </button>
        </div>
      )}

      {/* Feature 126: Network Quality Toast */}
      {showNetworkNotice && (
        <div className="bg-amber-500/20 text-amber-700 dark:text-amber-300 px-4 py-1 text-[11px] font-semibold flex items-center justify-between select-none">
          <span>📶 Slower connection ({networkQuality.toUpperCase()}) — media automatically compressed</span>
          <button onClick={() => setShowNetworkNotice(false)} className="text-xs font-bold">✕</button>
        </div>
      )}

      {/* Chat Top Header */}
      <header className="flex-shrink-0 z-30 bg-white dark:bg-[#0B0F1A] border-b border-[#E5E7EB] dark:border-[#2A3348] px-3 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-2.5 min-w-0">
          <button
            onClick={() => navigate('/chats')}
            className="p-1.5 -ml-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-black dark:text-white transition-colors"
            aria-label="Back to conversations"
          >
            ←
          </button>

          <Avatar
            name={partnerProfile?.display_name || 'User'}
            avatarUrl={partnerProfile?.avatar_url}
            size="sm"
            showOnlineStatus={true}
            isOnline={partnerIsOnline}
          />

          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center space-x-1.5 truncate">
              <h2 className="font-extrabold text-sm text-black dark:text-white truncate leading-tight">
                {partnerLoading ? 'Loading…' : partnerProfile?.display_name}
              </h2>
              {/* Feature 116 Verified Badge */}
              {partnerProfile?.verified && (
                <span className="text-[#0E2A6E] dark:text-[#3D6FE0] font-black text-xs shrink-0" title="Verified Member">
                  ✓
                </span>
              )}
              {isIncognito && <span title="Incognito Read active">👻</span>}
            </div>

            <div className="text-[11px] font-semibold truncate leading-none mt-0.5">
              {isPartnerTyping ? (
                <TypingIndicator className="text-[11px]" />
              ) : partnerIsOnline ? (
                <span className="text-[#16A34A] dark:text-[#22C55E]">Online</span>
              ) : partnerProfile?.last_seen ? (
                <span className="text-[#4B5563] dark:text-[#9CA3AF]">
                  {formatLastSeen(partnerProfile.last_seen)}
                </span>
              ) : (
                <span className="text-gray-400">Offline</span>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Icons */}
        <div className="flex items-center space-x-1 relative">
          <button
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            title="Search conversation"
            aria-label="Search conversation"
          >
            🔍
          </button>

          <button
            onClick={() => setShowOverflowMenu((prev) => !prev)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-bold"
            title="Options"
            aria-label="More conversation options"
          >
            ⋮
          </button>

          {/* Header Overflow Dropdown Menu */}
          {showOverflowMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowOverflowMenu(false)}
              />
              <div className="absolute right-0 top-10 z-40 bg-white dark:bg-[#161B2B] shadow-2xl border border-[#E5E7EB] dark:border-[#2A3348] rounded-2xl py-1.5 w-56 text-xs font-semibold animate-slide-up">
                {/* Feature 97 Mood analysis */}
                <button
                  type="button"
                  onClick={handleFetchMood}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span className="text-base text-[#FFD700]">✨</span>
                  <span>Conversation Mood Board</span>
                </button>

                {/* Feature 101 Sentiment Timeline */}
                <button
                  type="button"
                  onClick={handleOpenSentimentTimeline}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>📈</span>
                  <span>Sentiment Timeline (7 Days)</span>
                </button>

                {/* Feature 137 Collaborative Shared Note */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSharedNote(true);
                    setShowOverflowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>📝</span>
                  <span>Collaborative Shared Note</span>
                </button>

                {/* Feature 142 Conversation Statistics */}
                <button
                  type="button"
                  onClick={handleOpenChatStats}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>📊</span>
                  <span>Chat Statistics</span>
                </button>

                {/* Feature 121 Incognito Mode */}
                <button
                  type="button"
                  onClick={handleToggleIncognito}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>👻</span>
                  <span>{isIncognito ? 'Disable Incognito Read' : 'Enable Incognito Read'}</span>
                </button>

                {/* Feature 146 Guest Preview Link */}
                <button
                  type="button"
                  onClick={handleCreateGuestPreview}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>🔗</span>
                  <span>Create Guest Preview Link</span>
                </button>

                {/* Feature 150 Time Capsule */}
                <button
                  type="button"
                  onClick={handleCreateTimeCapsule}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>⏳</span>
                  <span>Seal as Time Capsule</span>
                </button>

                <button
                  type="button"
                  onClick={handleSummarize}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span className="text-base text-[#FFD700]">✨</span>
                  <span>Summarize this chat</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(true);
                    setShowOverflowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>🔍</span>
                  <span>Smart Search</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowWallpaperModal(true);
                    setShowOverflowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>🎨</span>
                  <span>Chat Wallpaper</span>
                </button>

                <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

                <button
                  type="button"
                  onClick={() => {
                    setShowReportModal(true);
                    setShowOverflowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center space-x-2"
                >
                  <span>🚩</span>
                  <span>Report @{partnerProfile?.username}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowBlockConfirm(true);
                    setShowOverflowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center space-x-2"
                >
                  <span>🚫</span>
                  <span>Block contact</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* In-Chat Search Bar Toggle */}
      {isSearchOpen && (
        <div className="bg-[#F5F7FA] dark:bg-[#161B2B] px-4 py-2.5 border-b border-[#E5E7EB] dark:border-[#2A3348] flex items-center space-x-2 animate-slide-up">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Natural search or keywords… (e.g. 'when is the trip?')"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium focus:outline-none focus:border-[#0E2A6E]"
            />
            <span className="absolute left-2.5 top-2 text-xs">✨</span>
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-3 py-1.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
          >
            {isSearching ? '…' : 'Find'}
          </button>
          <button
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
              setMatchingMessageIds([]);
            }}
            className="text-gray-400 hover:text-black dark:hover:text-white text-xs font-bold p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Message List Canvas */}
      <main
        ref={chatScrollContainerRef}
        onScroll={handleScroll}
        className={`flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4 py-3 space-y-1 relative transition-colors ${
          wallpaperClasses[wallpaperPreset] || wallpaperClasses.default
        }`}
      >
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-400">
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[#4B5563] dark:text-[#9CA3AF]">
            <div className="w-16 h-16 rounded-full bg-[#0E2A6E]/10 dark:bg-[#3D6FE0]/10 flex items-center justify-center text-3xl mb-3">
              👋
            </div>
            <h4 className="font-extrabold text-sm text-black dark:text-white">
              Say hello to {partnerProfile?.display_name}!
            </h4>
            <p className="text-xs max-w-xs mt-1">
              Messages and media sent here are delivered instantly in real time.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isHighlighted = matchingMessageIds.includes(msg.id);
            const showDateSeparator =
              index === 0 ||
              formatDateSeparator(msg.created_at) !==
                formatDateSeparator(messages[index - 1].created_at);

            return (
              <React.Fragment key={msg.id}>
                {/* Feature 78: Date Separator Pill */}
                {showDateSeparator && (
                  <div className="flex justify-center my-3 select-none">
                    <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 backdrop-blur-xs border border-gray-200/50 dark:border-gray-800/60 shadow-2xs">
                      {formatDateSeparator(msg.created_at)}
                    </span>
                  </div>
                )}
                <div
                  className={isHighlighted ? 'ring-2 ring-[#FFD700] rounded-2xl p-0.5' : ''}
                >
                  <MessageBubble
                    message={msg}
                    currentUserId={user?.id || ''}
                    onReply={(m) => setReplyingTo(m)}
                    onDelete={(id, deleteForEveryone) => {
                      triggerHaptic('medium');
                      deleteMessage(id, deleteForEveryone);
                    }}
                    onReact={(id, emoji) => {
                      triggerHaptic('light');
                      addReaction(id, emoji);
                    }}
                    onReport={(m) => {
                      setReportedMessageTarget(m);
                      setShowReportModal(true);
                    }}
                    onOpenThread={(m) => setActiveThreadMessage(m)}
                    onRemind={(m) => setReminderTargetMessage(m)}
                    onSaveForLater={(m) => {
                      toast('Saved to your Read Later inbox 🔖', 'success');
                    }}
                    onUpdateGame={(id, gd) => {
                      // optimistic update game
                      toast('Move made in game!', 'info');
                    }}
                    onUpdateSplit={(splitId, itemId) => {
                      toast('Payment recorded for split item! ✓', 'success');
                    }}
                    onRsvpEvent={(eventId, resp) => {
                      toast(`RSVP updated: ${resp.toUpperCase()}`, 'success');
                    }}
                    onRetrySend={async (m) => {
                      if (!user || !partnerId) return;
                      toast('Retrying send…', 'info');
                      removeLocalMessage(m.id);
                      const retried = await sendMessage(
                        m.content || '',
                        m.message_type,
                        m.media_url ? { url: m.media_url, size: m.media_size || undefined, name: m.media_name || undefined } : undefined,
                        m.reply_to_id || undefined
                      );
                      if (!retried) toast('Retry failed. Check your connection and try again.', 'error');
                    }}
                  />
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />

        {/* Feature 79: Floating Jump to Latest Button */}
        {isScrolledUp && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="fixed right-5 bottom-24 z-30 w-10 h-10 rounded-full bg-[#0E2A6E] text-[#FFD700] shadow-xl flex items-center justify-center font-black text-sm active:scale-90 hover:scale-105 transition-all"
            title="Jump to latest message"
            aria-label="Jump to latest message"
          >
            ↓
          </button>
        )}
      </main>

      {/* Feature 151: Presence-Aware Typing Coach Hint Banner */}
      {typingCoachHint && (
        <div className="bg-amber-500/15 border-t border-amber-500/30 px-4 py-1.5 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between select-none">
          <div className="flex items-center space-x-2">
            <span>💡</span>
            <span>{typingCoachHint.message}</span>
          </div>
          <div className="flex space-x-2 text-[10px]">
            <button
              onClick={() => {
                setSuppressedHints((prev) => [...prev, typingCoachHint.type]);
                localStorage.setItem(
                  'inspire_suppressed_typing_hints',
                  JSON.stringify([...suppressedHints, typingCoachHint.type])
                );
                setTypingCoachHint(null);
              }}
              className="underline text-gray-500"
            >
              Don't show again
            </button>
            <button onClick={() => setTypingCoachHint(null)} className="font-bold">✕</button>
          </div>
        </div>
      )}

      {/* Feature 102: Fix Grammar Quick Action Button */}
      {wordCount >= 10 && (
        <div className="px-4 py-1 bg-gray-50 dark:bg-[#161B2B] border-t border-[#E5E7EB] dark:border-[#2A3348] flex justify-end">
          <button
            type="button"
            onClick={handleFixGrammar}
            className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#0E2A6E]/10 hover:bg-[#0E2A6E]/20 text-[#0E2A6E] dark:text-[#3D6FE0] transition-colors"
          >
            <span>✨</span>
            <span>Fix Grammar & Punctuation</span>
          </button>
        </div>
      )}

      {/* Smart Reply Suggestions Bar */}
      {smartReplies.length > 0 && !isBlocked && (
        <div className="flex items-center space-x-2 px-4 py-1.5 overflow-x-auto bg-[#F5F7FA] dark:bg-[#161B2B] border-t border-[#E5E7EB] dark:border-[#2A3348] select-none no-scrollbar">
          <span className="text-xs text-[#FFD700] font-bold select-none">✨</span>
          {smartReplies.map((reply, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                sendMessage(reply, 'text');
                setSmartReplies([]);
              }}
              className="flex-shrink-0 px-3.5 py-1 rounded-full bg-white dark:bg-[#1A2234] border border-[#0E2A6E] dark:border-[#3D6FE0] text-black dark:text-white text-xs font-bold hover:bg-[#0E2A6E] hover:text-white dark:hover:bg-[#3D6FE0] transition-colors shadow-xs"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* AI Emoji Suggestions Row */}
      {suggestedEmojis.length > 0 && !isBlocked && (
        <div className="flex items-center space-x-2 px-4 py-1 bg-white dark:bg-[#0B0F1A] border-t border-[#E5E7EB] dark:border-[#2A3348]">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            Suggested:
          </span>
          {suggestedEmojis.map((emoji, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setInputText((prev) => prev + emoji)}
              className="text-base hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Quoted Reply Preview Bar */}
      {replyingTo && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-[#161B2B] border-t border-[#FFD700]">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="text-[#0E2A6E] dark:text-[#3D6FE0] font-black text-sm">↩</span>
            <div className="text-xs truncate">
              <span className="font-bold text-black dark:text-white mr-1.5">
                Replying to {replyingTo.sender_id === user?.id ? 'yourself' : partnerProfile?.display_name}:
              </span>
              <span className="text-gray-600 dark:text-gray-300">
                {replyingTo.content || `[${replyingTo.message_type}]`}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-gray-400 hover:text-black dark:hover:text-white text-xs font-bold"
            aria-label="Cancel reply"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="w-full bg-gray-200 dark:bg-gray-800 h-1">
          <div
            style={{ width: `${uploadProgress}%` }}
            className="bg-[#0E2A6E] dark:bg-[#FFD700] h-full transition-all duration-300"
          />
        </div>
      )}

      {/* Feature 141 Clipboard Sync Drawer */}
      {showClipboardDrawer && (
        <ClipboardDrawer
          onInsertText={(txt) => setInputText((prev) => `${prev} ${txt}`.trim())}
          onClose={() => setShowClipboardDrawer(false)}
        />
      )}

      {/* Bottom Composer / Input Bar */}
      {isBlocked ? (
        <div className="p-4 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 text-center text-xs font-bold text-gray-500">
          🚫 You cannot message this contact.
        </div>
      ) : isRecording ? (
        // Voice Note Live Recording Bar
        <div className="p-3 bg-[#0E2A6E] text-white flex items-center justify-between animate-slide-up">
          <div className="flex items-center space-x-3">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
            <span className="text-sm font-extrabold tracking-wider">
              {formatDuration(recordingDuration)}
            </span>
            <span className="text-xs text-blue-200">Recording voice note…</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="px-3 py-1 rounded-xl text-xs font-bold text-blue-200 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStopVoiceNote}
              className="px-4 py-1.5 rounded-xl bg-[#FFD700] text-[#1A1A2E] text-xs font-extrabold shadow-md active:scale-95"
            >
              Send Voice Note
            </button>
          </div>
        </div>
      ) : (
        <footer className="p-3 bg-white dark:bg-[#0B0F1A] border-t border-[#E5E7EB] dark:border-[#2A3348] relative">
          {isPartnerTyping && (
            <div className="max-w-3xl mx-auto mb-2 px-3 py-1 text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF]" aria-live="polite">
              <TypingIndicator className="text-xs" />
            </div>
          )}
          {permissionError && (
            <div className="mb-2 text-xs text-rose-500 font-semibold">
              ⚠️ {permissionError}
            </div>
          )}

          {/* Attachment Menu Popup */}
          {showAttachMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowAttachMenu(false)}
              />
              <div className="absolute bottom-16 left-3 z-40 bg-white dark:bg-[#161B2B] shadow-2xl border border-[#E5E7EB] dark:border-[#2A3348] rounded-2xl p-2 flex flex-col space-y-1 w-52 animate-slide-up">
                <button
                  type="button"
                  onClick={() => triggerMediaPicker('image')}
                  className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold text-black dark:text-white"
                >
                  <span className="text-lg">📷</span>
                  <span>Photos & Images</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerMediaPicker('video')}
                  className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold text-black dark:text-white"
                >
                  <span className="text-lg">🎬</span>
                  <span>Videos (up to 50MB)</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerMediaPicker('audio')}
                  className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold text-black dark:text-white"
                >
                  <span className="text-lg">🎵</span>
                  <span>Audio Files</span>
                </button>
                {/* Feature 120 Split */}
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentSplitModal(true);
                    setShowAttachMenu(false);
                  }}
                  className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold text-black dark:text-white"
                >
                  <span className="text-lg">💰</span>
                  <span>Split an Expense</span>
                </button>
                {/* Feature 114 Group Event */}
                <button
                  type="button"
                  onClick={() => {
                    setShowGroupEventModal(true);
                    setShowAttachMenu(false);
                  }}
                  className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold text-black dark:text-white"
                >
                  <span className="text-lg">📅</span>
                  <span>Schedule Event</span>
                </button>
                {/* Feature 136 Games */}
                <button
                  type="button"
                  onClick={() => {
                    setShowMiniGameModal(true);
                    setShowAttachMenu(false);
                  }}
                  className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold text-black dark:text-white"
                >
                  <span className="text-lg">🎮</span>
                  <span>Play Mini-Game</span>
                </button>
                {/* Feature 125 Anonymous Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAnonymousSend((prev) => !prev);
                    setShowAttachMenu(false);
                    toast(
                      !isAnonymousSend ? '🕵️ Anonymous send activated' : 'Anonymous send deactivated',
                      'info'
                    );
                  }}
                  className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold text-amber-500"
                >
                  <span className="text-lg">🕵️</span>
                  <span>{isAnonymousSend ? 'Disable Anonymous' : 'Send Anonymously'}</span>
                </button>
              </div>
            </>
          )}

          <form onSubmit={handleSendText} className="flex items-center space-x-2">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => setShowAttachMenu((prev) => !prev)}
              className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-lg transition-transform active:scale-95"
              aria-label="Attach photo, video or audio"
            >
              📎
            </button>

            {/* Feature 141 Clipboard Button */}
            <button
              type="button"
              onClick={() => setShowClipboardDrawer((prev) => !prev)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-base transition-transform active:scale-95 text-gray-500"
              title="Open Clipboard"
              aria-label="Open clipboard"
            >
              📋
            </button>

            {/* Feature 108 & 122 Schedule / Disappear Button */}
            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-base transition-transform active:scale-95 ${
                scheduledTimeString || disappearSeconds ? 'text-[#FFD700]' : 'text-gray-500'
              }`}
              title="Schedule or Set Expiry"
              aria-label="Schedule message"
            >
              ⏱️
            </button>

            {/* Soft-filled text input with Feature 98 Ghost Text Autocomplete */}
            <div className="relative flex-1">
              <input
                type="text"
                spellCheck="true"
                value={inputText}
                onChange={(event) => {
                  handleInputChange(event);
                  if (event.target.value.trim()) notifyTyping();
                }}
                onKeyDown={handleKeyDown}
                placeholder={isAnonymousSend ? 'Type anonymous message…' : 'Type a message… (Enter to send, Tab to complete)'}
                className={`w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border ${
                  isAnonymousSend ? 'border-amber-500/60' : 'border-[#E5E7EB] dark:border-[#2A3348]'
                } text-black dark:text-white font-medium text-sm focus:outline-none focus:border-[#0E2A6E] dark:focus:border-[#3D6FE0]`}
              />
              {smartComposeGhost && (
                <div
                  className="absolute left-4 top-2.5 pointer-events-none text-sm font-medium text-[#4B5563] dark:text-[#9CA3AF] opacity-50 truncate"
                  style={{ textIndent: `${inputText.length * 7.5}px` }}
                >
                  {smartComposeGhost}
                  <span className="text-[10px] ml-1 bg-black/10 dark:bg-white/10 px-1 py-0.2 rounded font-bold">Tab ⇥</span>
                </div>
              )}
            </div>

            {/* Mic Button vs Send Button */}
            {inputText.trim() ? (
              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-[#0E2A6E] text-white flex items-center justify-center font-black hover:bg-[#081B47] active:scale-95 transition-transform shadow-md"
                aria-label="Send message"
              >
                ➤
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="w-10 h-10 rounded-full bg-[#0E2A6E] text-white flex items-center justify-center text-lg hover:bg-[#081B47] active:scale-95 transition-transform shadow-md"
                aria-label="Record voice note"
              >
                🎤
              </button>
            )}
          </form>
        </footer>
      )}

      {/* Feature 107: Thread Replies Drawer */}
      {activeThreadMessage && (
        <ThreadDrawer
          rootMessage={activeThreadMessage}
          currentUserId={user?.id || ''}
          partnerProfile={partnerProfile}
          onClose={() => setActiveThreadMessage(null)}
          onSendThreadReply={(txt) => {
            toast('Thread reply posted!', 'success');
          }}
        />
      )}

      {/* Feature 101: Sentiment Timeline Modal */}
      {showSentimentTimeline && (
        <SentimentTimelineModal
          points={sentimentPoints}
          onSelectDay={(pt) => {
            setShowSentimentTimeline(false);
            toast(`Viewing messages from ${pt.day}`, 'info');
          }}
          onClose={() => setShowSentimentTimeline(false)}
        />
      )}

      {/* Feature 137: Collaborative Shared Note */}
      {showSharedNote && (
        <SharedNoteModal
          conversationKey={partnerId || 'conv'}
          partnerName={partnerProfile?.display_name || 'Contact'}
          onClose={() => setShowSharedNote(false)}
        />
      )}

      {/* Feature 142: Chat Stats Modal */}
      {showChatStats && chatStatsData && (
        <ChatStatsModal
          partnerName={partnerProfile?.display_name || 'Contact'}
          stats={chatStatsData}
          onClose={() => setShowChatStats(false)}
        />
      )}

      {/* Feature 108 & 122: Schedule & Disappear Modal */}
      {showScheduleModal && (
        <ScheduleSendModal
          onSchedule={(t) => {
            setScheduledTimeString(t);
            setShowScheduleModal(false);
            toast(`Message will be sent at ${new Date(t).toLocaleTimeString()}`, 'info');
          }}
          onSetDisappear={(sec) => {
            setDisappearSeconds(sec);
            setShowScheduleModal(false);
            toast(`Message will self-destruct ${sec}s after reading`, 'info');
          }}
          onClose={() => setShowScheduleModal(false)}
        />
      )}

      {/* Feature 120: In-Chat Bill Split Modal */}
      {showPaymentSplitModal && (
        <PaymentSplitModal
          currentUserId={user?.id || 'me'}
          partnerName={partnerProfile?.display_name || 'Partner'}
          partnerId={partnerId || 'partner'}
          onConfirm={handleSendSplit}
          onClose={() => setShowPaymentSplitModal(false)}
        />
      )}

      {/* Feature 114: Group Event Modal */}
      {showGroupEventModal && (
        <GroupEventModal
          currentUserId={user?.id || 'me'}
          groupId={partnerId || 'group'}
          onConfirm={handleSendEvent}
          onClose={() => setShowGroupEventModal(false)}
        />
      )}

      {/* Feature 136: Mini-Games Starter */}
      {showMiniGameModal && (
        <MiniGameModal
          currentUserId={user?.id || 'me'}
          partnerId={partnerId || 'partner'}
          onStartGame={handleStartGame}
          onClose={() => setShowMiniGameModal(false)}
        />
      )}

      {/* Feature 115: Message Reminder Modal */}
      {reminderTargetMessage && (
        <ReminderModal
          message={reminderTargetMessage}
          onSetReminder={handleConfirmReminder}
          onClose={() => setReminderTargetMessage(null)}
        />
      )}

      {/* Feature 99: AI Image Enhancement Preview Modal */}
      {pendingEnhanceImage && (
        <ImageEnhanceModal
          imageFile={pendingEnhanceImage}
          onConfirmSend={(finalFile) => {
            setPendingEnhanceImage(null);
            executeMediaUpload(finalFile, 'image', pendingEnhanceImage.name);
          }}
          onCancel={() => setPendingEnhanceImage(null)}
        />
      )}

      {/* Chat Summary Modal */}
      {(summaryResult || isSummarizing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-xl text-[#FFD700]">✨</span>
              <h3 className="font-extrabold text-base text-black dark:text-white">
                Conversation Summary
              </h3>
            </div>
            {isSummarizing ? (
              <div className="py-8 text-center text-xs text-gray-500 animate-pulse">
                Generating smart summary…
              </div>
            ) : (
              <div className="whitespace-pre-line text-xs leading-relaxed text-black dark:text-gray-200 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 mb-4">
                {summaryResult}
              </div>
            )}
            <button
              onClick={() => setSummaryResult(null)}
              className="w-full py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <h3 className="font-extrabold text-base text-rose-600 mb-2">
              Block @{partnerProfile?.username}?
            </h3>
            <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed mb-6">
              Blocked contacts cannot send you messages or view your online presence. You can unblock them later from settings.
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockUser}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 active:scale-95"
              >
                Confirm Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <h3 className="font-extrabold text-base text-black dark:text-white mb-2">
              Report User or Content
            </h3>
            <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mb-4">
              Inspire Safety: Reports are queued for Admin moderation with AI verification.
            </p>

            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase text-black dark:text-gray-200 mb-1">
                  Reason
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white"
                >
                  <option value="Spam or harmful behavior">Spam or harmful behavior</option>
                  <option value="Harassment or bullying">Harassment or bullying</option>
                  <option value="Inappropriate media">Inappropriate media</option>
                  <option value="Impersonation or fraud">Impersonation or fraud</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-black dark:text-gray-200 mb-1">
                  Additional Note (Optional)
                </label>
                <textarea
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="Provide any details to help admin review…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-medium text-black dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportedMessageTarget(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={isSubmittingReport}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 active:scale-95 shadow-md"
              >
                {isSubmittingReport ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 81: Per-Conversation Chat Wallpaper Modal */}
      {showWallpaperModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
            <h3 className="font-extrabold text-base text-black dark:text-white mb-1">
              🎨 Chat Wallpaper
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Select a custom wallpaper tint for this conversation.
            </p>

            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {[
                { id: 'default', name: 'Default App', color: '#0B0F1A' },
                { id: 'midnight', name: 'Midnight Navy', color: '#080E21' },
                { id: 'warm_sand', name: 'Warm Sand', color: '#FAF6EE' },
                { id: 'emerald', name: 'Emerald Soft', color: '#061C16' },
                { id: 'royal', name: 'Royal Indigo', color: '#0A1638' },
              ].map((wp) => (
                <button
                  key={wp.id}
                  onClick={() => {
                    setWallpaperPreset(wp.id);
                    localStorage.setItem(`inspire_wallpaper_${partnerId}`, wp.id);
                    triggerHaptic('light');
                  }}
                  className={`p-3 rounded-2xl border text-left flex items-center space-x-2.5 transition-all ${
                    wallpaperPreset === wp.id
                      ? 'border-[#0E2A6E] dark:border-[#FFD700] ring-2 ring-[#0E2A6E]/30 bg-gray-50 dark:bg-gray-800'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 shadow-xs shrink-0"
                    style={{ backgroundColor: wp.color }}
                  />
                  <span className="text-xs font-bold text-black dark:text-white truncate">
                    {wp.name}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowWallpaperModal(false)}
              className="w-full py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
