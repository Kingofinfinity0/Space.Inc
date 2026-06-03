import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, onAuthStateChange } from '../lib/supabase';
import { apiService } from '../services/apiService';
import { UserContext, ContextsResponse } from '../types/context';
import { isOrganizationRole, normalizeWorkspaceRole } from '../lib/workspaceRoles';
import {
  getActivationTarget,
  getActiveSnapshotContext,
  getAutoRouteTarget,
  getContextReadinessDecision,
  isContextAvailable,
} from '../lib/contextReadiness';

type AuthContextType = {
  user: User | null;
  profile: any;
  session: Session | null;
  contexts: ContextsResponse | null;
  activeContext: UserContext | null;
  setActiveContext: (context: UserContext | null) => void;
  refreshContexts: () => Promise<ContextsResponse | null>;
  refreshProfile: () => Promise<void>;
  capabilities: string[];
  capabilityCache: any;
  userRole: string | null;
  organizationId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: any }>;
  signUp: (email: string, password: string, userData: any, options?: { emailRedirectTo?: string }) => Promise<{ error: any }>;
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
    capabilitiesCacheRef.current = false;
    _setActiveContext(context);
    if (context) {
      setUserRole(normalizeWorkspaceRole(context.context_role));
    } else {
      setUserRole(null);
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
      let response = await apiService.getMyContexts();
      let decision = getContextReadinessDecision(response);

      if (decision.kind === 'activation_required') {
        const target = getActivationTarget(response);
        if (target) {
          const activation = await apiService.activateMembershipContext(target.context_type, target.context_id);
          if (!activation.success) {
            throw new Error(`Failed to activate membership context: ${activation.error_code || 'UNKNOWN_ERROR'}`);
          }

          capabilitiesCacheRef.current = false;
          response = await apiService.getMyContexts();
          decision = getContextReadinessDecision(response);
        }
      }

      setContexts(response);

      const autoRouteTarget = getAutoRouteTarget(response);
      const activeSnapshotTarget = getActiveSnapshotContext(response);
      if (autoRouteTarget) {
        setActiveContext(autoRouteTarget);
      } else if (activeSnapshotTarget) {
        setActiveContext(activeSnapshotTarget);
      } else if (decision.kind === 'switcher_required' && isContextAvailable(activeContext, response)) {
        setActiveContext(activeContext);
      } else if (decision.kind === 'no_contexts' || decision.kind === 'activation_required') {
        setActiveContext(null);
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
        setUserRole(normalizeWorkspaceRole(data.role || activeContext?.context_role));
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
      if (isOrganizationRole(userRole)) return true;
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
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (error) throw error;
      if (!data) {
        setProfile(null);
        return;
      }
      setProfile(data);
      profileCacheRef.current[uid] = data;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Error fetching profile:', err);
      }
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (!user?.id) return;
    delete profileCacheRef.current[user.id];
    await fetchProfile(user.id);
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
            refreshContexts()
          ]);
          await refreshCapabilities();
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
          try {
            await Promise.all([
              fetchProfile(currentSession.user.id),
              refreshContexts()
            ]);
            await refreshCapabilities();
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

  const signUp = async (email: string, password: string, metadata: any, signUpOptions?: { emailRedirectTo?: string }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: signUpOptions?.emailRedirectTo,
      }
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
    refreshProfile,
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

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const shouldRenderWhileLoading =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/invite' ||
    pathname.startsWith('/invite/') ||
    pathname === '/join' ||
    pathname.startsWith('/join/');

  return (
    <AuthContext.Provider value={value}>
      {(!loading || shouldRenderWhileLoading) && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
