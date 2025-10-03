import { useCallback, useEffect, useMemo, useState } from 'react';

interface Page<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

interface UsePaginationOptions<T> {
  fetchFn: (cursor?: string) => Promise<{
    data: T[];
    cursor: string | null;
    hasMore: boolean;
  }>;
  enableAutoRefresh?: boolean;
}

const AUTO_REFRESH_INTERVAL = 5000;

export function usePagination<T>({
  fetchFn,
  enableAutoRefresh = false,
}: UsePaginationOptions<T>) {
  const [pages, setPages] = useState<Page<T>[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const currentPage = pages[currentPageIndex];

  const lastPageHasMore = useMemo(() => {
    return pages.length > 0 && pages[pages.length - 1].hasMore;
  }, [pages]);
  const currentNavPosition = useMemo(() => {
    if (lastPageHasMore) {
      return `Page ${currentPageIndex + 1} of ${pages.length}+`;
    }
    return `Page ${currentPageIndex + 1} of ${pages.length}`;
  }, [currentPageIndex, lastPageHasMore, pages]);

  const fetchPage = useCallback(
    async (pageIndex?: number, cursor?: string) => {
      console.log('fetching page', pageIndex, 'cursor', cursor);
      setLoading(true);
      try {
        const result = await fetchFn(cursor);
        const newPage: Page<T> = {
          data: result.data,
          cursor: result.cursor,
          hasMore: result.hasMore,
        };

        setPages((prev) => {
          const newPages = [...prev];
          if (pageIndex !== undefined) {
            newPages[pageIndex] = newPage;
          } else {
            newPages.push(newPage);
          }
          return newPages;
        });

        // Update last refresh time only for first page refreshes
        if (pageIndex === 0 || pageIndex === undefined) {
          setLastRefreshTime(new Date());
        }

        return newPage;
      } catch (error) {
        console.error('Failed to fetch page:', error);
        const emptyPage: Page<T> = { data: [], cursor: null, hasMore: false };

        setPages((prev) => {
          const newPages = [...prev];
          if (pageIndex !== undefined) {
            newPages[pageIndex] = emptyPage;
          } else if (prev.length === 0) {
            newPages.push(emptyPage);
          }
          return newPages;
        });

        return emptyPage;
      } finally {
        setLoading(false);
      }
    },
    [fetchFn]
  );

  // Initial load - reset and fetch when fetchFn changes
  useEffect(() => {
    // Reset state when fetchFn changes (e.g., navigating to a different view)
    setPages([]);
    setCurrentPageIndex(0);
    setLastRefreshTime(null);
    void fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchFn]);

  // Auto-refresh (for first page only)
  useEffect(() => {
    if (!enableAutoRefresh || currentPageIndex !== 0) return;

    const interval = setInterval(() => {
      fetchPage(0);
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [enableAutoRefresh, currentPageIndex, fetchPage]);

  const handleNextPage = useCallback(async () => {
    const currentPage = pages[currentPageIndex];
    if (!currentPage?.hasMore) return;

    // Check if we already have the next page cached
    if (pages[currentPageIndex + 1]) {
      setCurrentPageIndex((prev) => prev + 1);
    } else {
      // Fetch the next page and only increment index after fetch completes
      await fetchPage(currentPageIndex + 1, currentPage.cursor ?? undefined);
      setCurrentPageIndex((prev) => prev + 1);
    }
  }, [pages, currentPageIndex, fetchPage]);

  const handlePrevPage = useCallback(() => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  }, [currentPageIndex]);

  const handleRefresh = useCallback(() => {
    // Clear all cached pages except the first one when refreshing
    setPages((prev) => (prev.length > 0 ? [prev[0]] : []));
    setCurrentPageIndex(0);
    fetchPage(0);
  }, [fetchPage]);

  return {
    currentPage,
    currentPageIndex,
    currentNavPosition,
    pages,
    loading,
    lastRefreshTime,
    handleNextPage,
    handlePrevPage,
    handleRefresh,
  };
}
