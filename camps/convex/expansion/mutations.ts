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

    // Create the city (include icon if already selected in expansion workflow)
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
      // Copy icon from expansion market if already selected
      iconStorageId: record.selectedIconStorageId,
    });

    // Link to expansion market record
    await ctx.db.patch(record._id, {
      cityId,
      status: "city_created",
      updatedAt: Date.now(),
    });

    // Auto-create market discovery task to find camp sources
    const regionName = `${args.name}, ${args.state}`;
    const searchQueries = generateMarketSearchQueries(regionName);

    await ctx.db.insert("marketDiscoveryTasks", {
      cityId,
      regionName,
      searchQueries,
      maxSearchResults: 50,
      status: "pending",
      createdAt: Date.now(),
    });

    return { cityId, success: true };
  },
});

/**
 * Generate search queries for market discovery
 */
function generateMarketSearchQueries(regionName: string): string[] {
  const currentYear = new Date().getFullYear();
  return [
    `${regionName} summer camps`,
    `${regionName} summer camps ${currentYear}`,
    `${regionName} kids day camps`,
    `${regionName} children summer programs`,
    `best summer camps in ${regionName}`,
    `${regionName} STEM camps`,
    `${regionName} sports camps`,
    `${regionName} art camps for kids`,
  ];
}

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

    // Link expansion market to city
    await ctx.db.patch(record._id, {
      cityId: args.cityId,
      status: "city_created",
      updatedAt: Date.now(),
    });

    // Copy icon from expansion market to city if one exists
    if (record.selectedIconStorageId && !city.iconStorageId) {
      await ctx.db.patch(args.cityId, {
        iconStorageId: record.selectedIconStorageId,
      });
    }

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

// Domain entry type for the domains array
const domainEntryValidator = v.object({
  domain: v.string(),
  isPrimary: v.boolean(),
  purchasedAt: v.optional(v.number()),
  orderId: v.optional(v.string()),
  dnsConfigured: v.optional(v.boolean()),
  netlifyZoneId: v.optional(v.string()),
});

/**
 * Add a purchased domain to the market's domains list
 */
export const addDomain = mutation({
  args: {
    marketKey: v.string(),
    domain: v.string(),
    orderId: v.optional(v.string()),
    makePrimary: v.optional(v.boolean()),
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
    const existingDomains = record.domains || [];

    // Check if domain already exists
    if (existingDomains.some(d => d.domain === args.domain)) {
      throw new Error(`Domain ${args.domain} already registered for this market`);
    }

    // If this is the first domain or makePrimary is true, make it primary
    const isFirstDomain = existingDomains.length === 0;
    const shouldBePrimary = args.makePrimary || isFirstDomain;

    // If making this primary, unset primary on others
    const updatedDomains = shouldBePrimary
      ? existingDomains.map(d => ({ ...d, isPrimary: false }))
      : existingDomains;

    const newDomain = {
      domain: args.domain,
      isPrimary: shouldBePrimary,
      purchasedAt: now,
      orderId: args.orderId,
      dnsConfigured: false,
    };

    await ctx.db.patch(record._id, {
      domains: [...updatedDomains, newDomain],
      // Also update legacy fields for backwards compatibility
      selectedDomain: shouldBePrimary ? args.domain : record.selectedDomain,
      domainPurchased: true,
      domainPurchasedAt: isFirstDomain ? now : record.domainPurchasedAt,
      porkbunOrderId: isFirstDomain ? args.orderId : record.porkbunOrderId,
      status: record.status === "not_started" ? "domain_purchased" : record.status,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Remove a domain from the market
 */
export const removeDomain = mutation({
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

    const existingDomains = record.domains || [];
    const domainToRemove = existingDomains.find(d => d.domain === args.domain);

    if (!domainToRemove) {
      throw new Error(`Domain ${args.domain} not found for this market`);
    }

    const updatedDomains = existingDomains.filter(d => d.domain !== args.domain);

    // If we removed the primary, make the first remaining domain primary
    if (domainToRemove.isPrimary && updatedDomains.length > 0) {
      updatedDomains[0].isPrimary = true;
    }

    const newPrimaryDomain = updatedDomains.find(d => d.isPrimary)?.domain;

    await ctx.db.patch(record._id, {
      domains: updatedDomains,
      selectedDomain: newPrimaryDomain,
      domainPurchased: updatedDomains.length > 0,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Set a domain as the primary domain for the market
 */
export const setPrimaryDomain = mutation({
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

    const existingDomains = record.domains || [];
    const targetDomain = existingDomains.find(d => d.domain === args.domain);

    if (!targetDomain) {
      throw new Error(`Domain ${args.domain} not found for this market`);
    }

    // Update all domains: unset primary on others, set on target
    const updatedDomains = existingDomains.map(d => ({
      ...d,
      isPrimary: d.domain === args.domain,
    }));

    await ctx.db.patch(record._id, {
      domains: updatedDomains,
      selectedDomain: args.domain,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Record DNS configuration for a specific domain
 */
export const recordDomainDnsConfiguration = mutation({
  args: {
    marketKey: v.string(),
    domain: v.string(),
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

    const existingDomains = record.domains || [];
    const targetIndex = existingDomains.findIndex(d => d.domain === args.domain);

    if (targetIndex === -1) {
      throw new Error(`Domain ${args.domain} not found for this market`);
    }

    const updatedDomains = [...existingDomains];
    updatedDomains[targetIndex] = {
      ...updatedDomains[targetIndex],
      dnsConfigured: true,
      netlifyZoneId: args.netlifyZoneId,
    };

    // Check if primary domain has DNS configured
    const primaryDomain = updatedDomains.find(d => d.isPrimary);
    const primaryDnsConfigured = primaryDomain?.dnsConfigured || false;

    await ctx.db.patch(record._id, {
      domains: updatedDomains,
      // Update legacy field if this is the primary domain
      dnsConfigured: primaryDnsConfigured,
      netlifyZoneId: primaryDomain?.netlifyZoneId || record.netlifyZoneId,
      status: primaryDnsConfigured && record.status === "domain_purchased"
        ? "dns_configured"
        : record.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
