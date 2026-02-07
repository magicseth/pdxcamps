'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { getMarketFromHostname, type Market, DEFAULT_MARKET } from '../lib/markets';

// Re-export Market type for convenience
export type { Market };

/**
 * Hook to get the current market based on the hostname
 * First checks the database (cities table), then falls back to static config
 */
export function useMarket(): Market {
  const hostname = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.hostname.split(':')[0].toLowerCase();
  }, []);

  // Query city by domain from database
  const city = useQuery(
    api.cities.queries.getCityByDomain,
    hostname ? { domain: hostname.replace(/^www\./, '') } : 'skip'
  );

  return useMemo(() => {
    // Get static market config (always available, has correct iconPath etc.)
    const staticMarket = hostname ? getMarketFromHostname(hostname) : DEFAULT_MARKET;

    // If we found a city in the database, merge with static config
    if (city) {
      return {
        ...staticMarket,
        slug: city.slug,
        name: city.name,
        tagline: city.brandName || staticMarket.tagline || `${city.name} Camps`,
        domains: [city.domain, `www.${city.domain}`].filter(Boolean) as string[],
        iconStorageId: city.iconStorageId,
      };
    }

    return staticMarket;
  }, [city, hostname]);
}
