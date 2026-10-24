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
  signUp: (email: string, password: string) => Promise<{ error: Error | null; needsEmailVerification?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  setDemoUser: (userType: 'user' | 'admin' | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Deterministic mock seed users for offline / verification testing
export const DEMO_PROFILES: Record<string, Profile> = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'alex_dev',
    display_name: 'Alex Rivera',
    bio: 'Building cool things with real-time tech 🚀',
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
    display_name: 'Sarah Chen (Admin)',
    bio: 'Inspire Platform Security & Operations 🛡️',
    avatar_url: null,
    role: 'admin',
    status: 'active',
    is_online: true,
    last_seen: new Date().toISOString(),
    created_at: '2025-11-01T10:00:00Z',
  },
  unonboarded: {
    id: '22222222-2222-4222-8222-222222222222',
    username: null,
    display_name: 'New Explorer',
    bio: null,
    avatar_url: null,
    role: 'user',
    status: 'active',
    is_online: true,
    last_seen: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<Profile | null>(() => {
    if (localStorage.getItem('inspire_logged_out') === 'true') {
      return null;
    }
    // Check local storage for persistent demo/cached profile
    const saved = localStorage.getItem('inspire_active_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    // Default to the authenticated user for instant preview if not configured
    return !isConfigured ? DEMO_PROFILES.user : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync user changes to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('inspire_active_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('inspire_active_user');
    }
  }, [user]);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!isConfigured) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching profile from Supabase:', error);
      } else if (data) {
        setUser(data as Profile);
      }
    } catch (err) {
      console.warn('Profile fetch exception:', err);
    }
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = async (email: string, password: string) => {
    if (!isConfigured) {
      // Offline/local demo signup simulation
      const newProf: Profile = {
        id: `usr_${Date.now()}`,
        username: null,
        display_name: email.split('@')[0],
        bio: '',
        avatar_url: null,
        role: 'user',
        status: 'active',
        is_online: true,
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setUser(newProf);
      return { error: null, needsEmailVerification: false };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) return { error };
      const needsEmailVerification = !data.session;
      return { error: null, needsEmailVerification };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isConfigured) {
      // Check admin login convention
      if (email.includes('admin')) {
        setUser(DEMO_PROFILES.admin);
      } else {
        setUser(DEMO_PROFILES.user);
      }
      return { error: null };
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
    if (!user) return { error: new Error('No user logged in') };

    const updated = { ...user, ...updates };
    setUser(updated);

    if (isConfigured) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);
        if (error) return { error };
      } catch (err) {
        return { error: err as Error };
      }
    }

    return { error: null };
  };

  const setDemoUser = (userType: 'user' | 'admin' | null) => {
    if (!userType) {
      setUser(null);
      localStorage.setItem('inspire_logged_out', 'true');
    } else {
      localStorage.removeItem('inspire_logged_out');
      setUser(DEMO_PROFILES[userType]);
    }
  };

  const isAuthenticated = Boolean(user);
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        isAuthenticated,
        isAdmin,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        updateProfile,
        setDemoUser,
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
