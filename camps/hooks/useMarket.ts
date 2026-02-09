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
 * Read SSR-resolved market data from <html data-market-ssr>.
 * This is fetched from Convex during SSR and includes iconStorageId,
 * brand name, etc. — available on first paint with no client query needed.
 */
function getSSRMarketData(): Partial<Market> & { iconStorageId?: string } | null {
  if (typeof document === 'undefined') return null;
  const raw = document.documentElement.dataset.marketSsr;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Hook to get the current market based on the hostname.
 * Reads the SSR-provided market data from <html data-market-ssr>
 * for instant resolution (icon, brand name, etc.), then enhances
 * with the full Convex DB data once the client query resolves.
 */
export function useMarket(): Market {
  const hostname = useMemo(getHostname, []);
  const ssrSlug = useMemo(getSSRMarketSlug, []);
  const ssrData = useMemo(getSSRMarketData, []);

  // Resolve static market: prefer SSR slug (works on first render),
  // fall back to hostname lookup
  const staticMarket = useMemo(() => {
    if (ssrSlug) {
      return getMarketBySlug(ssrSlug) || (hostname ? getMarketFromHostname(hostname) : DEFAULT_MARKET);
    }
    return hostname ? getMarketFromHostname(hostname) : DEFAULT_MARKET;
  }, [ssrSlug, hostname]);

  // Merge SSR Convex data into static market for immediate use
  const ssrMarket = useMemo(() => {
    if (!ssrData) return staticMarket;
    return {
      ...staticMarket,
      ...ssrData,
    };
  }, [staticMarket, ssrData]);

  // Query city by domain from database for dynamic fields (icon, brand overrides)
  const domain = ssrMarket.domains?.[0]?.replace(/^www\./, '') || hostname.replace(/^www\./, '');
  const city = useQuery(
    api.cities.queries.getCityByDomain,
    domain ? { domain } : 'skip',
  );

  return useMemo(() => {
    if (city) {
      return {
        ...ssrMarket,
        slug: city.slug,
        name: city.name,
        tagline: city.brandName || ssrMarket.tagline || `${city.name} Camps`,
        domains: [city.domain, `www.${city.domain}`].filter(Boolean) as string[],
        iconStorageId: city.iconStorageId,
      };
    }
    // Before the query resolves, use SSR data (which already has Convex data)
    return ssrMarket;
  }, [city, ssrMarket]);
}
