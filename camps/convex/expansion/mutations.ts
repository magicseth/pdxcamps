import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getExpansionMarketByKey } from "../../lib/expansionMarkets";

/**
 * Initialize or get an expansion market tracking record
 */
export const initializeMarket = mutation({
  args: {
    marketKey: v.string(),
  },
  handler: async (ctx, args) => {
    const market = getExpansionMarketByKey(args.marketKey);
    if (!market) {
      throw new Error(`Unknown market key: ${args.marketKey}`);
    }

    // Check if already exists
    const existing = await ctx.db
      .query("expansionMarkets")
      .withIndex("by_market_key", (q) => q.eq("marketKey", args.marketKey))
      .unique();

    if (existing) {
      return { id: existing._id, created: false };
    }

    const now = Date.now();
    const id = await ctx.db.insert("expansionMarkets", {
      marketKey: args.marketKey,
      tier: market.tier,
      domainPurchased: false,
      dnsConfigured: false,
      status: "not_started",
      createdAt: now,
      updatedAt: now,
    });

    return { id, created: true };
  },
});

/**
 * Record a domain selection (before purchase)
 */
export const selectDomain = mutation({
  args: {
    marketKey: v.string(),
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("expansionMarkets")
      .withIndex("by_market_key", (q) => q.eq("marketKey", args.marketKey))
      .unique();

    if (!record) {
      throw new Error(`Market not initialized: ${args.marketKey}`);
    }

    await ctx.db.patch(record._id, {
      selectedDomain: args.domain,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Record a domain purchase result
 */
export const recordDomainPurchase = mutation({
  args: {
    marketKey: v.string(),
    domain: v.string(),
    porkbunOrderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("expansionMarkets")
      .withIndex("by_market_key", (q) => q.eq("marketKey", args.marketKey))
      .unique();

    if (!record) {
      throw new Error(`Market not initialized: ${args.marketKey}`);
    }

    const now = Date.now();
    await ctx.db.patch(record._id, {
      selectedDomain: args.domain,
      domainPurchased: true,
      domainPurchasedAt: now,
      porkbunOrderId: args.porkbunOrderId,
      status: "domain_purchased",
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Record DNS configuration result
 */
export const recordDnsConfiguration = mutation({
  args: {
    marketKey: v.string(),
    netlifyZoneId: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("expansionMarkets")
      .withIndex("by_market_key", (q) => q.eq("marketKey", args.marketKey))
      .unique();

    if (!record) {
      throw new Error(`Market not initialized: ${args.marketKey}`);
    }

    await ctx.db.patch(record._id, {
      dnsConfigured: true,
      netlifyZoneId: args.netlifyZoneId,
      status: "dns_configured",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Create city for market and link it
 */
export const createCityForMarket = mutation({
  args: {
    marketKey: v.string(),
    name: v.string(),
    slug: v.string(),
    state: v.string(),
    timezone: v.string(),
    centerLatitude: v.number(),
    centerLongitude: v.number(),
    brandName: v.string(),
    domain: v.string(),
    fromEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("expansionMarkets")
      .withIndex("by_market_key", (q) => q.eq("marketKey", args.marketKey))
      .unique();

    if (!record) {
      throw new Error(`Market not initialized: ${args.marketKey}`);
    }

    // Check if slug already exists
    const existingCity = await ctx.db
      .query("cities")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (existingCity) {
      throw new Error(`City with slug "${args.slug}" already exists`);
    }

    // Create the city
    const cityId = await ctx.db.insert("cities", {
      name: args.name,
      slug: args.slug,
      state: args.state,
      timezone: args.timezone,
      isActive: true,
      centerLatitude: args.centerLatitude,
      centerLongitude: args.centerLongitude,
      brandName: args.brandName,
      domain: args.domain,
      fromEmail: args.fromEmail,
    });

    // Link to expansion market record
    await ctx.db.patch(record._id, {
      cityId,
      status: "city_created",
      updatedAt: Date.now(),
    });

    return { cityId, success: true };
  },
});

/**
 * Link an existing city to the expansion market
 */
export const linkExistingCity = mutation({
  args: {
    marketKey: v.string(),
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("expansionMarkets")
      .withIndex("by_market_key", (q) => q.eq("marketKey", args.marketKey))
      .unique();

    if (!record) {
      throw new Error(`Market not initialized: ${args.marketKey}`);
    }

    const city = await ctx.db.get(args.cityId);
    if (!city) {
      throw new Error("City not found");
    }

    await ctx.db.patch(record._id, {
      cityId: args.cityId,
      status: "city_created",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Mark market as fully launched
 */
export const launchMarket = mutation({
  args: {
    marketKey: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("expansionMarkets")
      .withIndex("by_market_key", (q) => q.eq("marketKey", args.marketKey))
      .unique();

    if (!record) {
      throw new Error(`Market not initialized: ${args.marketKey}`);
    }

    if (!record.cityId) {
      throw new Error("Cannot launch market without a city");
    }

    await ctx.db.patch(record._id, {
      status: "launched",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Reset market status (for re-doing steps)
 */
export const resetMarketStatus = mutation({
  args: {
    marketKey: v.string(),
    status: v.union(
      v.literal("not_started"),
      v.literal("domain_purchased"),
      v.literal("dns_configured"),
      v.literal("city_created")
    ),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("expansionMarkets")
      .withIndex("by_market_key", (q) => q.eq("marketKey", args.marketKey))
      .unique();

    if (!record) {
      throw new Error(`Market not initialized: ${args.marketKey}`);
    }

    await ctx.db.patch(record._id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
