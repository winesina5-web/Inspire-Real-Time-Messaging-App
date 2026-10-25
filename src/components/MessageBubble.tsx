import React, { useState, useEffect, useRef } from 'react';
import { Message, PollData, GameData, PaymentSplit, GroupEvent, MusicCardData } from '../types';
import {
  isMessageDeletedForViewer,
  formatMessageTime,
  formatFileSize,
  calculatePollOptionPercentage,
  extractUrlsFromText,
  checkLinkSafety,
  parseMarkdownToHtml,
  checkTicTacToeWinner,
  evaluateWordGuess,
} from '../utils/helpers';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { ReactionPicker } from './ReactionPicker';
import { workerApi, LinkPreviewData } from '../lib/workerApi';
import { useAI } from '../hooks/useAI';
import { Avatar } from './Avatar';

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  onReply: (message: Message) => void;
  onDelete: (messageId: string, forEveryone: boolean) => void;
  onReact: (messageId: string, emoji: string) => void;
  onReport?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onForward?: (message: Message) => void;
  onStar?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onVotePoll?: (messageId: string, optionId: string) => void;
  // Document 09 Wave 2 Props
  onOpenThread?: (message: Message) => void;
  onRemind?: (message: Message) => void;
  onSaveForLater?: (message: Message) => void;
  onUpdateGame?: (messageId: string, updatedGame: GameData) => void;
  onUpdateSplit?: (splitId: string, itemId: string) => void;
  onRsvpEvent?: (eventId: string, response: 'going' | 'maybe' | 'not_going') => void;
  onRetrySend?: (message: Message) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  currentUserId,
  onReply,
  onDelete,
  onReact,
  onReport,
  onEdit,
  onForward,
  onStar,
  onPin,
  onVotePoll,
  onOpenThread,
  onRemind,
  onSaveForLater,
  onUpdateGame,
  onUpdateSplit,
  onRsvpEvent,
  onRetrySend,
}) => {
  const isMe = message.sender_id === currentUserId;
  const isDeleted = isMessageDeletedForViewer(message, currentUserId);
  const [showReactionsPicker, setShowReactionsPicker] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMovedRef = useRef(false);
  const clearLongPress = () => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; };
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string>('');
  const [mediaResolveError, setMediaResolveError] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceSummary, setVoiceSummary] = useState<string | null>(message.ai_voice_summary || null);
  const [isSummarizingVoice, setIsSummarizingVoice] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [linkPreview, setLinkPreview] = useState<LinkPreviewData | null>(null);
  const [viewOnceOpened, setViewOnceOpened] = useState(message.view_once_opened || false);
  const [showCaptions, setShowCaptions] = useState(false);
  const [captionsVtt, setCaptionsVtt] = useState<string | null>(message.vtt_captions || null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [remainingTimeSeconds, setRemainingTimeSeconds] = useState<number | null>(null);

  const { translateMessage, transcribeAudio } = useAI();

  useEffect(() => {
    let isMounted = true;
    setResolvedMediaUrl('');
    setMediaResolveError(false);
    if (message.media_url && !message.media_url.startsWith('http') && !message.media_url.startsWith('data:')) {
      workerApi.getDownloadUrl(message.media_url).then((url) => {
        if (isMounted) {
          setResolvedMediaUrl(url);
          setMediaResolveError(!url);
        }
      }).catch((error) => {
        console.warn('Private media URL resolution failed:', error);
        if (isMounted) setMediaResolveError(true);
      });
    } else if (message.media_url) {
      setResolvedMediaUrl(message.media_url);
    } else if (['image', 'video', 'audio', 'voice_note', 'file'].includes(message.message_type)) {
      setMediaResolveError(true);
    }

    // Check for link preview
    if (message.content) {
      const urls = extractUrlsFromText(message.content);
      if (urls.length > 0) {
        workerApi.getLinkPreview(urls[0]).then((prev) => {
          if (isMounted && prev) setLinkPreview(prev);
        });
      }
    }

    return () => {
      isMounted = false;
    };
  }, [message.media_url, message.content]);

  // Feature 110 & 122: Disappearing message countdown timer ring
  useEffect(() => {
    if (!message.expires_at) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(message.expires_at!).getTime() - Date.now()) / 1000));
      setRemainingTimeSeconds(diff);
      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [message.expires_at]);

  const handleTranslate = async () => {
    if (translation) {
      setTranslation(null);
      return;
    }
    if (!message.content) return;
    setIsTranslating(true);
    const result = await translateMessage(message.content, 'en');
    setTranslation(result);
    setIsTranslating(false);
    setShowActionsMenu(false);
  };

  const handleTranscribe = async () => {
    if (transcript) {
      setTranscript(null);
      return;
    }
    setIsTranscribing(true);
    const text = await transcribeAudio(message.media_url || 'voice_note.webm');
    setTranscript(text);
    setIsTranscribing(false);
  };

  // Feature 104: AI Voice Note Summary
  const handleSummarizeVoice = async () => {
    if (voiceSummary) {
      setVoiceSummary(null);
      return;
    }
    setIsSummarizingVoice(true);
    const text = transcript || (await transcribeAudio(message.media_url || 'voice_note.webm'));
    const summary = await workerApi.summarizeVoiceNote(text || '');
    setVoiceSummary(summary);
    setIsSummarizingVoice(false);
  };

  // Feature 109: Auto Video Captions Toggle
  const handleToggleCaptions = async () => {
    if (showCaptions) {
      setShowCaptions(false);
      return;
    }
    if (!captionsVtt && message.media_url) {
      const vtt = await workerApi.autoCaption(message.media_url);
      setCaptionsVtt(vtt);
    }
    setShowCaptions(true);
  };

  // Feature 136: Tic-Tac-Toe Move
  const handleTicTacToeCellClick = (index: number) => {
    if (!message.game_data || message.game_data.game !== 'tictactoe') return;
    const gd = { ...message.game_data };
    if (gd.status !== 'playing' || gd.board[index] !== null) return;
    if (gd.turnUserId !== currentUserId) return;

    const newBoard = [...gd.board];
    const mark = gd.currentPlayer === 'X' ? 'X' : 'O';
    newBoard[index] = mark;

    const { winner, isDraw } = checkTicTacToeWinner(newBoard);
    gd.board = newBoard;
    if (winner) {
      gd.winner = winner;
      gd.status = 'won';
    } else if (isDraw) {
      gd.status = 'draw';
    } else {
      gd.currentPlayer = mark === 'X' ? 'O' : 'X';
      // Pass turn to other party
      gd.turnUserId = isMe ? (message.receiver_id || 'other') : message.sender_id;
    }

    if (onUpdateGame) onUpdateGame(message.id, gd);
  };

  if (isDeleted) {
    return (
      <div className={`flex w-full my-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[75%] px-3.5 py-2 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40 text-xs italic text-gray-500 dark:text-gray-400 select-none ${
            isMe ? 'rounded-br-sm' : 'rounded-bl-sm'
          }`}
        >
          🚫 Message deleted
          <span className="ml-2 text-[10px] text-gray-400">
            {formatMessageTime(message.created_at)}
          </span>
        </div>
      </div>
    );
  }

  const reactionCounts: Record<string, number> = {};
  (message.reactions || []).forEach((r) => {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
  });

  return (
    <div
      className={`group relative flex w-full my-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
      onContextMenu={(event) => { event.preventDefault(); setShowActionsMenu(true); }}
      onTouchStart={() => {
        touchMovedRef.current = false;
        clearLongPress();
        longPressTimerRef.current = setTimeout(() => setShowActionsMenu(true), 500);
      }}
      onTouchMove={() => { touchMovedRef.current = true; clearLongPress(); }}
      onTouchEnd={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      <div className="relative max-w-[85%] sm:max-w-[75%] flex flex-col">
        {/* Feature 125: Anonymous Message Header */}
        {message.is_anonymous && (
          <div className="flex items-center space-x-1.5 text-[10px] font-black uppercase text-amber-500 mb-1 px-2">
            <span>🕵️ Anonymous Message</span>
            <span className="text-[9px] opacity-75 font-normal">(Burn After Read)</span>
          </div>
        )}

        {/* Forwarded Header (Feature 3) */}
        {message.forwarded_from_id && (
          <div className="flex items-center space-x-1 text-[10px] italic text-[#4B5563] dark:text-[#9CA3AF] mb-0.5 px-2 font-semibold">
            <span>↪ Forwarded message</span>
          </div>
        )}

        {/* Reply Quote Preview */}
        {message.reply_to && (
          <div
            className={`text-xs p-2 mb-1 rounded-lg border-l-4 border-[#FFD700] bg-black/5 dark:bg-white/10 ${
              isMe ? 'text-white/90' : 'text-gray-800 dark:text-gray-200'
            }`}
          >
            <div className="font-bold text-[11px] text-[#FFD700]">
              {message.reply_to.sender_id === currentUserId ? 'You' : 'Replied message'}
            </div>
            <div className="truncate text-xs opacity-90">
              {message.reply_to.content || `[${message.reply_to.message_type}]`}
            </div>
          </div>
        )}

        {/* Message Bubble Container */}
        <div
          className={`relative px-4 py-2.5 rounded-2xl shadow-sm text-sm transition-shadow select-text ${
            isMe
              ? 'bg-[#0E2A6E] dark:bg-[#254BA8] text-white rounded-br-sm'
              : 'bg-white dark:bg-[#161B2B] text-black dark:text-[#F5F7FA] border border-[#E5E7EB] dark:border-[#2A3348] rounded-bl-sm'
          }`}
        >
          {/* Pinned Marker (Feature 4) */}
          {message.is_pinned && (
            <div className="flex items-center space-x-1 text-[10px] text-[#FFD700] font-black uppercase mb-1">
              <span>📌</span>
              <span>Pinned in Chat</span>
            </div>
          )}

          {/* Feature 110: Disappearing Countdown Ring UI */}
          {remainingTimeSeconds !== null && (
            <div className="flex items-center space-x-1.5 mb-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold w-fit">
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Disappears in {remainingTimeSeconds}s</span>
            </div>
          )}

          {/* View-Once Media Gate (Feature 45) */}
          {message.is_view_once && (
            <div className="mb-2">
              {viewOnceOpened ? (
                <div className="p-3 rounded-xl bg-black/20 text-xs italic flex items-center space-x-2">
                  <span>⏱️</span>
                  <span>View-once photo opened and expired</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setViewOnceOpened(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#FFD700] text-[#1A1A2E] text-xs font-black flex items-center space-x-2 shadow-sm active:scale-95 transition-transform"
                >
                  <span className="w-5 h-5 rounded-full bg-[#1A1A2E] text-[#FFD700] flex items-center justify-center font-black text-xs">
                    1
                  </span>
                  <span>Tap to view photo (View Once)</span>
                </button>
              )}
            </div>
          )}

          {/* Standard Image Media (with Feature 128 progressive blur) */}
          {message.message_type === 'image' && (!message.is_view_once || viewOnceOpened) && resolvedMediaUrl && (
            <div className="mb-2 overflow-hidden rounded-xl bg-black/10 relative">
              <img
                src={resolvedMediaUrl}
                alt={message.media_name || 'Shared image'}
                className="max-h-72 w-full object-cover rounded-xl hover:opacity-95 transition-all cursor-pointer"
                loading="lazy"
                onClick={() => window.open(resolvedMediaUrl, '_blank')}
              />
              {message.ai_alt_text && (
                <p className="p-1.5 text-[10px] text-gray-500 italic bg-black/5 dark:bg-white/5">
                  AI Alt-Text: {message.ai_alt_text}
                </p>
              )}
            </div>
          )}

          {/* Video Media (Feature 109 CC Captions) */}
          {message.message_type === 'video' && resolvedMediaUrl && (
            <div className="mb-2 overflow-hidden rounded-xl bg-black relative">
              <video src={resolvedMediaUrl} controls className="max-h-72 w-full rounded-xl" />
              <button
                type="button"
                onClick={handleToggleCaptions}
                className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-black transition-all ${
                  showCaptions
                    ? 'bg-[#FFD700] text-[#1A1A2E]'
                    : 'bg-black/60 text-white hover:bg-black/80'
                }`}
                title="Toggle AI Subtitles"
              >
                CC
              </button>
              {showCaptions && (
                <div className="absolute bottom-10 inset-x-2 bg-black/80 text-white text-[11px] p-1.5 rounded-lg text-center backdrop-blur-sm pointer-events-none">
                  💬 [AI Auto-Captions]: Showing speech from video track
                </div>
              )}
            </div>
          )}

          {/* Voice Note Player (Feature 104 Summary Card) */}
          {message.message_type === 'voice_note' && (
            <div className="mb-1">
              <VoiceNotePlayer audioUrl={resolvedMediaUrl} isSentByMe={isMe} />
              <div className="flex items-center space-x-2 mt-1">
                <button
                  type="button"
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                  className={`inline-flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                    isMe
                      ? 'bg-white/15 hover:bg-white/25 text-white'
                      : 'bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-[#1A1A2E] dark:text-[#FFD700]'
                  }`}
                >
                  <span>✨</span>
                  <span>{isTranscribing ? 'Transcribing…' : transcript ? 'Hide transcript' : 'View transcript'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSummarizeVoice}
                  disabled={isSummarizingVoice}
                  className={`inline-flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                    isMe
                      ? 'bg-white/15 hover:bg-white/25 text-white'
                      : 'bg-[#0E2A6E]/10 hover:bg-[#0E2A6E]/20 text-[#0E2A6E] dark:text-[#3D6FE0]'
                  }`}
                >
                  <span>📝</span>
                  <span>{isSummarizingVoice ? 'Summarizing…' : voiceSummary ? 'Hide summary' : 'AI Summary'}</span>
                </button>
              </div>

              {voiceSummary && (
                <div className="mt-1.5 p-2 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/30 text-xs text-black dark:text-white leading-relaxed">
                  <div className="flex items-center space-x-1 text-[10px] font-black text-[#0E2A6E] dark:text-[#FFD700] uppercase mb-0.5">
                    <span>✨ Voice Note Summary</span>
                  </div>
                  <p>{voiceSummary}</p>
                </div>
              )}

              {transcript && (
                <div
                  className={`mt-1.5 p-2 rounded-lg text-xs leading-relaxed border ${
                    isMe
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <span className="font-bold text-[10px] block opacity-75">TRANSCRIPT</span>
                  {transcript}
                </div>
              )}
            </div>
          )}

          {/* Feature 136: Mini-Games (Tic-Tac-Toe & Word Guess) */}
          {message.message_type === 'game' && message.game_data && (
            <div className="mb-2 p-3 rounded-2xl bg-white dark:bg-[#161B2B] text-black dark:text-white border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center space-x-1.5 font-black text-xs">
                  <span>🎮</span>
                  <span>{message.game_data.game === 'tictactoe' ? 'Tic-Tac-Toe' : 'Word Guess Game'}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#FFD700] text-[#1A1A2E] text-[10px] font-black uppercase">
                  {message.game_data.status === 'won'
                    ? `Winner: ${message.game_data.winner}!`
                    : message.game_data.status === 'draw'
                    ? 'Draw Game!'
                    : `Turn: ${message.game_data.currentPlayer}`}
                </span>
              </div>

              {message.game_data.game === 'tictactoe' && (
                <div className="grid grid-cols-3 gap-1.5 w-44 mx-auto my-2">
                  {message.game_data.board.map((cell, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={cell !== null || message.game_data?.status !== 'playing' || message.game_data?.turnUserId !== currentUserId}
                      onClick={() => handleTicTacToeCellClick(idx)}
                      className={`h-12 rounded-xl text-xl font-black flex items-center justify-center transition-all ${
                        cell === 'X'
                          ? 'bg-[#0E2A6E] text-white dark:bg-[#3D6FE0]'
                          : cell === 'O'
                          ? 'bg-[#FFD700] text-[#1A1A2E]'
                          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 active:scale-95'
                      }`}
                    >
                      {cell}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feature 120: In-Chat Bill / Expense Split Card */}
          {message.message_type === 'split' && message.split_data && (
            <div className="mb-2 p-3.5 rounded-2xl bg-white dark:bg-[#161B2B] text-black dark:text-white border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-black text-xs text-[#0E2A6E] dark:text-[#3D6FE0]">
                  <span>💰</span>
                  <span>{message.split_data.title}</span>
                </div>
                <span className="font-black text-xs text-black dark:text-white">
                  {message.split_data.currency} {message.split_data.total_amount}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{
                    width: `${
                      (message.split_data.items.filter((i) => i.status === 'paid').length /
                        Math.max(message.split_data.items.length, 1)) *
                      100
                    }%`,
                  }}
                />
              </div>

              {/* Participant Tally */}
              <div className="space-y-1.5 pt-1">
                {message.split_data.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-800 last:border-none">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {item.profile?.display_name || item.user_id === currentUserId ? 'You' : 'Member'}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold">${item.amount}</span>
                      {item.status === 'paid' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">
                          ✓ Paid
                        </span>
                      ) : item.user_id === currentUserId || isMe ? (
                        <button
                          type="button"
                          onClick={() => onUpdateSplit && onUpdateSplit(message.split_data!.id, item.id)}
                          className="px-2 py-0.5 rounded-full bg-[#0E2A6E] text-white text-[10px] font-bold active:scale-95"
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <span className="text-[10px] text-amber-500 font-bold">Pending</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature 114: Group Event Card */}
          {message.message_type === 'event' && message.event_data && (
            <div className="mb-2 p-3.5 rounded-2xl bg-white dark:bg-[#161B2B] text-black dark:text-white border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-2">
              <div className="flex items-center space-x-2 font-black text-xs text-[#0E2A6E] dark:text-[#3D6FE0]">
                <span>📅</span>
                <span>Group Event</span>
              </div>
              <h4 className="font-black text-sm text-black dark:text-white">{message.event_data.title}</h4>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF]">{message.event_data.description}</p>
              <div className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                ⏰ {new Date(message.event_data.starts_at).toLocaleString()}
                {message.event_data.location && ` • 📍 ${message.event_data.location}`}
              </div>

              {/* RSVP Buttons */}
              <div className="flex items-center space-x-1.5 pt-1.5">
                {(['going', 'maybe', 'not_going'] as const).map((resp) => {
                  const count = message.event_data?.rsvps.filter((r) => r.response === resp).length || 0;
                  const myRsvp = message.event_data?.rsvps.find((r) => r.user_id === currentUserId)?.response;
                  return (
                    <button
                      key={resp}
                      type="button"
                      onClick={() => onRsvpEvent && onRsvpEvent(message.event_data!.id, resp)}
                      className={`flex-1 py-1 rounded-xl text-xs font-bold transition-all ${
                        myRsvp === resp
                          ? 'bg-[#0E2A6E] text-white dark:bg-[#3D6FE0]'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {resp === 'going' ? `✓ Going (${count})` : resp === 'maybe' ? `? Maybe (${count})` : `✗ No (${count})`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feature 138: In-App Music Sharing Card */}
          {message.message_type === 'music_card' && message.music_data && (
            <div className="mb-2 overflow-hidden rounded-2xl bg-white dark:bg-[#161B2B] text-black dark:text-white border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
              <img
                src={message.music_data.album_art_url}
                alt={message.music_data.track_name}
                className="w-full h-32 object-cover"
              />
              <div className="p-3 space-y-2">
                <div>
                  <h4 className="font-extrabold text-xs truncate text-black dark:text-white">{message.music_data.track_name}</h4>
                  <p className="text-[10px] text-gray-500 truncate">{message.music_data.artist}</p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase">
                    {message.music_data.platform}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPlayingMusic((prev) => !prev)}
                    className="px-3 py-1 rounded-full bg-[#0E2A6E] text-[#FFD700] text-xs font-black shadow-sm active:scale-95"
                  >
                    {isPlayingMusic ? '⏸ Pause' : '▶ Play Preview (30s)'}
                  </button>
                </div>
                {isPlayingMusic && (
                  <audio src={message.music_data.preview_url} autoPlay onEnded={() => setIsPlayingMusic(false)} className="hidden" />
                )}
              </div>
            </div>
          )}

          {/* Document / File Sharing (Feature 22) */}
          {message.message_type === 'file' && (
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-black/5 dark:bg-white/10 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center text-xl font-bold">
                📄
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs truncate">{message.media_name || 'Document'}</p>
                <p className="text-[10px] opacity-75">{formatFileSize(message.media_size || 0)}</p>
              </div>
              <a
                href={resolvedMediaUrl || '#'}
                download={message.media_name || 'file'}
                className="px-3 py-1 rounded-lg bg-[#FFD700] text-[#1A1A2E] text-xs font-black"
              >
                Download
              </a>
            </div>
          )}

          {/* Interactive Poll Display (Feature 29) */}
          {message.message_type === 'poll' && message.poll_data && (
            <div className="mb-2 p-3 rounded-2xl bg-black/5 dark:bg-white/5 space-y-2.5">
              <div className="flex items-center space-x-1.5 font-black text-xs text-black dark:text-white">
                <span>📊</span>
                <span>{message.poll_data.question}</span>
              </div>
              <div className="space-y-1.5">
                {message.poll_data.options.map((opt) => {
                  const totalVotes = message.poll_data?.options.reduce((acc, o) => acc + o.votes.length, 0) || 0;
                  const pct = calculatePollOptionPercentage(opt.votes.length, totalVotes);
                  const hasVoted = opt.votes.includes(currentUserId);

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onVotePoll && onVotePoll(message.id, opt.id)}
                      className={`w-full text-left p-2.5 rounded-xl border relative overflow-hidden transition-all text-xs font-semibold ${
                        hasVoted
                          ? 'border-[#0E2A6E] dark:border-[#3D6FE0] bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161B2B]'
                      }`}
                    >
                      <div
                        style={{ width: `${pct}%` }}
                        className="absolute inset-y-0 left-0 bg-[#0E2A6E]/15 dark:bg-[#3D6FE0]/25 rounded-xl transition-all duration-300"
                      />
                      <div className="relative flex justify-between items-center z-10 text-black dark:text-white">
                        <span>{opt.option_text}</span>
                        <span className="font-bold text-[11px]">{pct}% ({opt.votes.length})</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feature 144: Markdown & Regular Text Content */}
          {message.content && (
            <div
              className="whitespace-pre-wrap break-words leading-relaxed font-normal"
              dangerouslySetInnerHTML={{
                __html: parseMarkdownToHtml(message.content),
              }}
            />
          )}

          {/* Rich Link Preview Card (Feature 8) & AI Link Safety (Feature 38) */}
          {linkPreview && (
            <a
              href={linkPreview.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-black/5 dark:bg-white/5 hover:opacity-90 transition-opacity"
            >
              {linkPreview.image && (
                <img src={linkPreview.image} alt={linkPreview.title} className="w-full h-24 object-cover rounded-lg mb-1.5" />
              )}
              <h5 className="font-bold text-xs truncate text-black dark:text-white">{linkPreview.title}</h5>
              <p className="text-[10px] opacity-75 truncate">{linkPreview.description}</p>
              {!checkLinkSafety(linkPreview.url).isSafe && (
                <div className="mt-1 px-2 py-0.5 rounded bg-rose-500 text-white text-[9px] font-black uppercase inline-block">
                  ⚠️ AI Safety: Suspicious Link
                </div>
              )}
            </a>
          )}

          {/* Inline Translation Display */}
          {translation && (
            <div
              className={`mt-2 pt-2 border-t text-xs leading-relaxed ${
                isMe ? 'border-white/20 text-white/95' : 'border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              <div className="flex items-center space-x-1 text-[10px] font-bold text-[#FFD700] mb-0.5">
                <span>✨</span>
                <span>TRANSLATED</span>
              </div>
              <p>{translation}</p>
            </div>
          )}

          {/* Feature 107: Thread Replies Counter Chip */}
          {message.thread_reply_count !== undefined && message.thread_reply_count > 0 && (
            <button
              type="button"
              onClick={() => onOpenThread && onOpenThread(message)}
              className="mt-2 flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-white/20 dark:bg-black/30 hover:opacity-90 text-[11px] font-black text-inherit"
            >
              <span>💬</span>
              <span>{message.thread_reply_count} {message.thread_reply_count === 1 ? 'reply' : 'replies'}</span>
              <span>→</span>
            </button>
          )}

          {mediaResolveError && ['image', 'video', 'audio', 'voice_note', 'file'].includes(message.message_type) && (
            <div role="status" className="mb-2 rounded-xl border border-rose-300/60 bg-rose-50/80 dark:bg-rose-950/30 px-3 py-2 text-[11px] text-rose-700 dark:text-rose-200">
              Media is unavailable. Check access permissions or ask the sender to resend the file.
            </div>
          )}

          {/* Footer Metadata: Status indicators (Feature 127), Star, Timestamp & Ticks */}
          <div
            className={`flex items-center justify-end space-x-1.5 mt-1 select-none text-[10px] ${
              isMe ? 'text-white/80' : 'text-[#4B5563] dark:text-[#9CA3AF]'
            }`}
          >
            {message.is_saved_for_later && <span title="Saved for later">🔖</span>}
            {message.is_starred && <span title="Starred message">⭐</span>}
            {message.edited_at && <span className="italic opacity-80">Edited</span>}
            <span>{formatMessageTime(message.created_at)}</span>

            {/* Feature 127: Message Micro-status Machine */}
            {isMe && (
              <span className="inline-flex items-center ml-0.5">
                {message.delivery_status === 'sending' ? (
                  <span title="Queued" className="animate-spin text-xs">⏳</span>
                ) : message.delivery_status === 'failed' ? (
                  <button
                    type="button"
                    onClick={() => onRetrySend && onRetrySend(message)}
                    className="text-rose-400 font-black cursor-pointer hover:underline"
                    title="Failed to send — tap to retry"
                  >
                    ⚠️ Retry
                  </button>
                ) : message.is_read || message.delivery_status === 'read' ? (
                  <span className="text-[#FFD700] font-black tracking-tighter" title="Read by recipient">✓✓</span>
                ) : (
                  <span className="text-white/70 font-bold tracking-tighter" title="Delivered">✓✓</span>
                )}
              </span>
            )}
          </div>

          {/* Reaction Pills */}
          {Object.keys(reactionCounts).length > 0 && (
            <div className="absolute -bottom-2.5 right-2 flex items-center space-x-1 z-10">
              {Object.entries(reactionCounts).map(([emoji, count]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(message.id, emoji)}
                  className="px-2 py-0.5 rounded-full bg-[#FFD700] text-[#1A1A2E] text-xs font-bold shadow-md flex items-center space-x-1 border border-[#FFD700]/40 hover:scale-110 active:scale-95 transition-transform"
                >
                  <span>{emoji}</span>
                  {count > 1 && <span className="text-[10px] font-black">{count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hover / Long-press Action Bar */}
        <div
          className={`absolute -top-7 ${
            isMe ? 'right-2' : 'left-2'
          } hidden group-hover:flex items-center space-x-1 bg-white/95 dark:bg-[#161B2B]/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5 shadow-lg z-20 animate-fade-in`}
        >
          <button
            type="button"
            onClick={() => setShowReactionsPicker((prev) => !prev)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-xs"
            title="React"
          >
            😊
          </button>
          <button
            type="button"
            onClick={() => onReply(message)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-xs font-bold"
            title="Reply"
          >
            ↩
          </button>
          <button
            type="button"
            onClick={() => onStar && onStar(message.id)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-xs"
            title="Star message"
          >
            ⭐
          </button>
          <button
            type="button"
            onClick={() => setShowActionsMenu((prev) => !prev)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-xs font-bold"
            title="More actions"
          >
            ⋯
          </button>
        </div>

        {showReactionsPicker && (
          <ReactionPicker
            onSelectEmoji={(emoji) => {
              onReact(message.id, emoji);
              setShowReactionsPicker(false);
            }}
            onClose={() => setShowReactionsPicker(false)}
          />
        )}

        {showActionsMenu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowActionsMenu(false)} />
            <div
              className={`absolute z-40 bg-white dark:bg-[#161B2B] shadow-2xl border border-gray-200 dark:border-gray-700 rounded-2xl py-1.5 w-52 text-xs font-semibold ${
                isMe ? 'right-0 top-8' : 'left-0 top-8'
              }`}
            >
              {/* Feature 107 Thread reply */}
              {onOpenThread && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenThread(message);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>💬</span>
                  <span>Reply in thread</span>
                </button>
              )}

              {/* Feature 115 Reminder */}
              {onRemind && (
                <button
                  type="button"
                  onClick={() => {
                    onRemind(message);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>🔔</span>
                  <span>Remind me later</span>
                </button>
              )}

              {/* Feature 140 Save for later */}
              {onSaveForLater && (
                <button
                  type="button"
                  onClick={() => {
                    onSaveForLater(message);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>🔖</span>
                  <span>Save for later</span>
                </button>
              )}

              {message.content && !isMe && (
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span className="text-sm">✨</span>
                  <span>{isTranslating ? 'Translating…' : translation ? 'Hide translation' : 'Translate message'}</span>
                </button>
              )}

              {isMe && message.message_type === 'text' && onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onEdit(message);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>✏️</span>
                  <span>Edit message</span>
                </button>
              )}

              {onForward && (
                <button
                  type="button"
                  onClick={() => {
                    onForward(message);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>↪</span>
                  <span>Forward</span>
                </button>
              )}

              {onPin && (
                <button
                  type="button"
                  onClick={() => {
                    onPin(message.id);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
                >
                  <span>📌</span>
                  <span>Pin message</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onDelete(message.id, false);
                  setShowActionsMenu(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-black dark:text-white"
              >
                <span>🗑</span>
                <span>Delete for me</span>
              </button>

              {isMe && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(message.id, true);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center space-x-2 font-bold"
                >
                  <span>🗑</span>
                  <span>Delete for everyone</span>
                </button>
              )}

              {!isMe && onReport && (
                <button
                  type="button"
                  onClick={() => {
                    onReport(message);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center space-x-2"
                >
                  <span>🚩</span>
                  <span>Report message</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
