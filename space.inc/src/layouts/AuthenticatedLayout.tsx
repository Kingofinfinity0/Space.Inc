import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/UI';
import { VeroMark } from '../components/brand/VeroLogo';

export const AuthenticatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 p-4 border-r border-gray-800 flex flex-col">
        <button 
          onClick={() => navigate('/')}
          className="mb-8 text-left hover:opacity-80 transition-opacity"
          aria-label="Go to home page"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white text-black">
              <VeroMark className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-emerald-400">Vero</h1>
              <p className="text-sm text-gray-400">Client Portal</p>
            </div>
          </div>
        </button>
        
        <div className="flex-1">
          {/* Navigation links will go here */}
        </div>
        
        <div className="mt-auto pt-4 border-t border-gray-800">
          <Button
            onClick={signOut}
            variant="ghost"
            className="w-full justify-start text-red-400 hover:bg-red-900/20 hover:text-red-300"
          >
            Sign Out
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
};
