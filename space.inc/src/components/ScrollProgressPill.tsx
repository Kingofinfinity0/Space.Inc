import React from 'react';

type ScrollMetrics = {
    canScroll: boolean;
    progress: number;
    segments: number;
    visible: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getScrollRoot = () => (
    document.querySelector<HTMLElement>('[data-scroll-root="app"]') || document.documentElement
);

const getMetrics = (root: HTMLElement): Omit<ScrollMetrics, 'visible'> => {
    const maxScroll = Math.max(root.scrollHeight - root.clientHeight, 0);
    const canScroll = maxScroll > 24;
    const progress = canScroll ? clamp(root.scrollTop / maxScroll, 0, 1) : 0;
    const screens = root.clientHeight > 0 ? Math.ceil(root.scrollHeight / root.clientHeight) : 0;
    const segments = canScroll ? clamp(screens, 3, 10) : 0;

    return { canScroll, progress, segments };
};

const ScrollProgressPill: React.FC = () => {
    const hideTimerRef = React.useRef<number | null>(null);
    const [metrics, setMetrics] = React.useState<ScrollMetrics>({
        canScroll: false,
        progress: 0,
        segments: 0,
        visible: false
    });

    React.useEffect(() => {
        const root = getScrollRoot();

        const update = (visible: boolean) => {
            const nextMetrics = getMetrics(root);

            setMetrics((current) => ({
                ...nextMetrics,
                visible: visible && nextMetrics.canScroll ? true : current.visible && nextMetrics.canScroll
            }));

            if (hideTimerRef.current) {
                window.clearTimeout(hideTimerRef.current);
            }

            if (visible && nextMetrics.canScroll) {
                hideTimerRef.current = window.setTimeout(() => {
                    setMetrics((current) => ({ ...current, visible: false }));
                }, 950);
            }
        };

        const handleScroll = () => update(true);
        const handleResize = () => update(false);
        const resizeObserver = new ResizeObserver(() => update(false));
        const mutationObserver = new MutationObserver(() => update(false));

        update(false);
        root.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize);
        resizeObserver.observe(root);
        mutationObserver.observe(root, { childList: true, subtree: true });

        return () => {
            root.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            mutationObserver.disconnect();

            if (hideTimerRef.current) {
                window.clearTimeout(hideTimerRef.current);
            }
        };
    }, []);

    if (!metrics.canScroll || metrics.segments < 2) {
        return null;
    }

    const activeIndex = clamp(Math.round(metrics.progress * (metrics.segments - 1)), 0, metrics.segments - 1);

    return (
        <div
            aria-hidden="true"
            className={`fixed right-4 top-1/2 z-[80] -translate-y-1/2 rounded-full border border-[#E5E5E5] bg-white/95 px-2.5 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur transition-all duration-300 ease-out md:right-5 ${
                metrics.visible ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-3 opacity-0'
            }`}
        >
            <div className="flex flex-col items-center gap-2">
                {Array.from({ length: metrics.segments }).map((_, index) => {
                    const isActive = index === activeIndex;
                    const isPast = index < activeIndex;

                    return (
                        <span
                            key={index}
                            className={`block rounded-full transition-all duration-300 ease-in-out ${
                                isActive
                                    ? 'h-1 w-8 bg-[#0D0D0D]'
                                    : isPast
                                        ? 'h-2 w-2 bg-[#9A9AA2]'
                                        : 'h-1.5 w-1.5 bg-[#D4D4D8]'
                            }`}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default ScrollProgressPill;
