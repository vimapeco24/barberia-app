import { useCallback, useEffect, useRef, useState } from 'react';
import { SyncStatus } from '../types';

const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds (requirement 7.3: changes reflected in max 5 seconds)
const MAX_RETRIES = 3; // Maximum retry attempts on failure (requirement 7.4)
const RETRY_INTERVAL_MS = 2000; // 2 seconds between retries (requirement 7.4)

interface UseSyncOptions<T> {
  /** Async function that fetches the data from the API */
  fetchFn: () => Promise<T>;
  /** Whether polling should be active (e.g., only when screen is focused) */
  enabled?: boolean;
  /** Callback when data is successfully fetched */
  onSuccess?: (data: T) => void;
  /** Callback when sync fails after all retries */
  onError?: (error: Error) => void;
}

interface UseSyncResult<T> {
  /** Current data from the last successful fetch */
  data: T | null;
  /** Current sync status: 'synced', 'syncing', or 'error' */
  syncStatus: SyncStatus;
  /** Error message when syncStatus is 'error' */
  errorMessage: string | null;
  /** Number of consecutive failed retry attempts */
  retryCount: number;
  /** Manually trigger a sync */
  refresh: () => Promise<void>;
}

/**
 * Custom hook that implements cross-platform synchronization via polling.
 *
 * Polls the given fetch function every 5 seconds to ensure data stays
 * up-to-date across all platforms (requirement 7.3).
 *
 * On failure, retries up to 3 times with 2-second intervals (requirement 7.4).
 * If all retries fail, sets syncStatus to 'error' and exposes an error message.
 *
 * @example
 * ```tsx
 * const { data, syncStatus, errorMessage, refresh } = useSync({
 *   fetchFn: () => getMyBookings(),
 *   enabled: isFocused,
 *   onSuccess: (bookings) => setBookings(bookings),
 * });
 * ```
 */
export function useSync<T>({
  fetchFn,
  enabled = true,
  onSuccess,
  onError,
}: UseSyncOptions<T>): UseSyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const isPollingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const fetchWithRetry = useCallback(
    async (attempt: number = 0): Promise<void> => {
      if (!isMountedRef.current) return;

      setSyncStatus('syncing');

      try {
        const result = await fetchFn();

        if (!isMountedRef.current) return;

        setData(result);
        setSyncStatus('synced');
        setErrorMessage(null);
        setRetryCount(0);
        onSuccess?.(result);
      } catch (error) {
        if (!isMountedRef.current) return;

        const nextAttempt = attempt + 1;
        setRetryCount(nextAttempt);

        if (nextAttempt < MAX_RETRIES) {
          // Schedule retry after RETRY_INTERVAL_MS
          retryTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              fetchWithRetry(nextAttempt);
            }
          }, RETRY_INTERVAL_MS);
        } else {
          // All retries exhausted — set error state
          const errorMsg =
            error instanceof Error
              ? error.message
              : 'Los datos pueden no estar actualizados. Verifica tu conexión.';

          setSyncStatus('error');
          setErrorMessage(errorMsg);
          onError?.(
            error instanceof Error
              ? error
              : new Error('Sync failed after maximum retries')
          );
        }
      }
    },
    [fetchFn, onSuccess, onError]
  );

  const refresh = useCallback(async (): Promise<void> => {
    clearTimers();
    setRetryCount(0);
    await fetchWithRetry(0);
  }, [fetchWithRetry, clearTimers]);

  // Polling loop
  useEffect(() => {
    if (!enabled) {
      clearTimers();
      isPollingRef.current = false;
      return;
    }

    isMountedRef.current = true;
    isPollingRef.current = true;

    // Initial fetch
    fetchWithRetry(0);

    // Set up polling interval
    const startPolling = () => {
      pollTimerRef.current = setTimeout(async () => {
        if (!isMountedRef.current || !isPollingRef.current) return;

        await fetchWithRetry(0);

        // Schedule next poll only if still mounted and enabled
        if (isMountedRef.current && isPollingRef.current) {
          startPolling();
        }
      }, POLL_INTERVAL_MS);
    };

    startPolling();

    return () => {
      isMountedRef.current = false;
      isPollingRef.current = false;
      clearTimers();
    };
  }, [enabled, fetchWithRetry, clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  return {
    data,
    syncStatus,
    errorMessage,
    retryCount,
    refresh,
  };
}
