import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, onAuthStateChange, getSession } from '../lib/supabase';

type AuthContextType = {
  user: User | null;
  session: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; success: boolean }>;
  signUp: (email: string, password: string, userData: any) => Promise<{ error: any; success: boolean }>;
  signOut: () => Promise<{ error: any; success: boolean }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error getting initial session:', error);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // Validate environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Frontend configuration error: Missing environment variables');
      }

      const response = await fetch(`https://qkpjmsorzkdnebcckqts.supabase.co/functions/v1/auth-handler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          action: 'signin',
          email,
          password
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('Sign in error:', result.error);
        return { error: result.error, success: false };
      }
      
      console.log('Sign in successful:', result.data);
      
      // Update local state with session data
      if (result.data.session) {
        setSession(result.data.session);
        setUser(result.data.user);
      }
      
      return { error: null, success: true };
    } catch (err) {
      console.error('Unexpected sign in error:', err);
      return { error: err, success: false };
    }
  };

  const signUp = async (email: string, password: string, userData: any) => {
    try {
      // Validate environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Frontend configuration error: Missing environment variables');
      }

      const response = await fetch(`https://qkpjmsorzkdnebcckqts.supabase.co/functions/v1/auth-handler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          action: 'signup',
          email,
          password,
          userData
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('Sign up error:', result.error);
        return { error: result.error, success: false };
      }
      
      console.log('Sign up successful:', result.data);
      
      // Update local state with session data
      if (result.data.session) {
        setSession(result.data.session);
        setUser(result.data.user);
      }
      
      return { error: null, success: true };
    } catch (err) {
      console.error('Unexpected sign up error:', err);
      return { error: err, success: false };
    }
  };

  const signOut = async () => {
    try {
      // Always clear local state first, regardless of API call success
      const sessionToClear = session;
      setSession(null);
      setUser(null);

      // Try to call edge function, but don't fail if it doesn't work
      try {
        const response = await fetch(`https://qkpjmsorzkdnebcckqts.supabase.co/functions/v1/auth-handler`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToClear?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            action: 'signout'
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          console.warn('Sign out API call failed:', result.error);
          // Don't return error since local state is already cleared
        } else {
          console.log('Sign out successful');
        }
      } catch (apiError) {
        console.warn('Sign out API call failed:', apiError);
        // Don't return error since local state is already cleared
      }
      
      return { error: null, success: true };
    } catch (err) {
      console.error('Unexpected sign out error:', err);
      // Even on unexpected error, return success since local state is cleared
      return { error: null, success: true };
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
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
