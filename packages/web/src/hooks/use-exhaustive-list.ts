import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaginatedResult } from './use-paginated-query';

const MAX_PAGE_SIZE = 100;
const MAX_ITEMS = 1000;
const LIVE_POLL_INTERVAL_MS = 5000;
const LIVE_POLL_LIMIT = 5;

export interface ExhaustiveListState<T> {
  /** All items fetched so far */
  items: T[];
  /** Whether we're currently loading more items */
  loading: boolean;
  /** Error if any occurred */
  error: Error | null;
  /** Whether we've reached the end of available data */
  hasReachedEnd: boolean;
  /** Whether we hit the 1000 item limit */
  hasHitLimit: boolean;
  /** Whether initial load is complete */
  initialLoadComplete: boolean;
}

interface UseExhaustiveListOptions<T, TParams> {
  /**
   * Function to create a unique cache key from params
   */
  createKey: (params: TParams, cursor?: string) => string;
  /**
   * Fetcher function that takes params and cursor
   */
  fetcher: (
    params: TParams,
    cursor?: string,
    sortOrder?: 'asc' | 'desc',
    limit?: number
  ) => Promise<PaginatedResult<T>>;
  /**
   * Parameters to pass to the fetcher
   */
  params: TParams;
  /**
   * Whether to enable live polling (re-fetches latest with limit=5 every 5s)
   */
  live?: boolean;
  /**
   * Called when the 1000 item limit is hit
   */
  onLimitExceeded?: () => void;
}

/**
 * Hook that exhaustively fetches all items up to a maximum of 1000.
 * - Fetches with maximum page size (100 per page)
 * - Paginates until all items are fetched or 1000 item limit is reached
 * - Re-renders on every page return for incremental loading
 * - Supports live mode: polls latest items with limit=5 every 5s
 * - Always uses ascending (oldest-first) sort order for consistency
 */
export function useExhaustiveList<T, TParams = any>({
  createKey,
  fetcher,
  params,
  live = false,
  onLimitExceeded,
}: UseExhaustiveListOptions<T, TParams>): ExhaustiveListState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [hasHitLimit, setHasHitLimit] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const isFetchingRef = useRef(false);
  const liveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const paramsKey = createKey(params);

  // Function to poll for latest items in live mode
  const pollLatest = useCallback(async () => {
    if (isFetchingRef.current || !initialLoadComplete) return;

    try {
      // Fetch the latest 5 items
      const result = await fetcher(params, cursor, 'asc', LIVE_POLL_LIMIT);

      if (result.data.length > 0) {
        if (result.cursor) {
          setCursor(result.cursor);
        }
        setItems((currentItems) => {
          // Create a map of existing items by ID (assuming items have an 'id' field)
          const idKeys = ['stepId', 'eventId', 'hookId', 'runId', 'id'];
          const getId = (item: T) => {
            const anyItem = item as any;
            const key = idKeys.find((key) => anyItem[key]);
            return key ? anyItem[key] : null;
          };
          const getCreatedAt = (item: T): number => {
            const anyItem = item as any;
            const timestamp = anyItem.createdAt;
            if (timestamp) {
              return new Date(timestamp).getTime();
            }
            return 0;
          };

          const itemMap = new Map<any, T>();
          for (const item of currentItems) {
            const id = getId(item);
            if (id) {
              itemMap.set(id, item);
            }
          }

          // Add or update new items
          for (const newItem of result.data) {
            const id = getId(newItem);
            if (id) {
              itemMap.set(id, newItem);
            }
          }

          // Convert back to array and sort by createdAt (oldest first)
          return Array.from(itemMap.values()).sort(
            (a, b) => getCreatedAt(a) - getCreatedAt(b)
          );
        });
      }
    } catch (err) {
      // Silently fail on live polling errors to avoid disrupting the UI
      console.error('Live polling error:', err);
    }
  }, [fetcher, params, initialLoadComplete, cursor]);

  // Initial fetch on mount or when params change
  // biome-ignore lint/correctness/useExhaustiveDependencies: Do a single fetch when params change
  useEffect(() => {
    // Reset state when params change
    setItems([]);
    setHasReachedEnd(false);
    setHasHitLimit(false);
    setInitialLoadComplete(false);

    // Function to fetch all pages
    const fetchAllPages = async () => {
      if (isFetchingRef.current) return;

      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        let cursor: string | undefined;
        let allItems: T[] = [];

        // Keep fetching until no more data or hit limit
        while (true) {
          const result = await fetcher(params, cursor, 'asc', MAX_PAGE_SIZE);

          // Add new items
          const newItems = result.data;
          allItems = [...allItems, ...newItems];

          // Update state incrementally for better UX
          setItems(allItems);

          // Check if we hit the limit
          if (allItems.length >= MAX_ITEMS) {
            setHasHitLimit(true);
            if (onLimitExceeded) {
              onLimitExceeded();
            }
            break;
          }

          // Check if there's more data
          if (!result.hasMore || !result.cursor) {
            setHasReachedEnd(true);
            break;
          }

          cursor = result.cursor;
          if (cursor) {
            setCursor(cursor);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
        setInitialLoadComplete(true);
      }
    };

    fetchAllPages();
  }, [paramsKey]); // Only re-run when paramsKey changes (stable string)

  // Setup live polling if enabled
  useEffect(() => {
    if (!live || !initialLoadComplete) {
      return;
    }

    // Start polling regardless of hasReachedEnd - new items may appear in ongoing runs
    liveIntervalRef.current = setInterval(pollLatest, LIVE_POLL_INTERVAL_MS);

    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    };
  }, [live, initialLoadComplete, pollLatest]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Do a single poll when live mode is toggled
  useEffect(() => {
    if (live && initialLoadComplete) {
      pollLatest();
    }
  }, [live, initialLoadComplete]);

  return {
    items,
    loading,
    error,
    hasReachedEnd,
    hasHitLimit,
    initialLoadComplete,
  };
}
