import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { Avatar } from '../components/Avatar';
import { Profile } from '../types';
import { supabase, isConfigured } from '../lib/supabaseClient';

const SALT_KEY = 'inspire_vault_pin_salt_v1';
const HASH_KEY = 'inspire_vault_pin_hash_v1';
const SECRET_CONTACTS_KEY = 'inspire_vault_secret_contacts_v1';

async function derivePinHash(pin: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = Uint8Array.from(saltHex.match(/.{1,2}/g) || [], (byte) => parseInt(byte, 16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

function makeSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, '0')).join('');
}

export const SecretChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [secretIds, setSecretIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsSetup(!localStorage.getItem(HASH_KEY));
    try { setSecretIds(JSON.parse(localStorage.getItem(SECRET_CONTACTS_KEY) || '[]')); }
    catch { setSecretIds([]); }
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadContacts = async () => {
      if (!user || !isConfigured) { setContacts([]); setLoading(false); return; }
      const { data, error } = await supabase.from('contacts')
        .select('contact_id, custom_name, profile:contact_id(id, username, display_name, avatar_url, bio, role, status, is_online, last_seen, created_at)')
        .eq('user_id', user.id);
      if (!mounted) return;
      if (error) {
        console.warn('Vault contacts load failed:', error);
        setErrorMsg('Could not load contacts. Check your connection and try again.');
      } else {
        setContacts((data || []).map((row: any) => {
          const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
          return profile ? { ...profile, display_name: row.custom_name?.trim() || profile.display_name } as Profile : null;
        }).filter(Boolean) as Profile[]);
      }
      setLoading(false);
    };
    void loadContacts();
    return () => { mounted = false; };
  }, [user?.id]);

  const handlePinSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    if (!/^\d{4,8}$/.test(pin)) {
      setErrorMsg('PIN 4 se 8 digits ka hona chahiye.');
      return;
    }
    try {
      if (isSetup) {
        if (pin !== confirmPin) {
          setErrorMsg('PIN match nahi karta.');
          return;
        }
        const salt = makeSalt();
        const hash = await derivePinHash(pin, salt);
        localStorage.setItem(SALT_KEY, salt);
        localStorage.setItem(HASH_KEY, hash);
        setIsSetup(false);
        setIsUnlocked(true);
        setPin('');
        setConfirmPin('');
        toast('Vault PIN set ho gaya.', 'success');
        return;
      }
      const salt = localStorage.getItem(SALT_KEY);
      const expected = localStorage.getItem(HASH_KEY);
      if (!salt || !expected || await derivePinHash(pin, salt) !== expected) {
        setErrorMsg('PIN ghalat hai.');
        return;
      }
      setIsUnlocked(true);
      setPin('');
      toast('Vault unlock ho gaya.', 'success');
    } catch (error) {
      console.warn('Vault PIN setup failed:', error);
      setErrorMsg('Is browser mein secure PIN setup available nahi hai.');
    }
  };

  const toggleSecret = (contactId: string) => {
    const next = secretIds.includes(contactId) ? secretIds.filter((id) => id !== contactId) : [...secretIds, contactId];
    setSecretIds(next);
    localStorage.setItem(SECRET_CONTACTS_KEY, JSON.stringify(next));
    toast(next.includes(contactId) ? 'Contact vault list mein add ho gaya.' : 'Contact vault list se hata diya.', 'success');
  };

  const resetPin = () => {
    if (!window.confirm('Vault PIN aur is device ki vault list reset karni hai? Chats database se delete nahi hongi.')) return;
    localStorage.removeItem(SALT_KEY);
    localStorage.removeItem(HASH_KEY);
    localStorage.removeItem(SECRET_CONTACTS_KEY);
    setSecretIds([]);
    setIsSetup(true);
    setIsUnlocked(false);
    setPin('');
    setConfirmPin('');
    toast('Vault lock reset ho gaya.', 'info');
  };

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0B0F1A] text-black dark:text-white p-4 pb-24">
      <div className="max-w-xl mx-auto">
        <header className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 mb-6">
          <div className="flex items-center space-x-2">
            <button onClick={() => navigate('/chats')} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Back">←</button>
            <div><h1 className="font-black text-lg">Secret Chat Vault</h1><p className="text-[11px] text-gray-500">Device-level app lock</p></div>
          </div>
          {isUnlocked && <button onClick={() => setIsUnlocked(false)} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold">Lock</button>}
        </header>

        {!isUnlocked ? (
          <div className="max-w-sm mx-auto p-6 rounded-3xl bg-gray-50 dark:bg-[#161B2B] border border-gray-200 dark:border-gray-800 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center text-3xl">🔒</div>
            <h2 className="font-black text-base">{isSetup ? 'Set up your vault PIN' : 'Unlock your vault'}</h2>
            <p className="text-xs text-gray-500">{isSetup ? 'Apna 4–8 digit PIN set karein.' : 'Apna vault PIN enter karein.'}</p>
            {errorMsg && <p role="alert" className="text-xs text-rose-500 font-bold">{errorMsg}</p>}
            <form onSubmit={handlePinSubmit} className="space-y-3">
              <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} minLength={4} required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="PIN" className="w-full text-center tracking-[0.4em] text-xl font-black px-4 py-3 rounded-2xl bg-white dark:bg-[#1A2234] border border-gray-300 dark:border-gray-700" />
              {isSetup && <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} minLength={4} required value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Confirm PIN" className="w-full text-center tracking-[0.4em] text-xl font-black px-4 py-3 rounded-2xl bg-white dark:bg-[#1A2234] border border-gray-300 dark:border-gray-700" />}
              <button type="submit" className="w-full py-3 rounded-2xl bg-[#0E2A6E] text-white text-xs font-black">{isSetup ? 'Create PIN' : 'Unlock Vault'}</button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-100">
              <strong>Privacy note:</strong> PIN is hashed and kept on this device. This is an app-level lock and a private contact list, not end-to-end encrypted storage; messages still live in your normal Inspire chats.
            </div>
            <div className="flex items-center justify-between"><h2 className="font-black">Your secret chat list</h2><button onClick={resetPin} className="text-xs text-rose-500 font-bold">Reset PIN</button></div>
            {errorMsg && <p role="status" className="text-xs text-rose-500">{errorMsg}</p>}
            {loading ? <p className="text-sm text-gray-500 py-8 text-center">Loading contacts…</p> :
              !isConfigured ? <p className="text-sm text-gray-500">Connect Supabase to select real contacts.</p> :
              contacts.length === 0 ? <p className="text-sm text-gray-500 py-8 text-center">Pehle Chats mein contacts add karein.</p> :
              <div className="space-y-2">
                {contacts.map((contact) => {
                  const selected = secretIds.includes(contact.id);
                  return <div key={contact.id} className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 dark:border-gray-800">
                    <Avatar name={contact.display_name || contact.username || 'User'} avatarUrl={contact.avatar_url || undefined} size="md" />
                    <div className="min-w-0 flex-1"><p className="text-sm font-bold truncate">{contact.display_name || contact.username || 'User'}</p><p className="text-xs text-gray-500">@{contact.username || 'unknown'}</p></div>
                    <button onClick={() => toggleSecret(contact.id)} className={`px-3 py-2 rounded-xl text-xs font-bold ${selected ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 dark:bg-gray-800'}`}>{selected ? 'Remove' : 'Add to vault'}</button>
                    {selected && <button onClick={() => navigate(`/chat/${contact.id}`)} className="px-3 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold">Open</button>}
                  </div>;
                })}
              </div>}
          </div>
        )}
      </div>
    </div>
  );
};
