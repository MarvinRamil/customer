import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';

/**
 * TanStack Query client configuration
 * Provides default settings for caching, retries, and stale time
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      Sentry.captureException(error, {
        tags: { source: 'react-query-query' },
        extra: { queryKey: query.queryKey },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      Sentry.captureException(error, {
        tags: { source: 'react-query-mutation' },
        extra: { mutationKey: mutation.options.mutationKey },
      });
    },
  }),
  defaultOptions: {
    queries: {
      // Data is considered stale after 5 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Cache data for 10 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      // Retry failed requests up to 3 times
      retry: 3,
      // Retry delay increases exponentially
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus (useful for web, less for mobile)
      refetchOnWindowFocus: false,
      // Refetch on reconnect
      refetchOnReconnect: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: true,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});
