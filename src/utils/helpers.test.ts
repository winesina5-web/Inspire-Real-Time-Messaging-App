import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidUsername,
  isMessageDeletedForViewer,
  validateMediaUpload,
  formatLastSeen,
  formatDuration,
  extractUrlsFromText,
  checkLinkSafety,
  calculatePollOptionPercentage,
  generateIcsCalendar,
  hashPin,
  formatDateSeparator,
  isAccountAgeRestricted,
  matchSearchQuery,
  parseMarkdownToHtml,
  analyzeTypingCoach,
  checkTicTacToeWinner,
  evaluateWordGuess,
  verifyChatPinMode,
} from './helpers';

test('username validation adheres to 3-20 lowercase alphanumeric + underscore', () => {
  assert.equal(isValidUsername('john_doe'), true);
  assert.equal(isValidUsername('alice123'), true);
  assert.equal(isValidUsername('a_b'), true);
  assert.equal(isValidUsername('ab'), false, 'too short');
  assert.equal(isValidUsername('User_Name'), false, 'no uppercase');
});

test('per-viewer message deletion rules', () => {
  const msg = {
    sender_id: 'user_1',
    receiver_id: 'user_2',
    is_deleted_sender: true,
    is_deleted_receiver: false,
  };

  assert.equal(isMessageDeletedForViewer(msg, 'user_1'), true);
  assert.equal(isMessageDeletedForViewer(msg, 'user_2'), false);
});

test('media upload size limits', () => {
  assert.equal(validateMediaUpload('image', 5 * 1024 * 1024).valid, true);
  assert.equal(validateMediaUpload('image', 12 * 1024 * 1024).valid, false);
  assert.equal(validateMediaUpload('file', 20 * 1024 * 1024).valid, true);
  assert.equal(validateMediaUpload('file', 30 * 1024 * 1024).valid, false);
});

test('extractUrlsFromText finds links accurately', () => {
  const text = 'Check out https://inspire.app and http://test.org/path?q=1 for updates!';
  const urls = extractUrlsFromText(text);
  assert.equal(urls.length, 2);
  assert.equal(urls[0], 'https://inspire.app');
  assert.equal(urls[1], 'http://test.org/path?q=1');
});

test('checkLinkSafety identifies flagged patterns', () => {
  assert.equal(checkLinkSafety('https://inspire.app').isSafe, true);
  assert.equal(checkLinkSafety('http://phishing-site.com/login-verify').isSafe, false);
});

test('calculatePollOptionPercentage calculates rounded % correctly', () => {
  assert.equal(calculatePollOptionPercentage(5, 10), 50);
  assert.equal(calculatePollOptionPercentage(1, 3), 33);
  assert.equal(calculatePollOptionPercentage(0, 0), 0);
});

test('generateIcsCalendar produces valid RFC5545 calendar string', () => {
  const ics = generateIcsCalendar({
    title: 'Architecture Review',
    startTime: new Date('2026-10-24T14:00:00Z'),
  });
  assert.equal(ics.includes('BEGIN:VCALENDAR'), true);
  assert.equal(ics.includes('SUMMARY:Architecture Review'), true);
  assert.equal(ics.includes('END:VCALENDAR'), true);
});

test('hashPin returns deterministic hexadecimal hash', () => {
  const h1 = hashPin('1234');
  const h2 = hashPin('1234');
  const h3 = hashPin('5678');
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test('formatDateSeparator returns Today, Yesterday, or month date', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const today = new Date('2026-10-24T09:00:00Z');
  const yesterday = new Date('2026-10-23T15:00:00Z');
  const past = new Date('2026-10-10T10:00:00Z');

  assert.equal(formatDateSeparator(today, now), 'Today');
  assert.equal(formatDateSeparator(yesterday, now), 'Yesterday');
  assert.equal(formatDateSeparator(past, now), 'Oct 10');
});

test('isAccountAgeRestricted flags accounts created under 1 hour', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const newAccount = new Date('2026-10-24T11:45:00Z'); // 15 mins ago
  const matureAccount = new Date('2026-10-24T10:00:00Z'); // 2 hours ago

  assert.equal(isAccountAgeRestricted(newAccount, 1, now), true);
  assert.equal(isAccountAgeRestricted(matureAccount, 1, now), false);
});

test('matchSearchQuery correctly matches substrings case-insensitively', () => {
  assert.equal(matchSearchQuery('Hello world from Inspire chat', 'world'), true);
  assert.equal(matchSearchQuery('Hello world from Inspire chat', 'INSPIRE'), true);
  assert.equal(matchSearchQuery('Hello world from Inspire chat', 'xyz'), false);
  assert.equal(matchSearchQuery('Hello world', ''), false);
});

test('parseMarkdownToHtml renders bold, italic, code, and links with safe escaping', () => {
  const input = 'Hello **bold** and `code` and [Inspire](https://inspire.app) <script>alert(1)</script>';
  const output = parseMarkdownToHtml(input);
  assert.equal(output.includes('<strong class="font-bold">bold</strong>'), true);
  assert.equal(output.includes('<code class="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-xs">code</code>'), true);
  assert.equal(output.includes('<a href="https://inspire.app" target="_blank" rel="noopener noreferrer" class="underline text-[#FFD700] hover:opacity-80">Inspire</a>'), true);
  assert.equal(output.includes('&lt;script&gt;'), true, 'XSS script tags are strictly escaped');
});

test('analyzeTypingCoach detects ALL CAPS, excessive punctuation', () => {
  assert.equal(analyzeTypingCoach('PLEASE RESPOND NOW') !== null, true);
  assert.equal(analyzeTypingCoach('Hey there, ready for lunch???!!!') !== null, true);
  assert.equal(analyzeTypingCoach('Hello there, how are you doing today?'), null);
});

test('checkTicTacToeWinner correctly computes win rows, diagonals and draw', () => {
  // Row win
  const rowWin = ['X', 'X', 'X', null, 'O', null, 'O', null, null];
  assert.equal(checkTicTacToeWinner(rowWin).winner, 'X');

  // Diagonal win
  const diagWin = ['O', 'X', null, 'X', 'O', null, null, null, 'O'];
  assert.equal(checkTicTacToeWinner(diagWin).winner, 'O');

  // Draw
  const drawBoard = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
  assert.equal(checkTicTacToeWinner(drawBoard).isDraw, true);
});

test('evaluateWordGuess scores exact, partial, and absent letters', () => {
  const scores = evaluateWordGuess('CRANE', 'PEACH');
  // C: present (in PEACH at pos 3)
  // R: absent
  // A: correct (pos 2)
  // N: absent
  // E: present (pos 1)
  assert.equal(scores[0], 'present');
  assert.equal(scores[1], 'absent');
  assert.equal(scores[2], 'correct');
  assert.equal(scores[3], 'absent');
  assert.equal(scores[4], 'present');
});

test('verifyChatPinMode distinguishes real PIN, decoy PIN, and wrong PIN', () => {
  const realHash = hashPin('1234');
  const decoyHash = hashPin('9999');

  assert.equal(verifyChatPinMode('1234', realHash, decoyHash), 'real');
  assert.equal(verifyChatPinMode('9999', realHash, decoyHash), 'decoy');
  assert.equal(verifyChatPinMode('0000', realHash, decoyHash), 'wrong');
});

