'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { getMarketFromHostname, getMarketBySlug, type Market, DEFAULT_MARKET } from '../lib/markets';

// Re-export Market type for convenience
export type { Market };

/**
 * Get the hostname, available synchronously on the client.
 * Returns '' on the server.
 */
function getHostname(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hostname.split(':')[0].toLowerCase();
}

/**
 * Get the market slug from the server-rendered data attribute on <html>.
 * This is set by the root layout SSR and is available immediately,
 * avoiding any Portland flash on non-Portland domains.
 */
function getSSRMarketSlug(): string | null {
  if (typeof document === 'undefined') return null;
  return document.documentElement.dataset.marketSlug || null;
}

/**
 * Hook to get the current market based on the hostname.
 * Reads the SSR-provided market slug from <html data-market-slug>
 * for instant resolution, then enhances with Convex DB data.
 */
export function useMarket(): Market {
  const hostname = useMemo(getHostname, []);
  const ssrSlug = useMemo(getSSRMarketSlug, []);

  // Resolve static market: prefer SSR slug (works on first render),
  // fall back to hostname lookup
  const staticMarket = useMemo(() => {
    if (ssrSlug) {
      return getMarketBySlug(ssrSlug) || (hostname ? getMarketFromHostname(hostname) : DEFAULT_MARKET);
    }
    return hostname ? getMarketFromHostname(hostname) : DEFAULT_MARKET;
  }, [ssrSlug, hostname]);

  // Query city by domain from database for dynamic fields (icon, brand overrides)
  const domain = staticMarket.domains?.[0]?.replace(/^www\./, '') || hostname.replace(/^www\./, '');
  const city = useQuery(
    api.cities.queries.getCityByDomain,
    domain ? { domain } : 'skip',
  );

  return useMemo(() => {
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
  }, [city, staticMarket]);
}
