import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { Avatar } from '../components/Avatar';
import {
  AIChatMessage, AICharacter, clearCharacterChat, loadCharacterChat,
  loadCharacters, makeChatMessage, saveCharacterChat,
} from '../lib/aiCharacters';
import { workerApi } from '../lib/workerApi';

export const AICharacterChatPage: React.FC = () => {
  const { characterId = '' } = useParams<{ characterId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<AICharacter | null>(null);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) return;
    const found = loadCharacters(user.id).find((item) => item.id === characterId);
    if (!found) {
      setCharacter(null);
      setLoaded(true);
      return;
    }
    setCharacter(found);
    setMessages(found.memoryEnabled ? loadCharacterChat(user.id, found.id) : []);
    setLoaded(true);
  }, [user, characterId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const updateMessages = (next: AIChatMessage[]) => {
    setMessages(next);
    if (user && character?.memoryEnabled) {
      try {
        saveCharacterChat(user.id, character.id, next);
      } catch {
        toast('Browser storage is full. Export your chat or clear older messages.', 'error');
      }
    }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || !user || !character || sending) return;
    const userMessage = makeChatMessage('user', text);
    const priorMessages = messages.slice(-16).map((message) => ({ role: message.role, content: message.content }));
    const withUser = [...messages, userMessage];
    setInput('');
    updateMessages(withUser);
    setSending(true);
    try {
      const result = await workerApi.chatWithCharacter({
        name: character.name,
        role: character.role,
        behavior: character.behavior,
        scenario: character.scenario,
        speakingStyle: character.speakingStyle,
        language: character.language,
        sampleDialogue: character.sampleDialogue,
        temperature: character.temperature,
        responseLength: character.responseLength,
        message: text,
        history: priorMessages,
      });
      updateMessages([...withUser, makeChatMessage('assistant', result.reply)]);
    } catch (error) {
      setInput(text);
      toast(error instanceof Error ? error.message : 'The character could not reply. Try again.', 'error');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    if (!user || !character || !window.confirm('Clear this character conversation from this device?')) return;
    clearCharacterChat(user.id, character.id);
    setMessages([]);
    toast('Private character chat cleared from this device.', 'success');
  };

  const exportChat = () => {
    if (!character) return;
    const blob = new Blob([JSON.stringify({ character: character.name, exportedAt: new Date().toISOString(), messages }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${character.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'ai-character'}-chat.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!loaded) {
    return <div className="min-h-screen grid place-items-center bg-[#F5F7FA] dark:bg-[#0B0F1A]"><div className="animate-spin rounded-full h-8 w-8 border-4 border-[#0E2A6E] border-t-transparent" /></div>;
  }

  if (!character) {
    return <div className="min-h-screen grid place-items-center bg-[#F5F7FA] dark:bg-[#0B0F1A] p-5"><div className="text-center max-w-sm"><div className="text-5xl">🎭</div><h1 className="font-black text-xl mt-3">Character not found</h1><p className="text-sm text-gray-500 mt-2">This character may have been deleted from this browser.</p><button onClick={() => navigate('/ai-characters')} className="mt-5 rounded-xl bg-[#0E2A6E] text-white px-5 py-3 text-sm font-bold">Back to characters</button></div></div>;
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-[#F5F7FA] dark:bg-[#0B0F1A] text-gray-900 dark:text-white">
      <header className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto flex items-center gap-3 p-3 md:p-4">
          <button onClick={() => navigate('/ai-characters')} className="rounded-xl px-3 py-2 bg-gray-100 dark:bg-gray-800" aria-label="Back">←</button>
          <Avatar name={character.name} avatarUrl={character.avatarUrl} size="md" />
          <div className="min-w-0 flex-1"><h1 className="font-black truncate">{character.name}</h1><p className="text-[11px] text-gray-500 truncate">{character.role}</p><p className="text-[10px] text-emerald-600 dark:text-emerald-400">● Cloudflare AI · Llama 3.3 70B</p></div>
          <button onClick={exportChat} disabled={!messages.length} title="Export this chat" className="rounded-xl px-3 py-2 bg-gray-100 dark:bg-gray-800 text-xs font-bold disabled:opacity-40">Export</button>
          <button onClick={clearChat} disabled={!messages.length} title="Clear local history" className="rounded-xl px-3 py-2 text-rose-600 bg-rose-50 dark:bg-rose-950/30 text-xs font-bold disabled:opacity-40">Clear</button>
        </div>
      </header>

      <div className="shrink-0 max-w-4xl mx-auto w-full px-4 pt-3">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/80 dark:bg-emerald-950/20 px-3 py-2 text-[11px] text-emerald-800 dark:text-emerald-200 flex items-start gap-2"><span>🔒</span><span><b>Private local chat.</b> Your conversation is saved in this browser only{character.memoryEnabled ? '.' : ' for this session only.'} The current prompt and recent context are sent to Cloudflare Workers AI to generate a reply, but are not inserted into your Supabase messages table.</span></div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="py-12 text-center max-w-md mx-auto">
              <Avatar name={character.name} avatarUrl={character.avatarUrl} size="xl" />
              <h2 className="font-black text-2xl mt-4">Say hello to {character.name}</h2>
              <p className="text-sm text-gray-500 mt-2">{character.scenario || character.behavior || 'Start a conversation and let the character's personality come through.'}</p>
              <div className="flex flex-wrap justify-center gap-2 mt-5">{['Tell me about yourself', 'Let’s roleplay a scene 🎭', 'I need some advice 💭'].map((suggestion) => <button key={suggestion} onClick={() => { setInput(suggestion); inputRef.current?.focus(); }} className="rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-semibold">{suggestion}</button>)}</div>
            </div>
          )}
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && <div className="shrink-0 mt-1"><Avatar name={character.name} avatarUrl={character.avatarUrl} size="sm" /></div>}
              <div className={`max-w-[88%] md:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${message.role === 'user' ? 'bg-[#0E2A6E] text-white rounded-br-md' : 'bg-white dark:bg-[#151D2D] border border-gray-100 dark:border-gray-800 rounded-bl-md'}`}>
                {message.role === 'assistant' && <div className="text-[10px] font-black text-[#0E2A6E] dark:text-[#FFD700] mb-1">{character.name}</div>}
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
                <div className={`text-[9px] mt-1.5 ${message.role === 'user' ? 'text-white/60 text-right' : 'text-gray-400'}`}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))}
          {sending && <div className="flex gap-2.5 items-end"><Avatar name={character.name} avatarUrl={character.avatarUrl} size="sm" /><div className="rounded-2xl rounded-bl-md bg-white dark:bg-[#151D2D] border border-gray-100 dark:border-gray-800 px-4 py-3"><div className="text-[10px] font-black text-[#0E2A6E] dark:text-[#FFD700] mb-1">{character.name} is thinking…</div><div className="flex gap-1"><span className="animate-bounce">•</span><span className="animate-bounce [animation-delay:120ms]">•</span><span className="animate-bounce [animation-delay:240ms]">•</span></div></div></div>}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0B0F1A] p-3">
        <form onSubmit={send} className="max-w-3xl mx-auto flex items-end gap-2">
          <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} maxLength={3000} disabled={sending} placeholder={`Message ${character.name}…`} className="min-w-0 flex-1 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#151D2D] px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-60" />
          <button type="submit" disabled={!input.trim() || sending} className="rounded-2xl bg-[#0E2A6E] text-white px-5 py-3 text-sm font-black disabled:opacity-40">Send ↗</button>
        </form>
        <p className="text-center text-[10px] text-gray-400 mt-2">AI characters are fictional. Replies may be imperfect; keep important personal information private.</p>
      </footer>
    </div>
  );
};
