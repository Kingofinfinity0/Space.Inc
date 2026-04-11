import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, onAuthStateChange, getSession, EDGE_FUNCTION_BASE_URL } from '../lib/supabase';
import { apiService } from '../services/apiService';
import { inviteService } from '../services/inviteService';
import { useNavigate } from 'react-router-dom';

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
  
  // Refs to prevent redundant fetches
  const profileCacheRef = useRef<Record<string, any>>({});
  const capabilitiesCacheRef = useRef<boolean>(false);

  const refreshCapabilities = async () => {
    if (capabilitiesCacheRef.current) {
      console.log('[AuthContext] Capabilities already cached, skipping fetch');
      return;
    }
    
    try {
      console.log('[AuthContext] Refreshing capability lens...');
      const { data, error } = await apiService.getCapabilityLens();
      if (error) throw error;
      if (data) {
        setCapabilityCache(data);
        setUserRole(data.role);
        setOrganizationId(data.org_id);
        capabilitiesCacheRef.current = true;
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
    
    // Check cache first
    if (profileCacheRef.current[uid]) {
      console.log(`[AuthContext] Profile for ${uid} already cached, skipping fetch`);
      setProfile(profileCacheRef.current[uid]);
      return;
    }
    
    try {
      console.log(`[AuthContext] Fetching profile for ${uid}...`);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();
      
      if (error) throw error;
      setProfile(data);
      profileCacheRef.current[uid] = data;
    } catch (err) {
      console.warn('Error syncing context:', err);
      setProfile(null);
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
                await apiService.acceptInvitation(currentSession.user.app_metadata.invitation_id);
             } catch (err) {
                console.error("[AuthContext] Error accepting invitation during login:", err);
             }
          }

          // Handle pending invite tokens
          if (event === 'SIGNED_IN') {
            // First check for sessionStorage pending_invite_token (new flow)
            const pendingSessionToken = sessionStorage.getItem('pending_invite_token');
            if (pendingSessionToken) {
              console.log('[AuthContext] Found pending invite token in sessionStorage, accepting...');
              sessionStorage.removeItem('pending_invite_token');
              try {
                const result = await apiService.acceptInvitation(pendingSessionToken);
                if (result?.data?.redirect_path) {
                  window.location.href = result.data.redirect_path;
                  return;
                } else if (result?.data?.role === 'client' && result?.data?.spaceId) {
                  window.location.href = `/client/space/${result.data.spaceId}`;
                  return;
                } else {
                  console.error("[AuthContext] Failed to accept invitation from sessionStorage");
                }
              } catch (err) {
                console.error('[AuthContext] Error accepting invitation from sessionStorage:', err);
              }
            }

            // Post-auth redirect for client users only
            if (profile?.role === 'client') {
              if (!window.location.pathname.startsWith('/spaces/')) {
                try {
                  const { data: { user }, error: authError } = await supabase.auth.getUser();

                  if (authError || !user) {
                    window.location.href = '/login?error=session_expired';
                    return;
                  }

                  const { data, error: membershipError } = await supabase
                    .from('space_memberships')
                    .select('space_id')
                    .eq('profile_id', user.id)
                    .eq('status', 'active')
                    .single();

                  if (membershipError || !data?.space_id) {
                    window.location.href = '/spaces/pending';
                    return;
                  }

                  window.location.href = `/spaces/${data.space_id}`;
                  return;
                } catch (err) {
                  console.error('[AuthContext] Unexpected error in post-auth redirect:', err);
                  window.location.href = '/spaces/pending';
                  return;
                }
              }
            }

            // Then check for legacy pending_invite_token format
            const pending = inviteService.getAndClearPendingToken();
            if (pending) {
              const { token, type } = pending;
              console.log(`[AuthContext] Found pending ${type} invite token, accepting...`);
              try {
                if (type === 'space') {
                  const result = await inviteService.acceptSpaceInvite(token, currentSession.access_token);
                  if (result.success && result.data) {
                    window.location.href = result.data.redirect_path;
                    return;
                  } else {
                    console.error("[AuthContext] Failed to accept space invite:", (result as any).error_code);
                  }
                } else if (type === 'email') {
                  const result = await inviteService.acceptEmailInvite(token, currentSession.access_token);
                  if (result.success && result.data) {
                    window.location.href = result.data.redirect_path;
                    return;
                  } else {
                    console.error("[AuthContext] Failed to accept email invite:", (result as any).error_code);
                  }
                }
              } catch (err) {
                console.error(`[AuthContext] Error accepting ${type} invite:`, err);
              }
            }

            // Check for pending_space_token (from /join/:token flow)
            const pendingSpaceToken = localStorage.getItem('pending_space_token');
            if (pendingSpaceToken) {
              console.log('[AuthContext] Found pending_space_token, calling accept_space_link...');
              try {
                const res = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentSession.access_token}`
                  },
                  body: JSON.stringify({
                    action: 'accept_space_link',
                    token: pendingSpaceToken
                  })
                });

                const result = await res.json();
                localStorage.removeItem('pending_space_token');

                if (result.data?.success && result.data?.data?.spaceId) {
                  // Redirect to the space-specific path, never to /dashboard
                  window.location.href = `/spaces/${result.data.data.spaceId}`;
                  return;
                } else {
                  console.error('[AuthContext] accept_space_link failed:', result);
                }
              } catch (err) {
                console.error('[AuthContext] Error calling accept_space_link:', err);
                localStorage.removeItem('pending_space_token');
              }
            }
          }

          try {
            await Promise.all([
              fetchProfile(currentSession.user.id),
              refreshCapabilities()
            ]);
          } catch (e) {
            console.error('[AuthContext] Post-auth data fetch failed:', e);
          } finally {
            setLoading(false);
          }
        }
      } else {
        setUser(null);
        setSession(null);
        setProfile(null);
        setCapabilities([]);
        setCapabilityCache(null);
        setUserRole(null);
        setOrganizationId(null);
        // Clear caches on sign out
        profileCacheRef.current = {};
        capabilitiesCacheRef.current = false;
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
