import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearCharacterChat,
  createCharacter,
  loadCharacterChat,
  loadCharacters,
  makeChatMessage,
  saveCharacterChat,
  saveCharacters,
} from './aiCharacters';

const storage = new Map<string, string>();
const localStore = {
  getItem: (key: string) => storage.has(key) ? storage.get(key)! : null,
  setItem: (key: string, value: string) => { storage.set(key, String(value)); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => storage.clear(),
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  get length() { return storage.size; },
};

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStore });
});

function sampleCharacter(name = 'Zara') {
  return createCharacter({
    name, role: 'Supportive friend', behavior: 'Warm, playful and thoughtful',
    scenario: 'A relaxed late-night conversation', speakingStyle: 'Natural Roman Urdu',
    avatarUrl: null, temperature: 0.85, responseLength: 'balanced',
    language: 'Roman Urdu', memoryEnabled: true,
    groupParticipation: 'mentioned_or_relevant', sampleDialogue: '',
  });
}

test('characters are saved and loaded per account in local storage', () => {
  const character = sampleCharacter();
  saveCharacters('user-a', [character]);
  assert.equal(loadCharacters('user-a').length, 1);
  assert.equal(loadCharacters('user-a')[0].name, 'Zara');
  assert.equal(loadCharacters('user-b').length, 0);
});

test('private character history stays in local storage and can be cleared', () => {
  const first = makeChatMessage('user', 'Assalam o alaikum');
  const reply = makeChatMessage('assistant', 'Walaikum assalam! 😊');
  saveCharacterChat('user-a', 'char-a', [first, reply]);
  assert.deepEqual(loadCharacterChat('user-a', 'char-a').map((item) => item.role), ['user', 'assistant']);
  assert.equal(loadCharacterChat('user-b', 'char-a').length, 0);
  clearCharacterChat('user-a', 'char-a');
  assert.equal(loadCharacterChat('user-a', 'char-a').length, 0);
});

test('character and chat history caps prevent unbounded local storage growth', () => {
  const characters = Array.from({ length: 45 }, (_, index) => sampleCharacter(`Character ${index}`));
  saveCharacters('user-a', characters);
  assert.equal(loadCharacters('user-a').length, 40);
  const messages = Array.from({ length: 510 }, (_, index) => makeChatMessage(index % 2 ? 'assistant' : 'user', `Message ${index}`));
  saveCharacterChat('user-a', 'char-a', messages);
  assert.equal(loadCharacterChat('user-a', 'char-a').length, 500);
});
