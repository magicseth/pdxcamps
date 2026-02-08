import { query, internalQuery, DatabaseReader } from '../_generated/server';
import { v } from 'convex/values';

/**
 * List all active cities
 */
export const listActiveCities = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('cities')
      .withIndex('by_is_active', (q) => q.eq('isActive', true))
      .collect();
  },
});

/**
 * Get a city by its URL slug
 */
export const getCityBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('cities')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique();
  },
});

/**
 * Get a city by its ID
 */
export const getCityById = query({
  args: {
    cityId: v.id('cities'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.cityId);
  },
});

/**
 * List all cities (including inactive) - for migration
 */
export const listAllCities = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('cities').collect();
  },
});

/**
 * List all neighborhoods for a city
 */
export const listNeighborhoods = query({
  args: {
    cityId: v.id('cities'),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('neighborhoods')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();
  },
});

/**
 * Shared helper: resolve a city from a domain.
 * 1. Check city primary domain (indexed)
 * 2. Strip www. and retry
 * 3. Fall back to expansion market domains array
 */
async function resolveCityByDomain(db: DatabaseReader, domain: string) {
  // Try exact match on city primary domain
  const city = await db
    .query('cities')
    .withIndex('by_domain', (q) => q.eq('domain', domain))
    .first();
  if (city) return city;

  // Try without www prefix
  const bare = domain.replace(/^www\./, '');
  if (bare !== domain) {
    const cityNoWww = await db
      .query('cities')
      .withIndex('by_domain', (q) => q.eq('domain', bare))
      .first();
    if (cityNoWww) return cityNoWww;
  }

  // Fall back: check expansion market domains arrays
  const markets = await db.query('expansionMarkets').collect();
  for (const market of markets) {
    const domains = market.domains || [];
    if (domains.some((d) => d.domain === bare || d.domain === domain)) {
      if (market.cityId) {
        return await db.get(market.cityId);
      }
    }
  }

  return null;
}

/**
 * Get a city by its domain
 * Used for multi-tenant routing
 */
export const getCityByDomain = query({
  args: {
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    return await resolveCityByDomain(ctx.db, args.domain);
  },
});

// ============ INTERNAL QUERIES (for HTTP actions) ============

/**
 * Internal: Get city by slug for HTTP route
 */
export const getCityBySlugInternal = internalQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('cities')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique();
  },
});

/**
 * Internal: Get city by domain for HTTP route
 */
export const getCityByDomainInternal = internalQuery({
  args: {
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    return await resolveCityByDomain(ctx.db, args.domain);
  },
});
