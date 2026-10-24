import { createClient, SupabaseClient } from '@supabase/supabase-js';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

function isValidSupabaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' &&
      parsed.hostname.endsWith('.supabase.co') &&
      !parsed.hostname.includes('demo-project');
  } catch {
    return false;
  }
}

/**
 * Missing environment configuration must never silently connect to a demo project.
 * The reserved .invalid host is deliberately non-routable and only lets the app
 * render its setup warning while auth/data operations fail closed.
 */
export const isConfigured = Boolean(isValidSupabaseUrl(configuredUrl) && configuredAnonKey.length > 0);
const supabaseUrl = isConfigured ? configuredUrl : 'https://missing-supabase-config.invalid';
const supabaseAnonKey = isConfigured ? configuredAnonKey : 'missing-config-placeholder';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 10 } },
});
