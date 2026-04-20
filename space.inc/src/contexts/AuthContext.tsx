import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, onAuthStateChange } from '../lib/supabase';
import { apiService } from '../services/apiService';
import { inviteService } from '../services/inviteService';
import { UserContext, ContextsResponse } from '../types/context';

type AuthContextType = {
  user: User | null;
  profile: any;
  session: Session | null;
  contexts: ContextsResponse | null;
  activeContext: UserContext | null;
  setActiveContext: (context: UserContext | null) => void;
  refreshContexts: () => Promise<ContextsResponse | null>;
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Multi-context state
  const [contexts, setContexts] = useState<ContextsResponse | null>(null);
  const [activeContext, _setActiveContext] = useState<UserContext | null>(null);

  const setActiveContext = (context: UserContext | null) => {
    _setActiveContext(context);
    if (context) {
      setUserRole(context.context_role);
    }
  };

  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [capabilityCache, setCapabilityCache] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  // Refs to prevent redundant fetches
  const profileCacheRef = useRef<Record<string, any>>({});
  const capabilitiesCacheRef = useRef<boolean>(false);

  const refreshContexts = async () => {
    try {
      const response = await apiService.getMyContexts();
      setContexts(response);

      // Auto-select context if applicable
      if (response.routing === 'auto_org' && response.org_contexts.length === 1) {
        const ctx = response.org_contexts[0];
        setActiveContext(ctx);
        setUserRole(ctx.context_role);
      } else if (response.routing === 'auto_client' && response.client_contexts.length === 1) {
        const ctx = response.client_contexts[0];
        setActiveContext(ctx);
        setUserRole(ctx.context_role);
      }
      return response;
    } catch (err) {
      console.error('[AuthContext] Error fetching contexts:', err);
      return null;
    }
  };

  const refreshCapabilities = async () => {
    if (capabilitiesCacheRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AuthContext] Capabilities already cached, skipping fetch');
      }
      return;
    }
    
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AuthContext] Refreshing capability lens...');
      }
      const { data, error } = await apiService.getCapabilityLens();
      if (error) throw error;
      if (data) {
        setCapabilityCache(data);
        // Sync userRole with activeContext if available
        if (activeContext) {
          setUserRole(activeContext.context_role);
        } else {
          setUserRole(data.role);
        }
        setOrganizationId(data.org_id);
        capabilitiesCacheRef.current = true;

        const allCaps = new Set<string>();
        if (data.role === 'owner' || data.role === 'admin') {
          allCaps.add(data.role);
          ['can_view_dashboard', 'can_view_history', 'can_view_all_spaces', 'can_manage_team', 'can_view_tasks', 'can_view_meetings', 'can_view_files', 'can_view_settings'].forEach(c => allCaps.add(c));
        } else if (data.role === 'staff') {
           data.assigned_spaces?.forEach((s: any) => {
             Object.entries(s.capabilities).forEach(([key, val]) => {
               if (val) allCaps.add(key.startsWith('can_') ? key : `can_${key}`);
             });
           });
           allCaps.add('can_view_dashboard');
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
    if (!spaceId) {
      if (userRole === 'owner' || userRole === 'admin') return true;
      if (userRole === 'client' && capability === 'is_client_portal') return true;
      if (userRole === 'staff' && capability === 'can_view_dashboard') return true;
      return capabilities.includes(capability);
    }
    const space = capabilityCache.assigned_spaces?.find((s: any) => s.space_id === spaceId);
    if (!space) return false;
    const capKey = capability.startsWith('can_') ? capability.slice(4) : capability;
    return !!space.capabilities[capKey];
  };

  const fetchProfile = async (uid: string) => {
    if (profileCacheRef.current[uid]) {
      setProfile(profileCacheRef.current[uid]);
      return;
    }
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
      if (error) throw error;
      setProfile(data);
      profileCacheRef.current[uid] = data;
    } catch (err) {
      console.warn('Error fetching profile:', err);
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
            refreshContexts(),
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
      if (currentSession) {
        const isNewUser = user?.id !== currentSession.user.id;
        setUser(currentSession.user);
        setSession(currentSession);
        profileCacheRef.current = {};
        capabilitiesCacheRef.current = false;

        if (isNewUser || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          // Handle pending invites
          if (event === 'SIGNED_IN') {
            const pendingInviteToken = inviteService.getAndClearPendingToken()?.token;
            if (pendingInviteToken) {
              try {
                const resolvedInvite = await inviteService.resolveInviteToken(pendingInviteToken);
                const acceptedInvite = await inviteService.acceptResolvedInvite(
                  resolvedInvite,
                  currentSession.access_token,
                  {
                    clientName:
                      profile?.full_name ||
                      currentSession.user.user_metadata?.full_name ||
                      currentSession.user.email?.split('@')[0] ||
                      undefined,
                    clientCompany:
                      profile?.company ||
                      currentSession.user.user_metadata?.company ||
                      null,
                  }
                );

                if (acceptedInvite?.redirect_path) {
                  window.location.href = acceptedInvite.redirect_path;
                  return;
                }
              } catch (err) {
                console.error('Error accepting invitation:', err);
              }
            }
          }

          try {
            await Promise.all([
              fetchProfile(currentSession.user.id),
              refreshContexts(),
              refreshCapabilities()
            ]);
          } catch (e) {
            console.error('Post-auth data fetch failed:', e);
          } finally {
            setLoading(false);
          }
        }
      } else {
        setUser(null);
        setSession(null);
        setProfile(null);
        setContexts(null);
        setActiveContext(null);
        setCapabilities([]);
        setCapabilityCache(null);
        setUserRole(null);
        setOrganizationId(null);
        profileCacheRef.current = {};
        capabilitiesCacheRef.current = false;
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithOAuth = async (provider: 'google' | 'github') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    });
    return { error };
  };

  const signUp = async (email: string, password: string, metadata: any) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const value = {
    user,
    profile,
    session,
    contexts,
    activeContext,
    setActiveContext,
    refreshContexts,
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
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
