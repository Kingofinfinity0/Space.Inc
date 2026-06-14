import React, { useEffect, useRef, useState } from 'react';
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

export const useLoadingScreenGate = (isLoading: boolean) => ({
  isVisible: isLoading,
  isComplete: false,
  cycleKey: 0,
  handleExitComplete: () => undefined,
});

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading workspace...',
  isComplete = false,
  onExitComplete,
}) => {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const progressRef = useRef(0);

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
      role="status"
      aria-label={message}
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white px-6 font-sans transition-opacity duration-500 ease-out ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex w-full max-w-[180px] flex-col items-center gap-5">
        <VeroMark tone="dark" className="h-10 w-10" />

        <div className="h-2 w-full overflow-hidden rounded-full border border-[#E5E5E5] bg-[#F7F7F8]">
          <div
            className="progress-bar-fill h-full rounded-full bg-[#10A37F] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
