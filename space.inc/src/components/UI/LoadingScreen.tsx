import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { VeroMark } from '@/components/brand/VeroLogo';

interface LoadingScreenProps {
  message?: string;
  isComplete?: boolean;
  onExitComplete?: () => void;
}

const MINIMUM_VISIBLE_MS = 2400;
const COMPLETE_DURATION_MS = 720;
const COMPLETE_HOLD_MS = 520;
const EXIT_DURATION_MS = 520;

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);
const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

export const useLoadingScreenGate = (isLoading: boolean, minimumVisibleMs = MINIMUM_VISIBLE_MS) => {
  const [isVisible, setIsVisible] = useState(isLoading);
  const [isComplete, setIsComplete] = useState(false);
  const [cycleKey, setCycleKey] = useState(0);
  const shownAtRef = useRef<number>(isLoading ? Date.now() : 0);

  useEffect(() => {
    let completeTimer: ReturnType<typeof window.setTimeout> | undefined;

    if (isLoading) {
      if (!isVisible) {
        shownAtRef.current = Date.now();
        setIsVisible(true);
        setCycleKey((current) => current + 1);
      }
      if (isComplete) setIsComplete(false);
      return undefined;
    }

    if (isVisible && !isComplete) {
      const elapsed = Date.now() - shownAtRef.current;
      const remaining = Math.max(0, minimumVisibleMs - elapsed);
      completeTimer = window.setTimeout(() => setIsComplete(true), remaining);
    }

    return () => {
      if (completeTimer) window.clearTimeout(completeTimer);
    };
  }, [isComplete, isLoading, isVisible, minimumVisibleMs]);

  return {
    isVisible,
    isComplete,
    cycleKey,
    handleExitComplete: () => {
      setIsVisible(false);
      setIsComplete(false);
    },
  };
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading workspace...',
  isComplete = false,
  onExitComplete,
}) => {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const progressRef = useRef(0);

  const tips = useMemo(() => ([
    'Use the Vero space view to keep work, messages, and files together.',
    'Owners should keep analytics clean by using consistent task groups.',
    'Staff can only work well when permissions match the workflow.',
    'Clients should see a focused portal, not the entire workspace.',
  ]), []);

  useEffect(() => {
    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 2800);

    return () => clearInterval(tipTimer);
  }, [tips.length]);

  useEffect(() => {
    if (isComplete) return undefined;

    let frame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const nextProgress = Math.min(92, easeOutCubic(Math.min(1, elapsed / MINIMUM_VISIBLE_MS)) * 92);
      progressRef.current = nextProgress;
      setProgress(nextProgress);
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isComplete]);

  useEffect(() => {
    if (!isComplete) return undefined;

    let frame = 0;
    const startedAt = performance.now();
    const startProgress = progressRef.current;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const amount = easeInOutCubic(Math.min(1, elapsed / COMPLETE_DURATION_MS));
      const nextProgress = startProgress + (100 - startProgress) * amount;
      progressRef.current = nextProgress;
      setProgress(nextProgress);

      if (amount < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    const exitTimer = window.setTimeout(() => setIsExiting(true), COMPLETE_DURATION_MS + COMPLETE_HOLD_MS);
    const completeTimer = window.setTimeout(
      () => onExitComplete?.(),
      COMPLETE_DURATION_MS + COMPLETE_HOLD_MS + EXIT_DURATION_MS,
    );

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [isComplete, onExitComplete]);

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white px-6 font-sans transition-opacity duration-500 ease-out ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-[12px] bg-black text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <VeroMark tone="light" className="h-9 w-9" />
            <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-[var(--accent-green)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6E6E80]">Vero</p>
            <h1 className="truncate text-xl font-semibold tracking-[-0.04em] text-[#0D0D0D]">{message}</h1>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">Syncing Vero</p>
            <p className="text-[10px] font-semibold text-[#0D0D0D]">{Math.min(100, Math.round(progress))}%</p>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full border border-[#E5E5E5] bg-[#F7F7F8]">
            <div
              className="progress-bar-fill h-full rounded-full transition-all duration-500 ease-out"
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
          <span>Initializing Vero</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
