import type { Step } from '@vercel/workflow-world';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import type { WorldConfig } from '@/lib/config-world';
import { DEFAULT_PAGE_SIZE, getPaginationDisplay } from '@/lib/utils';
import { fetchSteps } from '@/lib/world';

const INITIAL_PRELOAD_SIZE = 100;

interface StepsPageState {
  allSteps: Step[];
  serverCursor: string | null;
  serverHasMore: boolean;
  isPreloadPhase: boolean;
}

/**
 * Specialized hook for steps that pre-loads 100 steps initially
 * but paginates through them client-side with the given limit.
 * This is so that we have a higher chance of showing all steps in the timeline
 * view (which uses this data) without affecting the table usability.
 */
export function useStepsWithPreload(
  config: WorldConfig,
  runId: string,
  sortOrder: 'asc' | 'desc' = 'asc',
  limit: number = DEFAULT_PAGE_SIZE
) {
  // Track which client-side page we're on (1-indexed)
  const [clientPage, setClientPage] = useState(1);
  const [maxPagesVisited, setMaxPagesVisited] = useState(1);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // Store pre-loaded data and server pagination state
  const [pageState, setPageState] = useState<StepsPageState>({
    allSteps: [],
    serverCursor: null,
    serverHasMore: false,
    isPreloadPhase: true,
  });

  // Determine what to fetch from server
  // - If we're still in preload phase and haven't fetched yet, fetch with INITIAL_PRELOAD_SIZE
  // - If we've exhausted preloaded data and need more, fetch next page from server
  // - Otherwise, don't fetch anything (use cached data)
  const needsServerFetch = useMemo(() => {
    if (pageState.isPreloadPhase && pageState.allSteps.length === 0) {
      // Initial load
      return { cursor: undefined, fetchLimit: INITIAL_PRELOAD_SIZE };
    }

    const startIndex = (clientPage - 1) * limit;
    const endIndex = startIndex + limit;

    // Check if we need more data from server
    if (endIndex > pageState.allSteps.length && pageState.serverHasMore) {
      return {
        cursor: pageState.serverCursor,
        fetchLimit: INITIAL_PRELOAD_SIZE,
      };
    }

    return null;
  }, [pageState, clientPage, limit]);

  // Create cache key
  const cacheKey = useMemo(() => {
    if (!needsServerFetch) return null;
    const configKey = JSON.stringify(config);
    return [
      configKey,
      'steps-preload',
      runId,
      needsServerFetch.cursor,
      sortOrder,
      String(needsServerFetch.fetchLimit),
    ]
      .filter(Boolean)
      .join('::');
  }, [config, runId, sortOrder, needsServerFetch]);

  // Fetch from server when needed
  const {
    data: serverData,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR(
    cacheKey,
    cacheKey && needsServerFetch
      ? () =>
          fetchSteps(
            config,
            runId,
            needsServerFetch.cursor ?? undefined,
            sortOrder,
            needsServerFetch.fetchLimit
          )
      : null,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  // Update page state when server data arrives
  useEffect(() => {
    if (serverData) {
      setPageState((prev) => {
        // If this is the first fetch, replace all data
        if (prev.isPreloadPhase && prev.allSteps.length === 0) {
          return {
            allSteps: serverData.data,
            serverCursor: serverData.cursor,
            serverHasMore: serverData.hasMore,
            isPreloadPhase: false,
          };
        }

        // Otherwise, append new data
        const existingIds = new Set(prev.allSteps.map((s) => s.stepId));
        const newSteps = serverData.data.filter(
          (s) => !existingIds.has(s.stepId)
        );

        return {
          allSteps: [...prev.allSteps, ...newSteps],
          serverCursor: serverData.cursor,
          serverHasMore: serverData.hasMore,
          isPreloadPhase: false,
        };
      });
      setLastRefreshTime(new Date());
    }
  }, [serverData]);

  // Calculate current page data (client-side pagination)
  const currentPageData = useMemo(() => {
    const startIndex = (clientPage - 1) * limit;
    const endIndex = startIndex + limit;
    return pageState.allSteps.slice(startIndex, endIndex);
  }, [pageState.allSteps, clientPage, limit]);

  // Calculate if there's more data available
  const hasMore = useMemo(() => {
    const startIndex = (clientPage - 1) * limit;
    const endIndex = startIndex + limit;
    // More data if we have more in cache OR server has more
    return endIndex < pageState.allSteps.length || pageState.serverHasMore;
  }, [pageState, clientPage, limit]);

  // Pagination display
  const paginationDisplay = useMemo(() => {
    const isOnLastVisitedPage = clientPage === maxPagesVisited;
    const showPlus = isOnLastVisitedPage && hasMore;
    return getPaginationDisplay(clientPage, maxPagesVisited, showPlus);
  }, [clientPage, maxPagesVisited, hasMore]);

  // Navigation handlers
  const handleNextPage = () => {
    if (!hasMore) return;
    setClientPage((prev) => prev + 1);
    setMaxPagesVisited((prev) => Math.max(prev, clientPage + 1));
  };

  const handlePrevPage = () => {
    if (clientPage <= 1) return;
    setClientPage((prev) => prev - 1);
  };

  const handleRefresh = () => {
    setClientPage(1);
    setMaxPagesVisited(1);
    setPageState({
      allSteps: [],
      serverCursor: null,
      serverHasMore: false,
      isPreloadPhase: true,
    });
    mutate();
  };

  // Reset when params change
  const paramsKey = JSON.stringify({ config, runId, sortOrder, limit });
  // biome-ignore lint/correctness/useExhaustiveDependencies: paramsKey is a stable comparison key
  useEffect(() => {
    setClientPage(1);
    setMaxPagesVisited(1);
    setPageState({
      allSteps: [],
      serverCursor: null,
      serverHasMore: false,
      isPreloadPhase: true,
    });
  }, [paramsKey]);

  const loading = isLoading || isValidating;

  return {
    // Data
    data:
      currentPageData.length > 0
        ? {
            data: currentPageData,
            cursor: pageState.serverCursor,
            hasMore,
          }
        : null,
    error,
    isLoading,
    isValidating,
    loading,
    mutate,
    lastRefreshTime,

    // All steps for timeline
    allSteps: pageState.allSteps,

    // Pagination state
    currentPageNumber: clientPage,
    maxPagesVisited,
    paginationDisplay,

    // Pagination handlers
    handleNextPage,
    handlePrevPage,
    handleRefresh,

    // Flags
    canGoNext: hasMore,
    canGoPrev: clientPage > 1,
  };
}
