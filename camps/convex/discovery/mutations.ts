import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Helper to extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    // Fallback for malformed URLs
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
    return match ? match[1] : url;
  }
}

/**
 * AI analysis result validator matching schema
 */
const aiAnalysisValidator = v.object({
  isLikelyCampSite: v.boolean(),
  confidence: v.number(),
  detectedCampNames: v.array(v.string()),
  hasScheduleInfo: v.boolean(),
  hasPricingInfo: v.boolean(),
  pageType: v.union(
    v.literal("camp_provider_main"),
    v.literal("camp_program_list"),
    v.literal("aggregator"),
    v.literal("directory"),
    v.literal("unknown")
  ),
  suggestedScraperApproach: v.string(),
});

/**
 * Create a new discovered source from web search results
 * Called by the discovery search action after finding new URLs
 */
export const createDiscoveredSource = mutation({
  args: {
    cityId: v.id("cities"),
    url: v.string(),
    title: v.string(),
    snippet: v.optional(v.string()),
    discoveryQuery: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify city exists
    const city = await ctx.db.get(args.cityId);
    if (!city) {
      throw new Error("City not found");
    }

    // Check if URL already exists (deduplication)
    const existingByUrl = await ctx.db
      .query("discoveredSources")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();

    if (existingByUrl) {
      return {
        success: false,
        message: "URL already discovered",
        existingSourceId: existingByUrl._id,
        created: false,
      };
    }

    const domain = extractDomain(args.url);

    const sourceId = await ctx.db.insert("discoveredSources", {
      cityId: args.cityId,
      discoveredAt: Date.now(),
      discoveryQuery: args.discoveryQuery,
      url: args.url,
      domain,
      title: args.title,
      snippet: args.snippet,
      status: "pending_analysis",
    });

    return {
      success: true,
      sourceId,
      created: true,
    };
  },
});

/**
 * Internal mutation to create discovered sources from actions
 * Used by executeDiscoverySearch action
 */
export const internalCreateDiscoveredSource = internalMutation({
  args: {
    cityId: v.id("cities"),
    url: v.string(),
    title: v.string(),
    snippet: v.optional(v.string()),
    discoveryQuery: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if URL already exists (deduplication)
    const existingByUrl = await ctx.db
      .query("discoveredSources")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();

    if (existingByUrl) {
      return { created: false, sourceId: existingByUrl._id };
    }

    const domain = extractDomain(args.url);

    const sourceId = await ctx.db.insert("discoveredSources", {
      cityId: args.cityId,
      discoveredAt: Date.now(),
      discoveryQuery: args.discoveryQuery,
      url: args.url,
      domain,
      title: args.title,
      snippet: args.snippet,
      status: "pending_analysis",
    });

    return { created: true, sourceId };
  },
});

/**
 * Store AI analysis results for a discovered source
 * Called by the analyzeDiscoveredUrl action after Claude analysis
 */
export const updateAiAnalysis = mutation({
  args: {
    sourceId: v.id("discoveredSources"),
    aiAnalysis: aiAnalysisValidator,
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Discovered source not found");
    }

    await ctx.db.patch(args.sourceId, {
      aiAnalysis: args.aiAnalysis,
      status: "pending_review",
    });

    return { success: true };
  },
});

/**
 * Internal mutation for updating AI analysis from actions
 */
export const internalUpdateAiAnalysis = internalMutation({
  args: {
    sourceId: v.id("discoveredSources"),
    aiAnalysis: aiAnalysisValidator,
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Discovered source not found");
    }

    await ctx.db.patch(args.sourceId, {
      aiAnalysis: args.aiAnalysis,
      status: "pending_review",
    });

    return { success: true };
  },
});

/**
 * Admin reviews a discovered source (approve/reject)
 */
export const reviewSource = mutation({
  args: {
    sourceId: v.id("discoveredSources"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
    reviewNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Discovered source not found");
    }

    // Validate the source is in a reviewable state
    if (
      source.status !== "pending_review" &&
      source.status !== "pending_analysis"
    ) {
      throw new Error(
        `Cannot review source with status "${source.status}". Source must be pending.`
      );
    }

    await ctx.db.patch(args.sourceId, {
      status: args.status,
      reviewedAt: Date.now(),
      // In a real app, this would be the authenticated user's ID
      reviewedBy: "admin",
      reviewNotes: args.reviewNotes,
    });

    return { success: true, newStatus: args.status };
  },
});

/**
 * Mark a discovered source as a duplicate of another
 */
export const markAsDuplicate = mutation({
  args: {
    sourceId: v.id("discoveredSources"),
    duplicateOfSourceId: v.id("discoveredSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Discovered source not found");
    }

    const duplicateOf = await ctx.db.get(args.duplicateOfSourceId);
    if (!duplicateOf) {
      throw new Error("Duplicate reference source not found");
    }

    // Prevent marking something as duplicate of itself
    if (args.sourceId === args.duplicateOfSourceId) {
      throw new Error("Cannot mark source as duplicate of itself");
    }

    await ctx.db.patch(args.sourceId, {
      status: "duplicate",
      reviewedAt: Date.now(),
      reviewedBy: "admin",
      reviewNotes: `Duplicate of source ${args.duplicateOfSourceId}`,
    });

    return { success: true };
  },
});

/**
 * Link a discovered source to a generated scrape source
 * Called after a scraper is created for this discovered source
 */
export const linkToScrapeSource = mutation({
  args: {
    sourceId: v.id("discoveredSources"),
    scrapeSourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Discovered source not found");
    }

    const scrapeSource = await ctx.db.get(args.scrapeSourceId);
    if (!scrapeSource) {
      throw new Error("Scrape source not found");
    }

    await ctx.db.patch(args.sourceId, {
      status: "scraper_generated",
      scrapeSourceId: args.scrapeSourceId,
    });

    return { success: true };
  },
});

/**
 * Internal mutation to record a discovery search
 * Called by executeDiscoverySearch action
 */
export const internalRecordSearch = internalMutation({
  args: {
    cityId: v.id("cities"),
    query: v.string(),
    resultsCount: v.number(),
    newSourcesFound: v.number(),
  },
  handler: async (ctx, args) => {
    const searchId = await ctx.db.insert("discoverySearches", {
      cityId: args.cityId,
      query: args.query,
      resultsCount: args.resultsCount,
      newSourcesFound: args.newSourcesFound,
      executedAt: Date.now(),
    });

    return { searchId };
  },
});
