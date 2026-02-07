import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { validateScraperCode, getBuiltInScraperForUrl } from "./scraperCodeValidation";

// Validators for scraper config matching schema.ts
const scraperConfigValidator = v.object({
  version: v.number(),
  generatedAt: v.number(),
  generatedBy: v.union(v.literal("claude"), v.literal("manual")),

  entryPoints: v.array(
    v.object({
      url: v.string(),
      type: v.union(
        v.literal("session_list"),
        v.literal("calendar"),
        v.literal("program_page")
      ),
    })
  ),

  pagination: v.optional(
    v.object({
      type: v.union(
        v.literal("next_button"),
        v.literal("load_more"),
        v.literal("page_numbers"),
        v.literal("none")
      ),
      selector: v.optional(v.string()),
    })
  ),

  sessionExtraction: v.object({
    containerSelector: v.string(),
    fields: v.object({
      name: v.object({ selector: v.string() }),
      dates: v.object({ selector: v.string(), format: v.string() }),
      price: v.optional(v.object({ selector: v.string() })),
      ageRange: v.optional(
        v.object({ selector: v.string(), pattern: v.string() })
      ),
      status: v.optional(
        v.object({
          selector: v.string(),
          soldOutIndicators: v.array(v.string()),
        })
      ),
      registrationUrl: v.optional(v.object({ selector: v.string() })),
    }),
  }),

  requiresJavaScript: v.boolean(),
  waitForSelector: v.optional(v.string()),
});

/**
 * Update scraper config (also creates version history)
 */
export const updateScraperConfig = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    scraperConfig: scraperConfigValidator,
    changeReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    const now = Date.now();

    // Deactivate previous version
    const previousVersions = await ctx.db
      .query("scraperVersions")
      .withIndex("by_source_and_active", (q) =>
        q.eq("scrapeSourceId", args.sourceId).eq("isActive", true)
      )
      .collect();

    for (const version of previousVersions) {
      await ctx.db.patch(version._id, { isActive: false });
    }

    // Create new version history entry
    await ctx.db.insert("scraperVersions", {
      scrapeSourceId: args.sourceId,
      version: args.scraperConfig.version,
      config: JSON.stringify(args.scraperConfig),
      createdAt: now,
      createdBy: args.scraperConfig.generatedBy,
      changeReason: args.changeReason ?? "Configuration update",
      isActive: true,
    });

    // Update the source with new config
    await ctx.db.patch(args.sourceId, {
      scraperConfig: args.scraperConfig,
      scraperHealth: {
        ...source.scraperHealth,
        needsRegeneration: false, // Clear the regeneration flag
      },
    });

    return args.sourceId;
  },
});

/**
 * Update scraper code for a source
 * This stores the AI-generated scraper code in the database
 *
 * Validates syntax before storing to prevent corrupted code from being saved.
 */
export const updateScraperCode = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    code: v.string(),
    skipValidation: v.optional(v.boolean()), // Escape hatch for manual fixes
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    // Validate syntax unless explicitly skipped
    if (!args.skipValidation) {
      validateScraperCode(args.code);
    }

    await ctx.db.patch(args.sourceId, {
      scraperCode: args.code,
    });

    return args.sourceId;
  },
});

/**
 * Update scraper module reference (for built-in scrapers)
 */
export const updateScraperModule = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    module: v.string(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    await ctx.db.patch(args.sourceId, {
      scraperModule: args.module,
    });

    return args.sourceId;
  },
});

/**
 * Auto-assign a built-in scraper to a source based on its URL domain.
 * Call this on existing sources to retroactively assign built-in scrapers.
 *
 * Returns true if a built-in scraper was assigned, false otherwise.
 */
export const autoAssignBuiltInScraper = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Source not found");
    }

    // Already has a scraper module assigned
    if (source.scraperModule) {
      return { assigned: false, reason: "Already has scraperModule" };
    }

    // Check if URL matches a built-in scraper
    const builtInScraper = getBuiltInScraperForUrl(source.url);
    if (!builtInScraper) {
      return { assigned: false, reason: "No matching built-in scraper for domain" };
    }

    // Assign the built-in scraper
    await ctx.db.patch(args.sourceId, {
      scraperModule: builtInScraper,
      // Schedule for immediate scrape if not already scheduled
      nextScheduledScrape: source.nextScheduledScrape ?? Date.now(),
    });

    return { assigned: true, scraperModule: builtInScraper };
  },
});

/**
 * Batch auto-assign built-in scrapers to all sources without a scraper module.
 * Returns count of sources updated.
 */
export const batchAutoAssignBuiltInScrapers = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all active sources without a scraper module
    const sources = await ctx.db
      .query("scrapeSources")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    let assignedCount = 0;
    const assignments: Array<{ sourceId: string; name: string; scraperModule: string }> = [];

    for (const source of sources) {
      // Skip if already has scraper module or scraper code
      if (source.scraperModule || source.scraperCode) {
        continue;
      }

      const builtInScraper = getBuiltInScraperForUrl(source.url);
      if (builtInScraper) {
        await ctx.db.patch(source._id, {
          scraperModule: builtInScraper,
          nextScheduledScrape: source.nextScheduledScrape ?? Date.now(),
        });
        assignedCount++;
        assignments.push({
          sourceId: source._id,
          name: source.name,
          scraperModule: builtInScraper,
        });
      }
    }

    return { assignedCount, assignments };
  },
});
