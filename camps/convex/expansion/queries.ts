import { query } from '../_generated/server';
import { v } from 'convex/values';
import { EXPANSION_MARKETS, getExpansionMarketByKey } from '../../lib/expansionMarkets';

/**
 * List all expansion markets with their DB status merged
 */
export const listExpansionMarkets = query({
  args: {
    tier: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get all expansion market records from DB
    const dbRecords = await ctx.db.query('expansionMarkets').collect();
    const recordsByKey = new Map(dbRecords.map((r) => [r.marketKey, r]));

    // Merge with static market data
    let markets = EXPANSION_MARKETS;
    if (args.tier) {
      markets = markets.filter((m) => m.tier === args.tier);
    }

    // Get stats for all cities that have been created
    const cityIds = dbRecords.filter((r) => r.cityId).map((r) => r.cityId!);

    // Fetch all orgs once (they have cityIds array, no index)
    const allOrgs = await ctx.db.query('organizations').collect();

    // Batch fetch counts for each city
    const statsPromises = cityIds.map(async (cityId) => {
      const [sources, sessions, directories] = await Promise.all([
        ctx.db
          .query('scrapeSources')
          .withIndex('by_city', (q) => q.eq('cityId', cityId))
          .collect(),
        ctx.db
          .query('sessions')
          .withIndex('by_city_and_status', (q) => q.eq('cityId', cityId))
          .collect(),
        ctx.db
          .query('directories')
          .withIndex('by_city', (q) => q.eq('cityId', cityId))
          .collect(),
      ]);
      // Filter orgs that include this cityId
      const orgsInCity = allOrgs.filter((org) => org.cityIds.includes(cityId));
      const activeSources = sources.filter((s) => s.isActive && (s.scraperCode || s.scraperModule));
      const healthySources = activeSources.filter((s) => s.scraperHealth.consecutiveFailures < 3);
      const failingSources = activeSources.filter((s) => s.scraperHealth.consecutiveFailures >= 3);
      const orgCount = orgsInCity.length;

      return {
        cityId,
        sources: sources.length,
        orgs: orgCount,
        sessions: sessions.length,
        // Pipeline stats
        pipelineStats: {
          directories: {
            total: directories.length,
            crawled: directories.filter((d) => d.status === 'crawled').length,
            pending: directories.filter((d) => d.status === 'discovered' || d.status === 'crawling').length,
          },
          organizations: {
            total: orgCount,
            withScrapers: activeSources.length,
            percentWithScrapers: orgCount > 0 ? Math.round((activeSources.length / orgCount) * 100) : 0,
          },
          scrapers: {
            total: sources.length,
            healthy: healthySources.length,
            failing: failingSources.length,
            pendingDev: 0, // Lightweight — skip dev request count in list view
          },
          sessions: {
            total: sessions.length,
            active: sessions.filter((s) => s.status === 'active').length,
          },
        },
      };
    });

    const allStats = await Promise.all(statsPromises);
    const statsByCityId = new Map(allStats.map((s) => [s.cityId, s]));

    return markets.map((market) => {
      const dbRecord = recordsByKey.get(market.key);
      const stats = dbRecord?.cityId ? statsByCityId.get(dbRecord.cityId) : null;

      return {
        ...market,
        // DB fields (or defaults)
        dbId: dbRecord?._id,
        selectedDomain: dbRecord?.selectedDomain,
        domainPurchased: dbRecord?.domainPurchased ?? false,
        domainPurchasedAt: dbRecord?.domainPurchasedAt,
        dnsConfigured: dbRecord?.dnsConfigured ?? false,
        netlifyZoneId: dbRecord?.netlifyZoneId,
        cityId: dbRecord?.cityId,
        status: dbRecord?.status ?? 'not_started',
        createdAt: dbRecord?.createdAt,
        updatedAt: dbRecord?.updatedAt,
        // Multiple domains
        domains: dbRecord?.domains,
        // Stats
        stats: stats
          ? {
              sources: stats.sources,
              orgs: stats.orgs,
              sessions: stats.sessions,
            }
          : null,
        // Pipeline stats
        pipelineStats: stats?.pipelineStats ?? null,
        // Icons
        iconOptions: dbRecord?.iconOptions,
        iconPrompt: dbRecord?.iconPrompt,
        selectedIconStorageId: dbRecord?.selectedIconStorageId,
        selectedIconSourceUrl: dbRecord?.selectedIconSourceUrl,
      };
    });
  },
});

/**
 * Get a single expansion market with full details
 */
export const getExpansionMarket = query({
  args: {
    marketKey: v.string(),
  },
  handler: async (ctx, args) => {
    const staticMarket = getExpansionMarketByKey(args.marketKey);
    if (!staticMarket) {
      return null;
    }

    const dbRecord = await ctx.db
      .query('expansionMarkets')
      .withIndex('by_market_key', (q) => q.eq('marketKey', args.marketKey))
      .unique();

    // If we have a city, fetch its details
    let city = null;
    if (dbRecord?.cityId) {
      city = await ctx.db.get(dbRecord.cityId);
    }

    return {
      ...staticMarket,
      dbId: dbRecord?._id,
      selectedDomain: dbRecord?.selectedDomain,
      domainPurchased: dbRecord?.domainPurchased ?? false,
      domainPurchasedAt: dbRecord?.domainPurchasedAt,
      porkbunOrderId: dbRecord?.porkbunOrderId,
      dnsConfigured: dbRecord?.dnsConfigured ?? false,
      netlifyZoneId: dbRecord?.netlifyZoneId,
      cityId: dbRecord?.cityId,
      city,
      domains: dbRecord?.domains,
      status: dbRecord?.status ?? 'not_started',
      createdAt: dbRecord?.createdAt,
      updatedAt: dbRecord?.updatedAt,
    };
  },
});

/**
 * Get pipeline stats for a specific market's city
 */
export const getMarketPipelineStats = query({
  args: {
    cityId: v.id('cities'),
  },
  handler: async (ctx, args) => {
    // Directories
    const directories = await ctx.db
      .query('directories')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();

    const dirStats = {
      total: directories.length,
      crawled: directories.filter((d) => d.status === 'crawled').length,
      pending: directories.filter((d) => d.status === 'discovered' || d.status === 'crawling').length,
      failed: directories.filter((d) => d.status === 'failed').length,
    };

    // Organizations (all orgs in this city)
    const allOrgs = await ctx.db.query('organizations').collect();
    const orgsInCity = allOrgs.filter((org) => org.cityIds.includes(args.cityId));

    // Scrapers
    const sources = await ctx.db
      .query('scrapeSources')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();

    const activeSources = sources.filter((s) => s.isActive && (s.scraperCode || s.scraperModule));
    const healthySources = activeSources.filter((s) => s.scraperHealth.consecutiveFailures < 3);
    const failingSources = activeSources.filter((s) => s.scraperHealth.consecutiveFailures >= 3);

    // Pending dev requests
    const devRequests = await ctx.db
      .query('scraperDevelopmentRequests')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();
    const pendingDev = devRequests.filter((r) =>
      ['pending', 'in_progress', 'testing'].includes(r.status),
    ).length;

    // Sessions
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId))
      .collect();
    const activeSessions = sessions.filter((s) => s.status === 'active');

    const orgCount = orgsInCity.length;
    const withScrapers = activeSources.length;

    // Overall health
    let overallHealth: 'good' | 'warning' | 'critical' = 'good';
    if (failingSources.length > activeSources.length * 0.3) {
      overallHealth = 'critical';
    } else if (failingSources.length > 0 || pendingDev > activeSources.length * 0.5) {
      overallHealth = 'warning';
    }

    return {
      directories: dirStats,
      organizations: {
        total: orgCount,
        withScrapers,
        percentWithScrapers: orgCount > 0 ? Math.round((withScrapers / orgCount) * 100) : 0,
      },
      scrapers: {
        total: sources.length,
        healthy: healthySources.length,
        failing: failingSources.length,
        pendingDev,
      },
      sessions: {
        total: sessions.length,
        active: activeSessions.length,
      },
      overallHealth,
    };
  },
});

/**
 * Get summary stats for the expansion dashboard
 */
export const getExpansionSummary = query({
  args: {},
  handler: async (ctx) => {
    const dbRecords = await ctx.db.query('expansionMarkets').collect();

    const launched = dbRecords.filter((r) => r.status === 'launched').length;
    const inProgress = dbRecords.filter((r) => r.status !== 'not_started' && r.status !== 'launched').length;
    const notStarted =
      EXPANSION_MARKETS.length - dbRecords.length + dbRecords.filter((r) => r.status === 'not_started').length;

    // Count by tier
    const tier1Total = EXPANSION_MARKETS.filter((m) => m.tier === 1).length;
    const tier2Total = EXPANSION_MARKETS.filter((m) => m.tier === 2).length;
    const tier3Total = EXPANSION_MARKETS.filter((m) => m.tier === 3).length;

    const tier1Launched = dbRecords.filter((r) => {
      const market = getExpansionMarketByKey(r.marketKey);
      return market?.tier === 1 && r.status === 'launched';
    }).length;
    const tier2Launched = dbRecords.filter((r) => {
      const market = getExpansionMarketByKey(r.marketKey);
      return market?.tier === 2 && r.status === 'launched';
    }).length;
    const tier3Launched = dbRecords.filter((r) => {
      const market = getExpansionMarketByKey(r.marketKey);
      return market?.tier === 3 && r.status === 'launched';
    }).length;

    return {
      total: EXPANSION_MARKETS.length,
      launched,
      inProgress,
      notStarted,
      tiers: {
        tier1: { total: tier1Total, launched: tier1Launched },
        tier2: { total: tier2Total, launched: tier2Launched },
        tier3: { total: tier3Total, launched: tier3Launched },
      },
    };
  },
});
