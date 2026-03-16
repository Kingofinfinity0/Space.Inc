import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface DashboardData {
  user: User | null;
  stats: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
  } | null;
}

interface DashboardContextType {
  data: DashboardData;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  clearCache: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData>({ user: null, stats: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      
      if (user) {
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select('status');
          
        if (projectsError) throw projectsError;
        
        const stats = {
          totalProjects: projects?.length || 0,
          activeProjects: projects?.filter(p => p.status === 'active').length || 0,
          completedProjects: projects?.filter(p => p.status === 'completed').length || 0,
        };
        
        setData({ user, stats });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const clearCache = () => {
    setData({ user: null, stats: null });
    setError(null);
  };

  const refreshData = async () => {
    await fetchDashboardData();
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <DashboardContext.Provider value={{ data, loading, error, refreshData, clearCache }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
