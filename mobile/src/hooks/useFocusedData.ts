import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { getErrorMessage } from '../api/client';

/**
 * Loads data every time the screen comes into view (so lists are fresh after you
 * add or repay a loan on another screen) and supports pull-to-refresh.
 *
 * `fetcher` must be wrapped in useCallback, otherwise it would reload on every render.
 */
export function useFocusedData<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Ignore responses from older requests (e.g. when the user switches filters quickly).
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const requestNumber = ++latestRequest.current;
    try {
      const result = await fetcher();
      if (requestNumber === latestRequest.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (requestNumber === latestRequest.current) {
        setError(getErrorMessage(err));
      }
    }
  }, [fetcher]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const retry = useCallback(() => {
    setError(null);
    void load();
  }, [load]);

  return { data, setData, error, refreshing, refresh, retry };
}
