import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, onAuthStateChange, getSession } from '../lib/supabase';
import { apiService } from '../services/apiService';

type AuthContextType = {
  user: User | null;
  profile: any;
  session: any;
  capabilities: string[];
  capabilityCache: any;
  userRole: string | null;
  organizationId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: any }>;
  signUp: (email: string, password: string, userData: any) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  refreshCapabilities: () => Promise<void>;
  can: (capability: string, spaceId?: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [capabilityCache, setCapabilityCache] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshCapabilities = async () => {
    try {
      console.log('[AuthContext] Refreshing capability lens...');
      const { data, error } = await apiService.getCapabilityLens();
      if (error) throw error;
      if (data) {
        setCapabilityCache(data);
        setUserRole(data.role);
        setOrganizationId(data.org_id);
        // Sync legacy capabilities array for backward compatibility
        // (Collecting all unique capability keys from assigned spaces)
        const allCaps = new Set<string>();
        if (data.role === 'owner' || data.role === 'admin') {
          // Add global role identifiers if needed
          allCaps.add(data.role);
          // For owners/admins, we typically grant everything globally in the UI DSL
          ['can_view_dashboard', 'can_view_history', 'can_view_all_spaces', 'can_manage_team', 'can_view_tasks', 'can_view_meetings', 'can_view_files', 'can_view_settings'].forEach(c => allCaps.add(c));
        } else if (data.role === 'staff') {
           // Staff caps are usually per-space, but let's aggregate for the legacy array
           data.assigned_spaces?.forEach((s: any) => {
             Object.entries(s.capabilities).forEach(([key, val]) => {
               if (val) allCaps.add(key.startsWith('can_') ? key : `can_${key}`);
             });
           });
           allCaps.add('can_view_dashboard'); // Staff always see dashboard
        } else if (data.role === 'client') {
          allCaps.add('is_client_portal');
        }
        setCapabilities(Array.from(allCaps));
      }
    } catch (err) {
      console.error('[AuthContext] Error fetching capabilities:', err);
    }
  };

  const can = (capability: string, spaceId?: string): boolean => {
    if (!capabilityCache) return false;
    
    // Global check
    if (!spaceId) {
      // Identity-first override: Owners/Admins have high-level access
      if (userRole === 'owner' || userRole === 'admin') return true;
      if (userRole === 'client' && capability === 'is_client_portal') return true;
      if (userRole === 'staff' && capability === 'can_view_dashboard') return true;
      
      // Check legacy aggregated capabilities if needed, or fallback to cache logic
      return capabilities.includes(capability);
    }

    // Space-specific check
    const space = capabilityCache.assigned_spaces?.find((s: any) => s.space_id === spaceId);
    if (!space) return false;

    // Direct lookup in the space capabilities object
    // Handle both 'can_view' and 'view' formats if needed
    const capKey = capability.startsWith('can_') ? capability : `can_${capability}`;
    const shortCapKey = capability.startsWith('can_') ? capability.replace('can_', '') : capability;
    
    return !!(space.capabilities[capKey] || space.capabilities[shortCapKey]);
  };

  const fetchProfile = async (uid: string) => {
    if (!uid) return;
    try {
      console.log(`[AuthContext] Fetching profile for ${uid}...`);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();
      
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.warn('Error syncing context:', err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session: supSession } } = await supabase.auth.getSession();
        if (supSession) {
          setUser(supSession.user);
          setSession(supSession);
          await Promise.all([
            fetchProfile(supSession.user.id),
            refreshCapabilities()
          ]);
        }
      } catch (e) {
        console.error("Auth init failed", e);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = onAuthStateChange(async (event, currentSession) => {
      console.log(`[AuthContext] Auth event: ${event}`);

      if (currentSession) {
        const isNewUser = user?.id !== currentSession.user.id;
        setUser(currentSession.user);
        setSession(currentSession);

        if (isNewUser || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          if (event === 'SIGNED_IN' && currentSession.user.app_metadata?.invitation_id) {
             console.log("[AuthContext] Found invitation in app_metadata, completing join...");
             try {
                // apiService.acceptInvitation uses the token, but invitation_id might be stored in metadata.
                // Assuming acceptInvitation handles the joining logic.
                await apiService.acceptInvitation(currentSession.user.app_metadata.invitation_id);
             } catch (err) {
                console.error("[AuthContext] Error accepting invitation during login:", err);
             }
          }

          await Promise.all([
            fetchProfile(currentSession.user.id),
            refreshCapabilities()
          ]);
        }
      } else {
        setUser(null);
        setSession(null);
        setProfile(null);
        setCapabilities([]);
        setCapabilityCache(null);
        setUserRole(null);
        setOrganizationId(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]); // Added dependency to prevent stale checks during re-logins

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return { error: null };
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });
      return { error };
    } catch (err: any) {
      console.error('Sign up error:', err);
      return { error: err };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const value = {
    user,
    profile,
    session,
    capabilities,
    capabilityCache,
    userRole,
    organizationId,
    loading,
    signIn,
    signInWithOAuth,
    signUp,
    signOut,
    refreshCapabilities,
    can
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
