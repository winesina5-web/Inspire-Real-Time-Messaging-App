import { Message, MessageType } from '../types';

export function isValidUsername(username: string): boolean {
  if (!username) return false;
  const regex = /^[a-z0-9_]{3,20}$/;
  return regex.test(username);
}

export function isMessageDeletedForViewer(
  message: Pick<Message, 'sender_id' | 'receiver_id' | 'is_deleted_sender' | 'is_deleted_receiver'>,
  viewerId: string
): boolean {
  if (viewerId === message.sender_id && message.is_deleted_sender) {
    return true;
  }
  if (viewerId === message.receiver_id && message.is_deleted_receiver) {
    return true;
  }
  return false;
}

export const MEDIA_LIMITS_BYTES: Record<MessageType | 'avatar', number> = {
  text: 64 * 1024,              // 64KB
  image: 10 * 1024 * 1024,      // 10MB
  video: 50 * 1024 * 1024,      // 50MB
  audio: 20 * 1024 * 1024,      // 20MB
  voice_note: 10 * 1024 * 1024, // 10MB
  avatar: 5 * 1024 * 1024,      // 5MB
  file: 25 * 1024 * 1024,       // 25MB (Feature 22)
  sticker: 2 * 1024 * 1024,     // 2MB
  gif: 10 * 1024 * 1024,        // 10MB
  location: 8 * 1024,
  contact_card: 8 * 1024,
  poll: 16 * 1024,
  game: 32 * 1024,
  split: 16 * 1024,
  event: 32 * 1024,
  music_card: 16 * 1024,
  direct_transfer: 500 * 1024 * 1024, // 500MB
};

export function validateMediaUpload(
  type: MessageType | 'avatar',
  sizeInBytes: number
): { valid: boolean; error?: string } {
  const max = MEDIA_LIMITS_BYTES[type];
  if (!max) return { valid: false, error: 'Unknown media type' };
  if (sizeInBytes > max) {
    const mb = Math.round(max / (1024 * 1024));
    return { valid: false, error: `File exceeds maximum allowed size of ${mb}MB` };
  }
  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatLastSeen(dateString: string, now: Date = new Date()): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Recently';

  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return `Today at ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return `Yesterday at ${timeStr}`;

  const dateStr = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${dateStr} at ${timeStr}`;
}

export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getAvatarColor(nameOrId: string): { bg: string; text: string } {
  const palette = [
    { bg: '#0E2A6E', text: '#FFFFFF' },
    { bg: '#1A4FBA', text: '#FFFFFF' },
    { bg: '#FFD700', text: '#1A1A2E' },
    { bg: '#081B47', text: '#FFFFFF' },
    { bg: '#254BA8', text: '#FFFFFF' },
    { bg: '#E5A900', text: '#1A1A2E' },
  ];
  let hash = 0;
  for (let i = 0; i < nameOrId.length; i++) {
    hash = nameOrId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
}

/**
 * Extracts valid HTTP/HTTPS URLs from message text for Link Previews (Feature 8)
 */
export function extractUrlsFromText(text: string): string[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = text.match(urlRegex);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Evaluates whether a link is potentially risky (Feature 38 AI Link Safety heuristic)
 */
export function checkLinkSafety(url: string): { isSafe: boolean; warning?: string } {
  const suspiciousKeywords = ['phish', 'login-verify', 'free-crypto', 'update-password', 'bonus-gift'];
  const lower = url.toLowerCase();
  for (const kw of suspiciousKeywords) {
    if (lower.includes(kw)) {
      return { isSafe: false, warning: `Flagged suspicious pattern: ${kw}` };
    }
  }
  return { isSafe: true };
}

/**
 * Calculates poll percentages per option (Feature 29)
 */
export function calculatePollOptionPercentage(votesCount: number, totalVotes: number): number {
  if (!totalVotes || totalVotes <= 0) return 0;
  return Math.round((votesCount / totalVotes) * 100);
}

/**
 * Generates an iCalendar (.ics) string for exported meetings (Feature 39)
 */
export function generateIcsCalendar(event: {
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime?: Date;
}): string {
  const formatIcsDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const end = event.endTime || new Date(event.startTime.getTime() + 3600000);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Inspire Messenger//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@inspire.app`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(event.startTime)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${event.title.replace(/[,;]/g, '')}`,
    `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
    event.location ? `LOCATION:${event.location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/**
 * Simple deterministic hash for Secret Chat / App Lock PINs (Feature 41, 42)
 */
export function hashPin(pin: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < pin.length; i++) {
    h ^= pin.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/**
 * Computes calendar date separator for chat list bubbles ("Today", "Yesterday", "MMM D, YYYY") (Feature 78)
 */
export function formatDateSeparator(dateInput: string | Date, now: Date = new Date()): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Checks if an account is in the new-account restriction grace window (< 1 hr old) (Feature 94)
 */
export function isAccountAgeRestricted(createdAt: string | Date, thresholdHours: number = 1, now: Date = new Date()): boolean {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  if (isNaN(created.getTime())) return false;
  const ageMs = now.getTime() - created.getTime();
  return ageMs < thresholdHours * 60 * 60 * 1000;
}

/**
 * Triggers subtle vibration haptics on supported mobile browsers (Feature 84)
 */
export function triggerHaptic(type: 'light' | 'medium' | 'success' = 'light'): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'light') navigator.vibrate(10);
      else if (type === 'medium') navigator.vibrate(25);
      else if (type === 'success') navigator.vibrate([15, 40, 15]);
    } catch {
      // Haptics not allowed or denied by browser policy
    }
  }
}

/**
 * Filters and highlights matching messages for Global Search (Feature 74)
 */
export function matchSearchQuery(content: string, query: string): boolean {
  if (!query || !query.trim()) return false;
  return content.toLowerCase().includes(query.trim().toLowerCase());
}

/**
 * Feature 144: Lightweight, safe Markdown parser
 * Supports: bold (*text* / **text**), italic (_text_), strikethrough (~text~),
 * inline code (`code`), and [text](url).
 * Strict HTML entity escaping prevents XSS.
 */
export function parseMarkdownToHtml(markdownText: string): string {
  if (!markdownText) return '';

  // 1. HTML entity escape to prevent XSS
  let escaped = markdownText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // 2. Inline code: `code`
  escaped = escaped.replace(/`([^`\n]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-xs">$1</code>');

  // 3. Bold: **text** or *text* (word-boundary safe)
  escaped = escaped.replace(/\*\*([^*\n]+)\*\*/g, '<strong class="font-bold">$1</strong>');
  escaped = escaped.replace(/(^|[^\w*])\*([^*\n]+)\*([^\w*]|$)/g, '$1<strong class="font-bold">$2</strong>$3');

  // 4. Italic: _text_
  escaped = escaped.replace(/(^|[^\w_])_([^_\n]+)_([^\w_]|$)/g, '$1<em class="italic">$2</em>$3');

  // 5. Strikethrough: ~text~
  escaped = escaped.replace(/~([^~\n]+)~/g, '<del class="line-through opacity-75">$1</del>');

  // 6. Links: [text](url) — must start with http:// or https://
  escaped = escaped.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-[#FFD700] hover:opacity-80">$1</a>');

  return escaped;
}

/**
 * Feature 151: Presence-Aware Typing Coach
 * Detects patterns like ALL CAPS, excessive punctuation, or very long messages
 */
export function analyzeTypingCoach(text: string): { type: string; message: string } | null {
  if (!text || text.trim().length < 8) return null;
  const trimmed = text.trim();

  // 1. ALL CAPS check (>= 8 chars with alphabetic characters)
  const lettersOnly = trimmed.replace(/[^a-zA-Z]/g, '');
  if (lettersOnly.length >= 6 && lettersOnly === lettersOnly.toUpperCase()) {
    return {
      type: 'caps',
      message: 'You seem to be typing in ALL CAPS — did you want to emphasize something?',
    };
  }

  // 2. Excessive exclamation marks (>3 in message)
  const exclamationCount = (trimmed.match(/!/g) || []).length;
  if (exclamationCount >= 3) {
    return {
      type: 'exclamation',
      message: 'Your message is very emphatic 😊 — is that intentional?',
    };
  }

  // 3. Very long message (>= 200 words)
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 200) {
    return {
      type: 'length',
      message: 'This is a long message — consider breaking it up or sending as separate thoughts.',
    };
  }

  return null;
}

/**
 * Feature 136: Tic-Tac-Toe Logic
 */
const TTT_WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6],           // Diagonals
];

export function checkTicTacToeWinner(board: (string | null)[]): { winner: string | null; isDraw: boolean } {
  for (const [a, b, c] of TTT_WINNING_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], isDraw: false };
    }
  }
  const isDraw = board.every((cell) => cell !== null);
  return { winner: null, isDraw };
}

/**
 * Feature 136: Word Guess Evaluator (Wordle-style)
 */
export function evaluateWordGuess(guess: string, target: string): ('correct' | 'present' | 'absent')[] {
  const g = guess.toUpperCase().slice(0, 5);
  const t = target.toUpperCase().slice(0, 5);
  const result: ('correct' | 'present' | 'absent')[] = Array(5).fill('absent');
  const targetLetters = t.split('');

  // First pass: mark correct positions
  for (let i = 0; i < 5; i++) {
    if (g[i] === t[i]) {
      result[i] = 'correct';
      targetLetters[i] = '#'; // consumed
    }
  }

  // Second pass: mark present letters
  for (let i = 0; i < 5; i++) {
    if (result[i] !== 'correct') {
      const idx = targetLetters.indexOf(g[i]);
      if (idx !== -1) {
        result[i] = 'present';
        targetLetters[idx] = '#';
      }
    }
  }

  return result;
}

/**
 * Feature 124: Decoy PIN verification
 */
export function verifyChatPinMode(
  pin: string,
  realPinHash: string,
  decoyPinHash?: string | null
): 'real' | 'decoy' | 'wrong' {
  const enteredHash = hashPin(pin);
  if (enteredHash === realPinHash) return 'real';
  if (decoyPinHash && enteredHash === decoyPinHash) return 'decoy';
  return 'wrong';
}

/**
 * Feature 126: Network Quality detector helper
 */
export function getNetworkQuality(): '4g' | '3g' | '2g' {
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
    const type = conn?.effectiveType;
    if (type === '2g' || type === 'slow-2g') return '2g';
    if (type === '3g') return '3g';
    return '4g';
  }
  return '4g';
}

