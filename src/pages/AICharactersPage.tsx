import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { Avatar } from '../components/Avatar';
import {
  AICharacter, createCharacter, loadCharacters, saveCharacters,
} from '../lib/aiCharacters';

const emptyForm = {
  name: '', role: '', behavior: '', scenario: '', speakingStyle: 'Natural, expressive, emotionally aware',
  language: 'Match my language (Urdu, Roman Urdu, English, etc.)', temperature: 0.85,
  responseLength: 'balanced' as const, memoryEnabled: true,
  groupParticipation: 'mentioned_or_relevant' as const, sampleDialogue: '',
};

async function compressAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.');
  const source = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not process this image.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();
  return canvas.toDataURL('image/jpeg', 0.78);
}

export const AICharactersPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [characters, setCharacters] = useState<AICharacter[]>(() => user ? loadCharacters(user.id) : []);
  const [form, setForm] = useState(emptyForm);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateField = <K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const resetBuilder = () => {
    setForm(emptyForm);
    setAvatarUrl(null);
    setEditingId(null);
    setShowBuilder(false);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const startEdit = (character: AICharacter) => {
    setForm({
      name: character.name, role: character.role, behavior: character.behavior,
      scenario: character.scenario, speakingStyle: character.speakingStyle,
      language: character.language, temperature: character.temperature,
      responseLength: character.responseLength, memoryEnabled: character.memoryEnabled,
      groupParticipation: character.groupParticipation, sampleDialogue: character.sampleDialogue,
    });
    setAvatarUrl(character.avatarUrl);
    setEditingId(character.id);
    setShowBuilder(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAvatar = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await compressAvatar(file);
      setAvatarUrl(dataUrl);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not use this image.', 'error');
    }
  };

  const persist = (next: AICharacter[]) => {
    if (!user) return;
    saveCharacters(user.id, next);
    setCharacters(next);
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const name = form.name.trim();
    const role = form.role.trim();
    if (!name || !role) {
      toast('Character name and role are required.', 'error');
      return;
    }
    if (form.behavior.length > 2000 || form.scenario.length > 2000) {
      toast('Behavior and scenario must each be under 2,000 characters.', 'error');
      return;
    }
    setSaving(true);
    try {
      const existing = editingId ? characters.find((item) => item.id === editingId) : undefined;
      const character: AICharacter = existing ? {
        ...existing, ...form, name, role, avatarUrl, updatedAt: new Date().toISOString(),
      } : createCharacter({ ...form, name, role, avatarUrl });
      const next = editingId
        ? characters.map((item) => item.id === editingId ? character : item)
        : [character, ...characters];
      persist(next);
      resetBuilder();
      toast(editingId ? 'Character updated on this device.' : 'Your AI character is ready!', 'success');
    } catch {
      toast('Could not save locally. Free up browser storage and try a smaller profile picture.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteCharacter = (character: AICharacter) => {
    if (!user || !window.confirm(`Delete ${character.name} and its private local chat history on this device?`)) return;
    const next = characters.filter((item) => item.id !== character.id);
    try {
      persist(next);
      localStorage.removeItem(`inspire_ai_chat_v1:${user.id}:${character.id}`);
      toast('Character and its local chat history deleted.', 'success');
    } catch {
      toast('Could not update local storage.', 'error');
    }
  };

  const exportCharacters = () => {
    const blob = new Blob([JSON.stringify(characters, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'inspire-ai-characters.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importCharacters = async (file?: File) => {
    if (!file || !user) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error('This file is not an AI character export.');
      const imported = parsed.slice(0, 40).filter((item) =>
        item && typeof item.name === 'string' && typeof item.role === 'string'
      ).map((item) => createCharacter({
        name: item.name.slice(0, 80), role: item.role.slice(0, 240),
        behavior: String(item.behavior || '').slice(0, 2000),
        scenario: String(item.scenario || '').slice(0, 2000),
        speakingStyle: String(item.speakingStyle || 'Natural, expressive, concise').slice(0, 500),
        avatarUrl: typeof item.avatarUrl === 'string' && item.avatarUrl.startsWith('data:image/') ? item.avatarUrl : null,
        temperature: Math.min(1.2, Math.max(0.2, Number(item.temperature) || 0.85)),
        responseLength: ['short', 'balanced', 'detailed'].includes(item.responseLength) ? item.responseLength : 'balanced',
        language: String(item.language || 'Match my language').slice(0, 80),
        memoryEnabled: item.memoryEnabled !== false,
        groupParticipation: ['mentioned_or_relevant', 'mentioned_only', 'every_message'].includes(item.groupParticipation) ? item.groupParticipation : 'mentioned_or_relevant',
        sampleDialogue: String(item.sampleDialogue || '').slice(0, 1000),
      }));
      const next = [...imported, ...characters].slice(0, 40);
      persist(next);
      toast(`Imported ${imported.length} character(s) locally.`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not import characters.', 'error');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-[#0B0F1A] text-gray-900 dark:text-white">
      <header className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-[#0B0F1A]/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/chats')} className="rounded-xl px-3 py-2 bg-gray-100 dark:bg-gray-800" aria-label="Back to chats">←</button>
          <div className="flex-1">
            <h1 className="text-lg font-black">AI Characters</h1>
            <p className="text-xs text-gray-500">Create personalities that feel alive, expressive and consistent.</p>
          </div>
          <button onClick={() => { resetBuilder(); setShowBuilder(true); }} className="rounded-xl bg-[#0E2A6E] text-white px-4 py-2.5 text-xs font-black">＋ Create</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        <section className="rounded-3xl p-5 md:p-6 bg-gradient-to-br from-[#0E2A6E] to-[#39217C] text-white">
          <div className="flex items-start gap-4">
            <div className="text-4xl">✨</div>
            <div className="flex-1">
              <h2 className="font-black text-xl">Your cast. Your rules.</h2>
              <p className="text-sm text-white/80 mt-1 max-w-2xl">Define a character's name, role, personality, scenario, speaking style, language and example dialogue. Private conversations stay in this browser's local storage, not in your Supabase messages table.</p>
              <div className="flex flex-wrap gap-2 mt-4 text-[11px] font-bold">
                <span className="rounded-full bg-white/15 px-3 py-1.5">🔒 Local private chats</span>
                <span className="rounded-full bg-white/15 px-3 py-1.5">🧠 Llama 3.3 70B via Cloudflare</span>
                <span className="rounded-full bg-white/15 px-3 py-1.5">👥 Group participation</span>
              </div>
            </div>
          </div>
        </section>

        {showBuilder && (
          <form onSubmit={handleSave} className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121827] p-5 md:p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="font-black text-lg">{editingId ? 'Edit character' : 'Build a character'}</h2><p className="text-xs text-gray-500 mt-1">The more specific the personality, the more consistent the roleplay.</p></div>
              <button type="button" onClick={resetBuilder} className="rounded-lg px-3 py-2 bg-gray-100 dark:bg-gray-800 text-xs font-bold">Cancel</button>
            </div>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => avatarInputRef.current?.click()} className="relative rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-1">
                <Avatar name={form.name || 'AI'} avatarUrl={avatarUrl} size="xl" />
                <span className="absolute -bottom-1 -right-1 rounded-full bg-[#FFD700] text-black w-7 h-7 flex items-center justify-center font-black">＋</span>
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatar(e.target.files?.[0])} />
              <div><p className="font-bold text-sm">Character picture</p><p className="text-xs text-gray-500 mt-1">Optional. Compressed to a small image and stored locally on this device.</p>{avatarUrl && <button type="button" onClick={() => setAvatarUrl(null)} className="text-xs text-rose-500 mt-2">Remove picture</button>}</div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="space-y-1.5 block"><span className="text-xs font-bold">Name *</span><input required maxLength={80} value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="e.g. Zara, Captain Nova, Professor Ali" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-3 text-sm outline-none focus:border-blue-500" /></label>
              <label className="space-y-1.5 block"><span className="text-xs font-bold">Role *</span><input required maxLength={240} value={form.role} onChange={(e) => updateField('role', e.target.value)} placeholder="e.g. supportive best friend and witty storyteller" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-3 text-sm outline-none focus:border-blue-500" /></label>
              <label className="space-y-1.5 block md:col-span-2"><span className="text-xs font-bold">Behavior & personality</span><textarea maxLength={2000} rows={3} value={form.behavior} onChange={(e) => updateField('behavior', e.target.value)} placeholder="Temperament, values, humor, emotional reactions, boundaries, habits, how they comfort or disagree..." className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-3 text-sm outline-none focus:border-blue-500" /></label>
              <label className="space-y-1.5 block md:col-span-2"><span className="text-xs font-bold">Scenario / background</span><textarea maxLength={2000} rows={3} value={form.scenario} onChange={(e) => updateField('scenario', e.target.value)} placeholder="Where are you both? What is the relationship, backstory, current situation or shared goal?" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-3 text-sm outline-none focus:border-blue-500" /></label>
              <label className="space-y-1.5 block"><span className="text-xs font-bold">Speaking style</span><input maxLength={500} value={form.speakingStyle} onChange={(e) => updateField('speakingStyle', e.target.value)} placeholder="Playful, poetic, calm, sarcastic..." className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-3 text-sm outline-none focus:border-blue-500" /></label>
              <label className="space-y-1.5 block"><span className="text-xs font-bold">Language</span><input maxLength={80} value={form.language} onChange={(e) => updateField('language', e.target.value)} placeholder="Roman Urdu, Urdu, English..." className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-3 text-sm outline-none focus:border-blue-500" /></label>
              <label className="space-y-1.5 block"><span className="text-xs font-bold">Example dialogue (optional)</span><textarea maxLength={1000} rows={2} value={form.sampleDialogue} onChange={(e) => updateField('sampleDialogue', e.target.value)} placeholder="Write 1–3 example lines to teach the character's voice." className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-3 text-sm outline-none focus:border-blue-500" /></label>
              <label className="space-y-1.5 block"><span className="text-xs font-bold">Reply length</span><select value={form.responseLength} onChange={(e) => updateField('responseLength', e.target.value as typeof form.responseLength)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121827] px-3 py-3 text-sm"><option value="short">Short & snappy</option><option value="balanced">Balanced conversation</option><option value="detailed">Detailed & descriptive</option></select></label>
              <label className="space-y-1.5 block"><span className="text-xs font-bold">Creativity: {form.temperature.toFixed(2)}</span><input type="range" min="0.2" max="1.2" step="0.05" value={form.temperature} onChange={(e) => updateField('temperature', Number(e.target.value))} className="w-full mt-4" /><span className="text-[11px] text-gray-500">Lower = consistent; higher = more surprising.</span></label>
              <label className="space-y-1.5 block"><span className="text-xs font-bold">Group speaking mode</span><select value={form.groupParticipation} onChange={(e) => updateField('groupParticipation', e.target.value as typeof form.groupParticipation)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121827] px-3 py-3 text-sm"><option value="mentioned_or_relevant">Reply when mentioned or relevant</option><option value="mentioned_only">Only when mentioned by name</option><option value="every_message">Join every new conversation turn</option></select></label>
              <label className="flex items-start gap-3 rounded-xl bg-gray-50 dark:bg-gray-900 p-3 md:col-span-2"><input type="checkbox" checked={form.memoryEnabled} onChange={(e) => updateField('memoryEnabled', e.target.checked)} className="mt-1" /><span><span className="block text-sm font-bold">Remember this local conversation</span><span className="block text-xs text-gray-500 mt-1">Chat history is stored only in this browser. If disabled, messages are cleared when you leave the character chat.</span></span></label>
            </div>
            <div className="flex justify-end"><button disabled={saving} type="submit" className="rounded-xl bg-[#0E2A6E] text-white px-6 py-3 text-sm font-black disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create character'}</button></div>
          </form>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div><h2 className="font-black text-lg">Your characters <span className="text-gray-400 text-sm">({characters.length}/40)</span></h2><p className="text-xs text-gray-500">Saved locally on this browser, not synced between devices.</p></div>
          <div className="flex gap-2"><button onClick={() => importInputRef.current?.click()} className="rounded-xl px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold">Import JSON</button><input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importCharacters(e.target.files?.[0])} /><button onClick={exportCharacters} disabled={!characters.length} className="rounded-xl px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold disabled:opacity-40">Export</button></div>
        </div>

        {characters.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
            <div className="text-5xl">🎭</div><h3 className="font-black text-lg mt-3">Meet your first character</h3><p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">Create a supportive friend, mentor, fantasy hero, language partner or any original persona.</p><button onClick={() => setShowBuilder(true)} className="mt-5 rounded-xl bg-[#0E2A6E] text-white px-5 py-3 text-sm font-black">Create your first character</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {characters.map((character) => (
              <article key={character.id} className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121827] p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3"><Avatar name={character.name} avatarUrl={character.avatarUrl} size="lg" /><div className="min-w-0 flex-1"><h3 className="font-black truncate">{character.name}</h3><p className="text-xs text-gray-500 line-clamp-2">{character.role}</p></div><span title="Saved on this device">🔒</span></div>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{character.behavior || 'Personality will develop from the role and scenario.'}</p>
                <div className="flex flex-wrap gap-1.5 text-[10px]"><span className="rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-1">{character.responseLength}</span><span className="rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2 py-1">{character.language}</span><span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-1">Local chat</span></div>
                <div className="grid grid-cols-2 gap-2 mt-auto pt-2"><button onClick={() => navigate(`/ai-characters/${character.id}`)} className="rounded-xl bg-[#0E2A6E] text-white px-3 py-2.5 text-xs font-black">💬 Chat</button><button onClick={() => startEdit(character)} className="rounded-xl bg-gray-100 dark:bg-gray-800 px-3 py-2.5 text-xs font-bold">Edit</button><button onClick={() => deleteCharacter(character)} className="rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 px-3 py-2 text-xs font-bold">Delete</button><button onClick={() => navigate(`/chats?addAI=${character.id}`)} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-bold">👥 Group info</button></div>
              </article>
            ))}
          </div>
        )}
        <p className="text-[11px] text-gray-500 leading-relaxed">Privacy note: character definitions, profile pictures and private chat history are stored in your browser's localStorage. Browser clearing or switching devices can remove them. Messages you send into a group are stored in Supabase as group messages, with the AI character attribution attached.</p>
      </main>
    </div>
  );
};
