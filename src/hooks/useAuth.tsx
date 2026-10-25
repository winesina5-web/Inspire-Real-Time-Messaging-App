import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, isConfigured } from '../lib/supabaseClient';
import { Profile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuspended: boolean;
  isSupabaseConfigured: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; needsEmailVerification?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  enableDevDemoMode: (role?: 'user' | 'admin') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Dev-only preview profiles (only permitted when import.meta.env.DEV is true)
export const DEV_PREVIEW_PROFILES: Record<string, Profile> = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'alex_dev',
    display_name: 'Alex Rivera',
    bio: 'Building with real-time tech on Inspire 🚀',
    avatar_url: null,
    role: 'user',
    status: 'active',
    is_online: true,
    last_seen: new Date().toISOString(),
    created_at: '2026-01-10T08:00:00Z',
  },
  admin: {
    id: '99999999-9999-4999-8999-999999999999',
    username: 'inspire_admin',
    display_name: 'Sarah Chen (Platform Admin)',
    bio: 'Inspire Platform Security & Operations 🛡️',
    avatar_url: null,
    role: 'admin',
    status: 'active',
    is_online: true,
    last_seen: new Date().toISOString(),
    created_at: '2025-11-01T10:00:00Z',
  },
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<Profile | null>(() => {
    // Only check local storage if explicitly saved during active development session
    if (localStorage.getItem('inspire_logged_out') === 'true') {
      return null;
    }
    const saved = localStorage.getItem('inspire_active_user');
    if (saved && isConfigured) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync user changes to localStorage only when authenticating
  useEffect(() => {
    if (user && isConfigured) {
      localStorage.setItem('inspire_active_user', JSON.stringify(user));
    } else if (!user) {
      localStorage.removeItem('inspire_active_user');
    }
  }, [user]);

  /**
   * Fetches the user profile with exponential retry to account for trigger latency on signup
   */
  const fetchProfile = useCallback(async (userId: string, retries = 3): Promise<Profile | null> => {
    if (!isConfigured) return null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.warn('Profile fetch warning:', error.message);
        } else if (data) {
          const profile = data as Profile;
          setUser(profile);
          return profile;
        }

        // Wait before retry if database trigger is still writing row
        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        }
      } catch (err) {
        console.warn('Profile fetch exception:', err);
      }
    }
    return null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  }, [session, fetchProfile]);

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        await fetchProfile(newSession.user.id);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = async (email: string, password: string) => {
    if (!isConfigured) {
      return {
        error: new Error('Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'),
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) return { error };

      const needsEmailVerification = !data.session;
      if (data.user && data.session) {
        await fetchProfile(data.user.id);
      }

      return { error: null, needsEmailVerification };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isConfigured) {
      return {
        error: new Error('Supabase connection is not configured in .env. Real authentication requires Supabase.'),
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error };

      if (data.session?.user) {
        await fetchProfile(data.session.user.id);
      }
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    if (isConfigured) {
      await supabase.auth.signOut().catch(() => {});
    }
    setSession(null);
    setUser(null);
    localStorage.removeItem('inspire_active_user');
    localStorage.setItem('inspire_logged_out', 'true');
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No authenticated user session.') };

    // Prevent non-admin client from modifying security role or status directly
    if (updates.role && updates.role !== user.role && user.role !== 'admin') {
      return { error: new Error('Unauthorized role modification attempt.') };
    }

    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select('*')
          .maybeSingle();
        if (error) return { error };
        if (!data) return { error: new Error('Profile was not updated. Check your profile permissions and try again.') };
        setUser({ ...user, ...data } as Profile);
      } catch (err) {
        return { error: err as Error };
      }
    } else {
      setUser({ ...user, ...updates });
    }

    return { error: null };
  };

  const enableDevDemoMode = (role: 'user' | 'admin' = 'user') => {
    // Only allowed in development environment
    if (import.meta.env.DEV) {
      localStorage.removeItem('inspire_logged_out');
      setUser(DEV_PREVIEW_PROFILES[role]);
    }
  };

  const isAuthenticated = Boolean(user);
  // Real authorization: role must strictly equal 'admin' from database profile
  const isAdmin = user?.role === 'admin';
  const isSuspended = user?.status === 'suspended';

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        isAuthenticated,
        isAdmin,
        isSuspended,
        isSupabaseConfigured: isConfigured,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        updateProfile,
        enableDevDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
