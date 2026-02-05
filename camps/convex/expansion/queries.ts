import { query } from "../_generated/server";
import { v } from "convex/values";
import { EXPANSION_MARKETS, getExpansionMarketByKey } from "../../lib/expansionMarkets";

/**
 * List all expansion markets with their DB status merged
 */
export const listExpansionMarkets = query({
  args: {
    tier: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get all expansion market records from DB
    const dbRecords = await ctx.db.query("expansionMarkets").collect();
    const recordsByKey = new Map(dbRecords.map((r) => [r.marketKey, r]));

    // Merge with static market data
    let markets = EXPANSION_MARKETS;
    if (args.tier) {
      markets = markets.filter((m) => m.tier === args.tier);
    }

    return markets.map((market) => {
      const dbRecord = recordsByKey.get(market.key);
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
        status: dbRecord?.status ?? "not_started",
        createdAt: dbRecord?.createdAt,
        updatedAt: dbRecord?.updatedAt,
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
      .query("expansionMarkets")
      .withIndex("by_market_key", (q) => q.eq("marketKey", args.marketKey))
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
      status: dbRecord?.status ?? "not_started",
      createdAt: dbRecord?.createdAt,
      updatedAt: dbRecord?.updatedAt,
    };
  },
});

/**
 * Get summary stats for the expansion dashboard
 */
export const getExpansionSummary = query({
  args: {},
  handler: async (ctx) => {
    const dbRecords = await ctx.db.query("expansionMarkets").collect();

    const launched = dbRecords.filter((r) => r.status === "launched").length;
    const inProgress = dbRecords.filter(
      (r) => r.status !== "not_started" && r.status !== "launched"
    ).length;
    const notStarted = EXPANSION_MARKETS.length - dbRecords.length +
      dbRecords.filter((r) => r.status === "not_started").length;

    // Count by tier
    const tier1Total = EXPANSION_MARKETS.filter((m) => m.tier === 1).length;
    const tier2Total = EXPANSION_MARKETS.filter((m) => m.tier === 2).length;
    const tier3Total = EXPANSION_MARKETS.filter((m) => m.tier === 3).length;

    const tier1Launched = dbRecords.filter((r) => {
      const market = getExpansionMarketByKey(r.marketKey);
      return market?.tier === 1 && r.status === "launched";
    }).length;
    const tier2Launched = dbRecords.filter((r) => {
      const market = getExpansionMarketByKey(r.marketKey);
      return market?.tier === 2 && r.status === "launched";
    }).length;
    const tier3Launched = dbRecords.filter((r) => {
      const market = getExpansionMarketByKey(r.marketKey);
      return market?.tier === 3 && r.status === "launched";
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
