import { useEffect, useMemo, useState } from 'react';
import useSWR, { type SWRConfiguration } from 'swr';
import { getPaginationDisplay } from '@/lib/utils';

export interface PaginatedResult<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

interface UsePaginatedQueryOptions<TParams, TResult> extends SWRConfiguration {
  /**
   * Function to create a unique cache key from params
   */
  createKey: (params: TParams, cursor?: string) => string;
  /**
   * Fetcher function that takes params and cursor
   */
  fetcher: (
    params: TParams,
    cursor?: string
  ) => Promise<PaginatedResult<TResult>>;
  /**
   * Parameters to pass to the fetcher
   */
  params: TParams;
}

export function usePaginatedQuery<T, TParams = any>({
  createKey,
  fetcher,
  params,
  ...swrOptions
}: UsePaginatedQueryOptions<TParams, T>) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [pageHistory, setPageHistory] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const [maxPagesVisited, setMaxPagesVisited] = useState(1);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResult<T>
  >(createKey(params, cursor), () => fetcher(params, cursor), {
    revalidateOnFocus: false,
    keepPreviousData: true,
    ...swrOptions,
  });

  const currentPageNumber = pageHistory.length;

  const paginationDisplay = useMemo(() => {
    if (!data) return '';
    // Only show "+" if we're on the last visited page AND there are more pages
    const isOnLastVisitedPage = currentPageNumber === maxPagesVisited;
    const showPlus = isOnLastVisitedPage && data.hasMore;
    return getPaginationDisplay(currentPageNumber, maxPagesVisited, showPlus);
  }, [currentPageNumber, maxPagesVisited, data]);

  const handleNextPage = () => {
    if (!data?.hasMore || !data.cursor) return;

    setPageHistory((prev) => [...prev, data.cursor ?? undefined]);
    setMaxPagesVisited((prevMax) => Math.max(prevMax, pageHistory.length + 1));
    setCursor(data.cursor ?? undefined);
  };

  const handlePrevPage = () => {
    if (pageHistory.length <= 1) return;

    const newHistory = pageHistory.slice(0, -1);
    setPageHistory(newHistory);
    setCursor(newHistory[newHistory.length - 1]);
  };

  const handleRefresh = () => {
    setPageHistory([undefined]);
    setCursor(undefined);
    setMaxPagesVisited(1);
    mutate();
  };

  const loading = isLoading || isValidating;

  // Create a stable string key from params for comparison
  const paramsKey = createKey(params);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-set data when params change
  useEffect(() => {
    setCursor(undefined);
    setPageHistory([undefined]);
    setMaxPagesVisited(1);
  }, [paramsKey]);

  // Update lastRefreshTime when new data arrives
  useEffect(() => {
    if (data) {
      setLastRefreshTime(new Date());
    }
  }, [data]);

  return {
    // Data
    data,
    error,
    isLoading,
    isValidating,
    loading,
    mutate,
    lastRefreshTime,

    // Pagination state
    cursor,
    currentPageNumber,
    maxPagesVisited,
    paginationDisplay,

    // Pagination handlers
    handleNextPage,
    handlePrevPage,
    handleRefresh,

    // Flags
    canGoNext: Boolean(data?.hasMore),
    canGoPrev: pageHistory.length > 1,
  };
}
