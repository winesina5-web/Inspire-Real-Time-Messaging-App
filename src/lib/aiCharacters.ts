export interface AICharacter {
  id: string;
  name: string;
  role: string;
  behavior: string;
  scenario: string;
  speakingStyle: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  temperature: number;
  responseLength: 'short' | 'balanced' | 'detailed';
  language: string;
  memoryEnabled: boolean;
  groupParticipation: 'mentioned_or_relevant' | 'mentioned_only' | 'every_message';
  sampleDialogue: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  emotion?: string;
}

export interface GroupAICharacter {
  id: string;
  group_id: string;
  character_id: string;
  added_by: string;
  name: string;
  role: string;
  behavior: string;
  scenario: string;
  speaking_style: string;
  avatar_url: string | null;
  trigger_mode: 'mentioned_or_relevant' | 'mentioned_only' | 'every_message';
  is_active: boolean;
  language: string;
  temperature: number;
  response_length: 'short' | 'balanced' | 'detailed';
  sample_dialogue: string;
  last_spoke_at?: string | null;
}

const MAX_CHARACTERS = 40;
const MAX_CHAT_MESSAGES = 500;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function id(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function characterStorageKey(userId: string): string {
  return `inspire_ai_characters_v1:${userId}`;
}

export function chatStorageKey(userId: string, characterId: string): string {
  return `inspire_ai_chat_v1:${userId}:${characterId}`;
}

export function loadCharacters(userId: string): AICharacter[] {
  const characters = readJson<AICharacter[]>(characterStorageKey(userId), []);
  return Array.isArray(characters) ? characters.filter((item) =>
    item && typeof item.id === 'string' && typeof item.name === 'string'
  ).slice(0, MAX_CHARACTERS) : [];
}

export function saveCharacters(userId: string, characters: AICharacter[]): void {
  localStorage.setItem(characterStorageKey(userId), JSON.stringify(characters.slice(0, MAX_CHARACTERS)));
}

export function createCharacter(input: Omit<AICharacter, 'id' | 'createdAt' | 'updatedAt'>): AICharacter {
  const now = new Date().toISOString();
  return { ...input, id: id(), createdAt: now, updatedAt: now };
}

export function loadCharacterChat(userId: string, characterId: string): AIChatMessage[] {
  const messages = readJson<AIChatMessage[]>(chatStorageKey(userId, characterId), []);
  return Array.isArray(messages) ? messages.filter((item) =>
    item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string'
  ).slice(-MAX_CHAT_MESSAGES) : [];
}

export function saveCharacterChat(userId: string, characterId: string, messages: AIChatMessage[]): void {
  localStorage.setItem(chatStorageKey(userId, characterId), JSON.stringify(messages.slice(-MAX_CHAT_MESSAGES)));
}

export function clearCharacterChat(userId: string, characterId: string): void {
  localStorage.removeItem(chatStorageKey(userId, characterId));
}

export function makeChatMessage(role: AIChatMessage['role'], content: string, emotion?: string): AIChatMessage {
  return { id: id(), role, content, createdAt: new Date().toISOString(), ...(emotion ? { emotion } : {}) };
}

export function isRemoteImageUrl(value: string | null | undefined): boolean {
  return Boolean(value && /^https:\/\//i.test(value));
}
