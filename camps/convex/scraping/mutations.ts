import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Create an admin alert
 */
export const createAlert = mutation({
  args: {
    sourceId: v.optional(v.id("scrapeSources")),
    alertType: v.union(
      v.literal("scraper_disabled"),
      v.literal("scraper_degraded"),
      v.literal("high_change_volume"),
      v.literal("scraper_needs_regeneration"),
      v.literal("new_sources_pending"),
      v.literal("zero_results"),
      v.literal("rate_limited"),
      v.literal("source_recovered"),
      v.literal("cross_source_duplicates")
    ),
    message: v.string(),
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("error"),
      v.literal("critical")
    ),
  },
  handler: async (ctx, args) => {
    // Validate source exists if provided
    if (args.sourceId) {
      const source = await ctx.db.get(args.sourceId);
      if (!source) {
        throw new Error("Scrape source not found");
      }
    }

    const alertId = await ctx.db.insert("scraperAlerts", {
      sourceId: args.sourceId,
      alertType: args.alertType,
      message: args.message,
      severity: args.severity,
      createdAt: Date.now(),
      acknowledgedAt: undefined,
      acknowledgedBy: undefined,
    });

    return alertId;
  },
});

/**
 * Acknowledge an alert
 */
export const acknowledgeAlert = mutation({
  args: {
    alertId: v.id("scraperAlerts"),
    acknowledgedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }

    if (alert.acknowledgedAt !== undefined) {
      throw new Error("Alert already acknowledged");
    }

    await ctx.db.patch(args.alertId, {
      acknowledgedAt: Date.now(),
      acknowledgedBy: args.acknowledgedBy ?? "system",
    });

    return args.alertId;
  },
});

/**
 * Update organization logo with storage ID
 */
export const updateOrganizationLogo = mutation({
  args: {
    organizationId: v.id("organizations"),
    logoUrl: v.string(),
    logoStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.organizationId, {
      logoUrl: args.logoUrl,
      logoStorageId: args.logoStorageId,
    });
    return args.organizationId;
  },
});

/**
 * Link an organization to a scrape source
 */
export const linkOrganizationToSource = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sourceId, {
      organizationId: args.organizationId,
    });
    return args.sourceId;
  },
});

/**
 * Update parsing notes for a source
 * These notes guide the scraper on how to parse the site
 */
export const updateParsingNotes = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    parsingNotes: v.string(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    await ctx.db.patch(args.sourceId, {
      parsingNotes: args.parsingNotes,
      parsingNotesUpdatedAt: Date.now(),
    });

    return args.sourceId;
  },
});

/**
 * Add an additional URL to a source
 */
export const addAdditionalUrl = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    url: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    const additionalUrls = source.additionalUrls || [];

    // Check for duplicates
    if (additionalUrls.some(u => u.url === args.url)) {
      throw new Error("URL already exists");
    }

    additionalUrls.push({
      url: args.url,
      label: args.label,
    });

    await ctx.db.patch(args.sourceId, {
      additionalUrls,
    });

    return args.sourceId;
  },
});

/**
 * Remove an additional URL from a source
 */
export const removeAdditionalUrl = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    const additionalUrls = (source.additionalUrls || []).filter(
      u => u.url !== args.url
    );

    await ctx.db.patch(args.sourceId, {
      additionalUrls,
    });

    return args.sourceId;
  },
});

/**
 * Refresh the organization logo for a source
 * This queues a job to re-fetch the logo from the organization's website
 */
export const refreshSourceLogo = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    if (!source.organizationId) {
      throw new Error("Source has no linked organization");
    }

    const organization = await ctx.db.get(source.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Clear existing logo to trigger re-fetch
    await ctx.db.patch(source.organizationId, {
      logoUrl: undefined,
      logoStorageId: undefined,
    });

    return args.sourceId;
  },
});
