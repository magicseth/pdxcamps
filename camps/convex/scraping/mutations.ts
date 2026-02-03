import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { workflow } from "./scrapeWorkflow";

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
 * Create a new scrape source
 */
export const createScrapeSource = mutation({
  args: {
    name: v.string(),
    url: v.string(),
    cityId: v.id("cities"), // Required: market this source belongs to
    organizationId: v.optional(v.id("organizations")),
    scraperConfig: scraperConfigValidator,
    scrapeFrequencyHours: v.number(),
  },
  handler: async (ctx, args) => {
    // Validate organization exists if provided
    if (args.organizationId) {
      const org = await ctx.db.get(args.organizationId);
      if (!org) {
        throw new Error("Organization not found");
      }
    }

    // Validate scrape frequency
    if (args.scrapeFrequencyHours < 1) {
      throw new Error("Scrape frequency must be at least 1 hour");
    }

    const now = Date.now();

    const sourceId = await ctx.db.insert("scrapeSources", {
      name: args.name,
      url: args.url,
      cityId: args.cityId,
      organizationId: args.organizationId,
      scraperConfig: args.scraperConfig,
      scraperHealth: {
        lastSuccessAt: undefined,
        lastFailureAt: undefined,
        consecutiveFailures: 0,
        totalRuns: 0,
        successRate: 0,
        lastError: undefined,
        needsRegeneration: false,
      },
      scrapeFrequencyHours: args.scrapeFrequencyHours,
      lastScrapedAt: undefined,
      nextScheduledScrape: now, // Schedule immediately
      isActive: true,
    });

    // Create initial version history
    await ctx.db.insert("scraperVersions", {
      scrapeSourceId: sourceId,
      version: args.scraperConfig.version,
      config: JSON.stringify(args.scraperConfig),
      createdAt: now,
      createdBy: args.scraperConfig.generatedBy,
      changeReason: "Initial configuration",
      isActive: true,
    });

    return sourceId;
  },
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
 * Create a new pending scrape job
 */
export const createScrapeJob = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    // Check if there's already a pending or running job
    const existingJob = await ctx.db
      .query("scrapeJobs")
      .withIndex("by_source_and_status", (q) =>
        q.eq("sourceId", args.sourceId).eq("status", "pending")
      )
      .first();

    if (existingJob) {
      throw new Error("A pending job already exists for this source");
    }

    const runningJob = await ctx.db
      .query("scrapeJobs")
      .withIndex("by_source_and_status", (q) =>
        q.eq("sourceId", args.sourceId).eq("status", "running")
      )
      .first();

    if (runningJob) {
      throw new Error("A job is already running for this source");
    }

    const jobId = await ctx.db.insert("scrapeJobs", {
      sourceId: args.sourceId,
      status: "pending",
      triggeredBy: args.triggeredBy,
      startedAt: undefined,
      completedAt: undefined,
      sessionsFound: undefined,
      sessionsCreated: undefined,
      sessionsUpdated: undefined,
      retryCount: 0,
      errorMessage: undefined,
    });

    // Automatically start the scraping workflow
    const workflowId = await workflow.start(
      ctx,
      internal.scraping.scrapeWorkflow.scrapeSourceWorkflow,
      {
        jobId,
        sourceId: args.sourceId,
      }
    );

    // Store workflow ID on the job
    await ctx.db.patch(jobId, {
      workflowId: workflowId as string,
    });

    return jobId;
  },
});

/**
 * Mark a job as running
 */
export const startScrapeJob = mutation({
  args: {
    jobId: v.id("scrapeJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Scrape job not found");
    }

    if (job.status !== "pending") {
      throw new Error(`Cannot start job in "${job.status}" status`);
    }

    await ctx.db.patch(args.jobId, {
      status: "running",
      startedAt: Date.now(),
    });

    return args.jobId;
  },
});

/**
 * Mark a job as completed
 */
export const completeScrapeJob = mutation({
  args: {
    jobId: v.id("scrapeJobs"),
    sessionsFound: v.number(),
    sessionsCreated: v.number(),
    sessionsUpdated: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Scrape job not found");
    }

    if (job.status !== "running") {
      throw new Error(`Cannot complete job in "${job.status}" status`);
    }

    const now = Date.now();

    await ctx.db.patch(args.jobId, {
      status: "completed",
      completedAt: now,
      sessionsFound: args.sessionsFound,
      sessionsCreated: args.sessionsCreated,
      sessionsUpdated: args.sessionsUpdated,
    });

    // Update source last scraped time
    await ctx.db.patch(job.sourceId, {
      lastScrapedAt: now,
    });

    return args.jobId;
  },
});

/**
 * Mark a job as failed and update health metrics
 */
export const failScrapeJob = mutation({
  args: {
    jobId: v.id("scrapeJobs"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Scrape job not found");
    }

    if (job.status !== "running" && job.status !== "pending") {
      throw new Error(`Cannot fail job in "${job.status}" status`);
    }

    const now = Date.now();

    await ctx.db.patch(args.jobId, {
      status: "failed",
      completedAt: now,
      errorMessage: args.errorMessage,
    });

    // Update source health metrics
    const source = await ctx.db.get(job.sourceId);
    if (source) {
      const newConsecutiveFailures = source.scraperHealth.consecutiveFailures + 1;
      const newTotalRuns = source.scraperHealth.totalRuns + 1;
      const successfulRuns = Math.round(
        source.scraperHealth.successRate * source.scraperHealth.totalRuns
      );
      const newSuccessRate = successfulRuns / newTotalRuns;

      // Flag for regeneration if too many consecutive failures
      const needsRegeneration =
        newConsecutiveFailures >= 3 || source.scraperHealth.needsRegeneration;

      await ctx.db.patch(job.sourceId, {
        scraperHealth: {
          ...source.scraperHealth,
          lastFailureAt: now,
          consecutiveFailures: newConsecutiveFailures,
          totalRuns: newTotalRuns,
          successRate: newSuccessRate,
          lastError: args.errorMessage,
          needsRegeneration,
        },
      });

      // Create alert if needed
      if (newConsecutiveFailures === 3) {
        await ctx.db.insert("scraperAlerts", {
          sourceId: job.sourceId,
          alertType: "scraper_degraded",
          message: `Scraper "${source.name}" has failed 3 times consecutively. Last error: ${args.errorMessage}`,
          severity: "warning",
          createdAt: now,
          acknowledgedAt: undefined,
          acknowledgedBy: undefined,
        });
      } else if (newConsecutiveFailures >= 5) {
        await ctx.db.insert("scraperAlerts", {
          sourceId: job.sourceId,
          alertType: "scraper_needs_regeneration",
          message: `Scraper "${source.name}" needs regeneration after ${newConsecutiveFailures} consecutive failures.`,
          severity: "error",
          createdAt: now,
          acknowledgedAt: undefined,
          acknowledgedBy: undefined,
        });
      }
    }

    return args.jobId;
  },
});

/**
 * Store raw scraped data for a job
 */
export const storeRawData = mutation({
  args: {
    jobId: v.id("scrapeJobs"),
    rawJson: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Scrape job not found");
    }

    const rawDataId = await ctx.db.insert("scrapeRawData", {
      jobId: args.jobId,
      sourceId: job.sourceId,
      rawJson: args.rawJson,
      processedAt: undefined,
      resultingSessionId: undefined,
      processingError: undefined,
    });

    return rawDataId;
  },
});

/**
 * Record a detected change during scraping
 */
export const recordChange = mutation({
  args: {
    jobId: v.id("scrapeJobs"),
    sessionId: v.optional(v.id("sessions")),
    changeType: v.union(
      v.literal("session_added"),
      v.literal("session_removed"),
      v.literal("status_changed"),
      v.literal("price_changed"),
      v.literal("dates_changed")
    ),
    previousValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Scrape job not found");
    }

    const changeId = await ctx.db.insert("scrapeChanges", {
      jobId: args.jobId,
      sourceId: job.sourceId,
      sessionId: args.sessionId,
      changeType: args.changeType,
      previousValue: args.previousValue,
      newValue: args.newValue,
      detectedAt: Date.now(),
      notified: false,
    });

    return changeId;
  },
});

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
      v.literal("new_sources_pending")
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
 * Enable or disable a scrape source
 */
export const toggleSourceActive = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    await ctx.db.patch(args.sourceId, {
      isActive: args.isActive,
    });

    // Create alert when disabling a source
    if (!args.isActive && source.isActive) {
      await ctx.db.insert("scraperAlerts", {
        sourceId: args.sourceId,
        alertType: "scraper_disabled",
        message: `Scraper "${source.name}" has been disabled.`,
        severity: "info",
        createdAt: Date.now(),
        acknowledgedAt: undefined,
        acknowledgedBy: undefined,
      });
    }

    return args.sourceId;
  },
});

/**
 * Update scraper code for a source
 * This stores the AI-generated scraper code in the database
 */
export const updateScraperCode = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
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
 * Activate a scrape source (enable scheduled scraping)
 */
export const activateScrapeSource = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    // Require either scraperModule or scraperCode
    if (!source.scraperModule && !source.scraperCode) {
      throw new Error("Cannot activate source without scraper code or module");
    }

    await ctx.db.patch(args.sourceId, {
      isActive: true,
      nextScheduledScrape: Date.now() + source.scrapeFrequencyHours * 60 * 60 * 1000,
    });

    return args.sourceId;
  },
});

/**
 * Clean up stuck/pending jobs for a source
 */
export const cleanupStuckJobs = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const stuckJobs = await ctx.db
      .query("scrapeJobs")
      .withIndex("by_source_and_status", (q) =>
        q.eq("sourceId", args.sourceId).eq("status", "pending")
      )
      .collect();

    const runningJobs = await ctx.db
      .query("scrapeJobs")
      .withIndex("by_source_and_status", (q) =>
        q.eq("sourceId", args.sourceId).eq("status", "running")
      )
      .collect();

    const allStuck = [...stuckJobs, ...runningJobs];
    
    for (const job of allStuck) {
      await ctx.db.patch(job._id, {
        status: "failed",
        completedAt: Date.now(),
        errorMessage: "Manually marked as failed (cleanup)",
      });
    }

    return { cleaned: allStuck.length };
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
 * Store image map for a job (URL -> storage ID mapping)
 */
export const storeImageMap = mutation({
  args: {
    jobId: v.id("scrapeJobs"),
    imageMap: v.record(v.string(), v.id("_storage")),
  },
  handler: async (ctx, args) => {
    // Store as raw data associated with the job
    const existingRaw = await ctx.db
      .query("scrapeRawData")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .first();

    if (existingRaw) {
      const current = JSON.parse(existingRaw.rawJson || "{}");
      current.imageMap = args.imageMap;
      await ctx.db.patch(existingRaw._id, {
        rawJson: JSON.stringify(current),
      });
    }

    return { stored: Object.keys(args.imageMap).length };
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
 * Flag a source for re-scan
 */
export const flagForRescan = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    await ctx.db.patch(args.sourceId, {
      needsRescan: true,
      rescanRequestedAt: Date.now(),
      rescanReason: args.reason,
      // Schedule for immediate scrape
      nextScheduledScrape: Date.now(),
    });

    return args.sourceId;
  },
});

/**
 * Clear the re-scan flag after scraping
 */
export const clearRescanFlag = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    await ctx.db.patch(args.sourceId, {
      needsRescan: false,
      rescanRequestedAt: undefined,
      rescanReason: undefined,
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
 * Update the main URL of a source
 */
export const updateSourceUrl = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    await ctx.db.patch(args.sourceId, {
      url: args.url,
    });

    return args.sourceId;
  },
});

/**
 * Create a simple scrape source without scraper config
 * Used by market seeding - the daemon will generate the scraper
 */
export const createScrapeSourceSimple = mutation({
  args: {
    name: v.string(),
    url: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Validate organization exists
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    // Get cityId from organization
    if (!org.cityIds || org.cityIds.length === 0) {
      throw new Error("Organization has no city assigned");
    }
    const cityId = org.cityIds[0];

    // Check if source already exists for this URL
    const existing = await ctx.db
      .query("scrapeSources")
      .filter((q) => q.eq(q.field("url"), args.url))
      .first();

    if (existing) {
      return existing._id;
    }

    const sourceId = await ctx.db.insert("scrapeSources", {
      name: args.name,
      url: args.url,
      cityId,
      organizationId: args.organizationId,
      // scraperConfig and scraperCode will be generated by daemon
      scraperHealth: {
        lastSuccessAt: undefined,
        lastFailureAt: undefined,
        consecutiveFailures: 0,
        totalRuns: 0,
        successRate: 0,
        lastError: undefined,
        needsRegeneration: false,
      },
      scrapeFrequencyHours: 24, // Daily by default
      lastScrapedAt: undefined,
      nextScheduledScrape: undefined, // Don't schedule until scraper is ready
      isActive: true,
    });

    return sourceId;
  },
});

/**
 * Update source details (name and/or URL)
 * Used for inline editing in Control Center
 */
export const updateSourceDetails = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    name: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    const updates: Record<string, string> = {};
    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.url !== undefined) {
      updates.url = args.url;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.sourceId, updates);
    }

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

/**
 * Delete a source and optionally its associated data
 */
export const deleteSourceWithData = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    deleteJobs: v.optional(v.boolean()), // Default: true
    deleteSessions: v.optional(v.boolean()), // Default: false (dangerous)
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    const deleteJobs = args.deleteJobs !== false; // Default true
    const deleteSessions = args.deleteSessions === true; // Default false

    // Delete associated scrape jobs
    if (deleteJobs) {
      const jobs = await ctx.db
        .query("scrapeJobs")
        .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
        .collect();

      for (const job of jobs) {
        // Delete raw data for each job
        const rawData = await ctx.db
          .query("scrapeRawData")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .collect();
        for (const raw of rawData) {
          await ctx.db.delete(raw._id);
        }
        await ctx.db.delete(job._id);
      }
    }

    // Delete pending sessions
    const pendingSessions = await ctx.db
      .query("pendingSessions")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .collect();
    for (const pending of pendingSessions) {
      await ctx.db.delete(pending._id);
    }

    // Delete alerts for this source
    const alerts = await ctx.db
      .query("scraperAlerts")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .collect();
    for (const alert of alerts) {
      await ctx.db.delete(alert._id);
    }

    // Delete scraper versions
    const versions = await ctx.db
      .query("scraperVersions")
      .withIndex("by_source", (q) => q.eq("scrapeSourceId", args.sourceId))
      .collect();
    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    // Delete scrape changes
    const changes = await ctx.db
      .query("scrapeChanges")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .collect();
    for (const change of changes) {
      await ctx.db.delete(change._id);
    }

    // Optionally delete sessions (dangerous!)
    if (deleteSessions) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
        .collect();
      for (const session of sessions) {
        await ctx.db.delete(session._id);
      }
    } else {
      // Just unlink sessions from this source
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
        .collect();
      for (const session of sessions) {
        await ctx.db.patch(session._id, { sourceId: undefined });
      }
    }

    // Delete the source itself
    await ctx.db.delete(args.sourceId);

    return { deleted: true };
  },
});
