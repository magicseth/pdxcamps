'use client';

import { useMemo } from 'react';
import { getMarketFromHostname, type Market, DEFAULT_MARKET } from '../lib/markets';

/**
 * Hook to get the current market based on the hostname
 */
export function useMarket(): Market {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_MARKET;
    }
    return getMarketFromHostname(window.location.hostname);
  }, []);
}
