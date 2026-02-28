import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, onAuthStateChange, getSession } from '../lib/supabase';
import { apiService } from '../services/apiService';

type AuthContextType = {
  user: User | null;
  profile: any;
  session: any;
  capabilities: string[];
  assignedSpaceIds: string[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: any }>;
  signUp: (email: string, password: string, userData: any) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [assignedSpaceIds, setAssignedSpaceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isTokenExpired = (token: string) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Buffer of 30 seconds to be safe
      return (payload.exp * 1000) < (Date.now() + 30000);
    } catch (e) {
      return true;
    }
  };

  const fetchProfile = async (uid: string) => {
    if (!uid) return;
    try {
      // Fetch Lens (Phase 15 - Backend defined capabilities)
      console.log(`[AuthContext] Fetching capability lens...`);
      const { data: lens } = await apiService.getCapabilityLens();
      if (lens) {
        setCapabilities(lens.capabilities || []);
        setAssignedSpaceIds(lens.assigned_space_ids || []);
      }

      // guard: don't refetch profile if we already have it for this user
      if (profile?.id === uid) return;

      console.log(`[AuthContext] Fetching profile for ${uid}...`);
      const { data, error } = await apiService.getProfile();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.warn('Error fetching capability lens/profile:', err);
    }
  };

  const setCustomSession = async (newSession: any, skipProfile: boolean = false) => {
    if (!newSession) {
      localStorage.removeItem('space_session');
      setSession(null);
      setUser(null);
      setProfile(null);
      return;
    }

    // Optimization: Only update state/storage if different
    const currentStored = localStorage.getItem('space_session');
    const newSessionStr = JSON.stringify(newSession);
    if (currentStored !== newSessionStr) {
      localStorage.setItem('space_session', newSessionStr);
    }

    if (session?.access_token !== newSession.access_token) {
      setSession(newSession);
      setUser(newSession.user);
    }

    // Try to sync with Supabase for RLS
    try {
      const { data: { session: currentSupSession } } = await supabase.auth.getSession();
      if (currentSupSession?.access_token !== newSession.access_token) {
        if (newSession.access_token && newSession.refresh_token) {
          await supabase.auth.setSession({
            access_token: newSession.access_token,
            refresh_token: newSession.refresh_token
          });
          console.log("[AuthContext] Supabase Client synced");
        }
      }
    } catch (e) {
      console.debug("Supabase Client sync skipped or failed", e);
    }

    if (!skipProfile) {
      await fetchProfile(newSession.user.id);
    }
  };

  useEffect(() => {
    // 1. Robust Initialization Flow (Phase 10)
    const initAuth = async () => {
      try {
        const stored = localStorage.getItem('space_session');
        let activeSession = null;

        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.access_token && isTokenExpired(parsed.access_token)) {
            console.log("[AuthContext] Stored session expired, attempting early refresh...");
            if (parsed.refresh_token && parsed.session_id) {
              const { data, error } = await apiService.refreshToken(parsed.session_id, parsed.refresh_token);
              if (data?.session) {
                activeSession = data.session;
                console.log("[AuthContext] Early refresh successful");
              }
            }
          } else {
            activeSession = parsed;
          }
        }

        // If no valid stored session, check native Supabase
        if (!activeSession) {
          const { data: { session: supSession } } = await supabase.auth.getSession();
          if (supSession) {
            if (isTokenExpired(supSession.access_token)) {
              console.log("[AuthContext] Native session expired, refreshing...");
              const { data } = await supabase.auth.refreshSession();
              activeSession = data.session;
            } else {
              activeSession = supSession;
            }
          }
        }

        if (activeSession) {
          await setCustomSession(activeSession);
        } else {
          localStorage.removeItem('space_session');
        }
      } catch (e) {
        console.error("Auth init failed", e);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 2. Listen for Supabase changes (Legacy/OAuth Exchange)
    const { data: { subscription } } = onAuthStateChange(async (event, currentSession) => {
      console.log(`[AuthContext] Auth event: ${event}`);

      if (event === 'SIGNED_IN' && currentSession) {
        const custom = localStorage.getItem('space_session');
        if (!custom) {
          // If signed in via Supabase (likely OAuth) but no custom session, exchange it
          console.log("[AuthContext] Supabase SIGNED_IN detected, upgrading to custom session...");
          try {
            // We use the Supabase access token as the 'idToken' for auth-api
            // auth-api will need to be updated to handle Supabase-issued tokens as well,
            // or we extract the provider-specific token if available.
            const provider = (currentSession.user as any).app_metadata?.provider || 'google';
            const { data, error } = await apiService.exchangeOAuth(provider, currentSession.access_token);

            if (data?.session) {
              await setCustomSession(data.session);
              console.log("[AuthContext] Successful OAuth upgrade");
            } else if (error) {
              console.error("[AuthContext] OAuth upgrade failed:", error);
            }
          } catch (e) {
            console.error("[AuthContext] Error in OAuth upgrade:", e);
          }
        }
      }

      if (event === 'SIGNED_OUT') {
        // Handle global sign-out if needed
      }
    });

    // 3. Refresh Interval (every 5 mins)
    const refreshInterval = setInterval(async () => {
      // 1. Check native Supabase session first
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (currentSession) {
        // If native session exists, ensure it's fresh
        const expiresAt = (JSON.parse(atob(currentSession.access_token.split('.')[1])).exp * 1000);
        if (expiresAt - Date.now() < 10 * 60 * 1000) { // 10 mins before expiry
          console.log("[AuthContext] Native session near expiry, refreshing...");
          const { data } = await supabase.auth.refreshSession();
          if (data.session) await setCustomSession(data.session);
        }
      } else {
        // Fallback to custom logic for non-native sessions
        const stored = localStorage.getItem('space_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.refresh_token && parsed.session_id) {
            const { data, error } = await apiService.refreshToken(parsed.session_id, parsed.refresh_token);
            if (data?.session) {
              await setCustomSession(data.session);
              console.log("Custom session refreshed automatically");
            }
          }
        }
      }
    }, 5 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await apiService.auth({
        action: 'login',
        email,
        password
      });

      if (error) throw error;
      if (data.success === false) throw new Error(data.message || 'Login failed');

      const { session } = data.data;
      if (session) {
        await setCustomSession(session);
        return { error: null };
      }

      return { error: new Error("No session returned") };
    } catch (err: any) {
      console.error('Sign in error:', err);
      return { error: err };
    }
  };


  const signInWithOAuth = async (provider: 'google' | 'github') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      return { error };
    } catch (err: any) {
      console.error('OAuth sign in error:', err);
      return { error: err };
    }
  };

  const signUp = async (email: string, password: string, metadata: any) => {
    try {
      const { data, error } = await apiService.auth({
        action: 'signup',
        email,
        password,
        ...metadata
      });

      if (error) throw error;
      if (data.success === false) throw new Error(data.message || 'Signup failed');

      const { session } = data.data || {};
      if (session) {
        await setCustomSession(session);
        return { error: null };
      }

      return await signIn(email, password);

    } catch (err: any) {
      console.error('Sign up error:', err);
      return { error: err };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut(); // Best effort
    await apiService.logout(); // Call auth-api logout
    await setCustomSession(null);
    return { error };
  };

  const value = {
    user,
    profile,
    session,
    capabilities,
    assignedSpaceIds,
    loading,
    signIn,
    signInWithOAuth,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
