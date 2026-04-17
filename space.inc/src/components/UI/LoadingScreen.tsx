import React, { useEffect, useState } from 'react';
import { Rocket } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading workspace...' }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 10;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white font-sans">
      <div className="relative mb-8">
        <div className="h-20 w-20 bg-black rounded-[8px] flex items-center justify-center text-white shadow-none animate-pulse">
          <Rocket size={40} />
        </div>
        <div className="absolute -bottom-2 -right-2 h-6 w-6 bg-[#6E6E80] rounded-full border-4 border-white animate-pulse" />
      </div>

      <div className="w-64 space-y-4">
        <div className="flex justify-between items-end">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">{message}</p>
          <p className="text-[10px] font-semibold text-[#0D0D0D]">{Math.round(progress)}%</p>
        </div>

        <div className="h-1.5 w-full bg-[#F7F7F8] rounded-full overflow-hidden border border-[#E5E5E5]">
          <div
            className="h-full bg-black transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="mt-12 text-[10px] font-semibold text-[#6E6E80] uppercase tracking-widest animate-pulse">
        Initializing workspace
      </p>
    </div>
  );
};

export default LoadingScreen;
