'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { getMarketFromHostname, type Market, DEFAULT_MARKET } from '../lib/markets';

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
    // If we found a city in the database, convert to Market format
    if (city) {
      return {
        slug: city.slug,
        name: city.name,
        tagline: city.brandName || `${city.name} Camps`,
        region: `${city.name} Metro Area`,
        domains: [city.domain, `www.${city.domain}`].filter(Boolean) as string[],
        emoji: '🏕️',
        popularOrgs: '',
        neighborhoods: '',
        testimonialAttribution: `${city.name} parent of 2`,
        madeIn: city.name,
        iconPath: `/icons/${city.slug}`,
        themeColor: '#2563eb',
      };
    }

    // Fall back to static config
    if (!hostname) return DEFAULT_MARKET;
    return getMarketFromHostname(hostname);
  }, [city, hostname]);
}
