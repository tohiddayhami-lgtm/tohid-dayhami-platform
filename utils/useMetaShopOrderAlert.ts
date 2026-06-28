import { useEffect, useMemo, useRef } from 'react';
import { MetaShopOrder } from '../types';
import { playMetaShopOrderAlertChime } from './metaShopOrderAlertSound';

const DEFAULT_INTERVAL_MS = 4000;

export function useMetaShopOrderAlert(
  orders: MetaShopOrder[],
  shopIds: string[],
  soundEnabled: boolean,
  intervalMs = DEFAULT_INTERVAL_MS,
): { pendingCount: number } {
  const pendingCount = useMemo(
    () => orders.filter(o => shopIds.includes(o.shopId) && o.status === 'new').length,
    [orders, shopIds],
  );

  const intervalRef = useRef<number>();

  useEffect(() => {
    if (!soundEnabled || pendingCount === 0) {
      window.clearInterval(intervalRef.current);
      return;
    }

    playMetaShopOrderAlertChime();
    intervalRef.current = window.setInterval(playMetaShopOrderAlertChime, intervalMs);

    return () => window.clearInterval(intervalRef.current);
  }, [soundEnabled, pendingCount, intervalMs]);

  return { pendingCount };
}
