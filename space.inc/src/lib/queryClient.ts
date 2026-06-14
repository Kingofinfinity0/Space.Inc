import { QueryClient, dehydrate, hydrate } from '@tanstack/react-query';

const QUERY_CACHE_STORAGE_KEY = 'space.inc.react-query-cache.v1';
const QUERY_CACHE_MAX_AGE = 1000 * 60 * 60 * 12;
const QUERY_CACHE_THROTTLE_MS = 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: QUERY_CACHE_MAX_AGE,
      retry: 2,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const hydrateQueryCache = () => {
  if (!canUseStorage()) return;

  try {
    const raw = window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY);
    if (!raw) return;

    const persisted = JSON.parse(raw) as { timestamp?: number; clientState?: unknown };
    if (!persisted.timestamp || Date.now() - persisted.timestamp > QUERY_CACHE_MAX_AGE) {
      window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
      return;
    }

    if (persisted.clientState) hydrate(queryClient, persisted.clientState as any);
  } catch {
    window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
  }
};

const persistQueryCache = () => {
  if (!canUseStorage()) return;

  try {
    const clientState = dehydrate(queryClient, {
      shouldDehydrateQuery: (query) => query.state.status === 'success'
    });
    window.localStorage.setItem(QUERY_CACHE_STORAGE_KEY, JSON.stringify({
      timestamp: Date.now(),
      clientState
    }));
  } catch {
    // Cache persistence should be best-effort; quota failures still leave in-memory caching intact.
  }
};

hydrateQueryCache();

let persistTimer: number | null = null;
if (canUseStorage()) {
  queryClient.getQueryCache().subscribe(() => {
    if (persistTimer) window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(persistQueryCache, QUERY_CACHE_THROTTLE_MS);
  });
}
