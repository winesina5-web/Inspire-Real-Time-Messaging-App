import React, { useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { supabase } from '../lib/supabaseClient';
import { AICharacter, GroupAICharacter, loadCharacters } from '../lib/aiCharacters';

interface Props {
  groupId: string;
  userId: string;
  onClose: () => void;
  onChanged?: (characters: GroupAICharacter[]) => void;
}

export const GroupAICharactersPanel: React.FC<Props> = ({ groupId, userId, onClose, onChanged }) => {
  const [localCharacters, setLocalCharacters] = useState<AICharacter[]>([]);
  const [groupCharacters, setGroupCharacters] = useState<GroupAICharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setLocalCharacters(loadCharacters(userId));
      const { data, error: queryError } = await supabase
        .from('group_ai_characters')
        .select('id, group_id, character_id, added_by, name, role, behavior, scenario, speaking_style, avatar_url, trigger_mode, is_active, language, temperature, response_length, sample_dialogue, last_spoke_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });
      if (queryError) throw queryError;
      const rows = (data || []) as GroupAICharacter[];
      setGroupCharacters(rows);
      onChanged?.(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load group AI characters.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [groupId, userId]);

  const addCharacter = async (character: AICharacter) => {
    if (groupCharacters.length >= 10) {
      setError('A group can have up to 10 AI characters for healthy conversation flow.');
      return;
    }
    setBusyId(character.id);
    setError('');
    try {
      const { error: insertError } = await supabase.from('group_ai_characters').insert({
        group_id: groupId,
        character_id: character.id,
        added_by: userId,
        name: character.name,
        role: character.role,
        behavior: character.behavior,
        scenario: character.scenario,
        speaking_style: character.speakingStyle,
        avatar_url: character.avatarUrl?.startsWith('https://') ? character.avatarUrl : null,
        trigger_mode: character.groupParticipation,
        is_active: true,
        language: character.language,
        temperature: character.temperature,
        response_length: character.responseLength,
        sample_dialogue: character.sampleDialogue,
      });
      if (insertError) throw insertError;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add this character to the group.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (character: GroupAICharacter) => {
    setBusyId(character.id);
    setError('');
    try {
      const { error: updateError } = await supabase.from('group_ai_characters')
        .update({ is_active: !character.is_active, updated_at: new Date().toISOString() })
        .eq('id', character.id);
      if (updateError) throw updateError;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update this character.');
    } finally {
      setBusyId(null);
    }
  };

  const removeCharacter = async (character: GroupAICharacter) => {
    if (!window.confirm(`Remove ${character.name} from this group? Existing group messages will remain.`)) return;
    setBusyId(character.id);
    setError('');
    try {
      const { error: deleteError } = await supabase.from('group_ai_characters').delete().eq('id', character.id);
      if (deleteError) throw deleteError;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Only the character owner or a group admin can remove it.');
    } finally {
      setBusyId(null);
    }
  };

  const alreadyAdded = new Set(groupCharacters.map((character) => character.character_id));

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Group AI characters">
      <section className="w-full sm:max-w-xl max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121827] shadow-2xl">
        <header className="sticky top-0 z-10 bg-white/95 dark:bg-[#121827]/95 backdrop-blur border-b border-gray-100 dark:border-gray-800 p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-violet-100 dark:bg-violet-950/50 grid place-items-center text-xl">🎭</div>
          <div className="flex-1"><h2 className="font-black">AI group members</h2><p className="text-[11px] text-gray-500">{groupCharacters.length}/10 added to this group</p></div>
          <button onClick={onClose} className="rounded-xl bg-gray-100 dark:bg-gray-800 px-3 py-2 font-bold" aria-label="Close">✕</button>
        </header>
        <div className="p-4 space-y-5">
          <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-3 text-[11px] leading-relaxed text-amber-900 dark:text-amber-100">AI characters are shared group members, but their replies are generated by the character owner's browser while that owner has this group open. Group replies are saved in Supabase like other group messages; private character chats stay local.</div>
          {error && <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-200 p-3 text-xs">{error}</div>}
          <div>
            <h3 className="font-black text-sm mb-3">In this group</h3>
            {loading ? <p className="text-sm text-gray-500 py-4">Loading group characters…</p> : groupCharacters.length === 0 ? <p className="text-sm text-gray-500 py-4">No AI characters yet. Add one from your local collection below.</p> : (
              <div className="space-y-2">{groupCharacters.map((character) => (
                <div key={character.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 p-3">
                  <Avatar name={character.name} avatarUrl={character.character_id && loadCharacters(userId).find((item) => item.id === character.character_id)?.avatarUrl || character.avatar_url} size="md" />
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-bold text-sm truncate">{character.name}</p><span className={`w-2 h-2 rounded-full ${character.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} /></div><p className="text-[11px] text-gray-500 truncate">{character.role}</p><p className="text-[10px] text-gray-400 mt-1">{character.trigger_mode.replaceAll('_', ' ')}</p></div>
                  <button disabled={busyId === character.id} onClick={() => toggleActive(character)} className="rounded-lg bg-gray-100 dark:bg-gray-800 px-2.5 py-2 text-[10px] font-bold disabled:opacity-40">{character.is_active ? 'Pause' : 'Activate'}</button>
                  {(character.added_by === userId) && <button disabled={busyId === character.id} onClick={() => removeCharacter(character)} className="text-rose-600 px-1 text-xs font-bold disabled:opacity-40" title="Remove character">✕</button>}
                </div>
              ))}</div>
            )}
          </div>
          <div>
            <h3 className="font-black text-sm mb-1">Add your characters</h3><p className="text-[11px] text-gray-500 mb-3">Their name, role and personality settings become visible to group members. Private chat history is never copied.</p>
            {localCharacters.length === 0 ? <p className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4 text-xs text-gray-500">Create a character first in AI Characters.</p> : <div className="space-y-2">{localCharacters.map((character) => {
              const added = alreadyAdded.has(character.id);
              return <div key={character.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 dark:bg-gray-900 p-3"><Avatar name={character.name} avatarUrl={character.avatarUrl} size="md" /><div className="min-w-0 flex-1"><p className="font-bold text-sm truncate">{character.name}</p><p className="text-[11px] text-gray-500 truncate">{character.role}</p></div><button disabled={added || busyId === character.id || groupCharacters.length >= 10} onClick={() => addCharacter(character)} className="rounded-xl bg-[#0E2A6E] text-white px-3 py-2 text-[11px] font-black disabled:opacity-40">{added ? 'Added ✓' : busyId === character.id ? 'Adding…' : '＋ Add'}</button></div>;
            })}</div>}
          </div>
        </div>
      </section>
    </div>
  );
};
