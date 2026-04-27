import React, { useEffect, useMemo, useState } from 'react';
import { Rocket, Sparkles } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading workspace...' }) => {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  const tips = useMemo(() => ([
    'Use the space view to keep work, messages, and files together.',
    'Owners should keep analytics clean by using consistent task groups.',
    'Staff can only work well when permissions match the workflow.',
    'Clients should see a focused portal, not the entire workspace.',
  ]), []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 10;
      });
    }, 200);

    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 2800);

    return () => {
      clearInterval(interval);
      clearInterval(tipTimer);
    };
  }, [tips.length]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white px-6 font-sans">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-4">
          <div className="relative h-14 w-14 rounded-[12px] bg-black text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <Rocket size={28} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-[#6E6E80]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6E6E80]">Space.inc</p>
            <h1 className="truncate text-xl font-semibold tracking-[-0.04em] text-[#0D0D0D]">{message}</h1>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">Syncing workspace</p>
            <p className="text-[10px] font-semibold text-[#0D0D0D]">{Math.round(progress)}%</p>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full border border-[#E5E5E5] bg-[#F7F7F8]">
            <div
              className="progress-bar-fill h-full rounded-full bg-black transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="rounded-[12px] border border-[#E5E5E5] bg-[#F7F7F8] p-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">
              <Sparkles size={12} />
              Tip
            </div>
            <p className="text-sm leading-6 text-[#0D0D0D] transition-opacity duration-300">
              {tips[tipIndex]}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[#6E6E80]">
          <span className="h-1.5 w-1.5 rounded-full bg-black animate-pulse" />
          <span>Initializing workspace</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
