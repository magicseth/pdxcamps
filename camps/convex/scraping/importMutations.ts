/**
 * Import Mutations
 *
 * Mutations for creating records during import.
 * Separated from import.ts because mutations can't be in "use node" files.
 */

import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Create an organization
 */
export const createOrganization = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return ctx.db.insert("organizations", {
      name: args.name,
      slug,
      description: args.description,
      website: args.website,
      logoUrl: args.logoUrl,
      cityIds: [args.cityId],
      isVerified: false,
      isActive: true,
    });
  },
});

/**
 * Create a camp
 */
export const createCamp = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.string(),
    categories: v.array(v.string()),
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
    minGrade: v.optional(v.number()),
    maxGrade: v.optional(v.number()),
    website: v.optional(v.string()),
    imageUrls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return ctx.db.insert("camps", {
      organizationId: args.organizationId,
      name: args.name,
      slug,
      description: args.description,
      categories: args.categories,
      ageRequirements: {
        minAge: args.minAge,
        maxAge: args.maxAge,
        minGrade: args.minGrade,
        maxGrade: args.maxGrade,
      },
      website: args.website,
      imageUrls: args.imageUrls,
      imageStorageIds: [],
      isActive: true,
    });
  },
});

/**
 * Create a location with optional address and coordinates
 */
export const createLocation = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    cityId: v.id("cities"),
    // Optional structured address
    street: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zip: v.optional(v.string()),
    // Optional coordinates (from geocoding or source)
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("locations", {
      organizationId: args.organizationId,
      name: args.name,
      address: {
        street: args.street || "TBD",
        city: args.city || "Portland",
        state: args.state || "OR",
        zip: args.zip || "97201",
      },
      cityId: args.cityId,
      // Use provided coordinates or fall back to Portland city center
      latitude: args.latitude ?? 45.5152,
      longitude: args.longitude ?? -122.6784,
      isActive: true,
    });
  },
});

/**
 * Create a session
 */
export const createSession = mutation({
  args: {
    campId: v.id("camps"),
    locationId: v.id("locations"),
    organizationId: v.id("organizations"),
    cityId: v.id("cities"),
    startDate: v.string(),
    endDate: v.string(),
    dropOffHour: v.number(),
    dropOffMinute: v.number(),
    pickUpHour: v.number(),
    pickUpMinute: v.number(),
    price: v.number(),
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
    minGrade: v.optional(v.number()),
    maxGrade: v.optional(v.number()),
    registrationUrl: v.optional(v.string()),
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("sessions", {
      campId: args.campId,
      locationId: args.locationId,
      organizationId: args.organizationId,
      cityId: args.cityId,
      startDate: args.startDate,
      endDate: args.endDate,
      dropOffTime: { hour: args.dropOffHour, minute: args.dropOffMinute },
      pickUpTime: { hour: args.pickUpHour, minute: args.pickUpMinute },
      extendedCareAvailable: false,
      price: args.price,
      currency: "USD",
      capacity: 20,
      enrolledCount: 0,
      waitlistCount: 0,
      ageRequirements: {
        minAge: args.minAge,
        maxAge: args.maxAge,
        minGrade: args.minGrade,
        maxGrade: args.maxGrade,
      },
      status: "active",
      waitlistEnabled: true,
      externalRegistrationUrl: args.registrationUrl,
      sourceId: args.sourceId,
      lastScrapedAt: Date.now(),
    });
  },
});

/**
 * Create a session with completeness tracking (internal use)
 */
export const createSessionWithCompleteness = internalMutation({
  args: {
    campId: v.id("camps"),
    locationId: v.id("locations"),
    organizationId: v.id("organizations"),
    cityId: v.id("cities"),
    startDate: v.string(),
    endDate: v.string(),
    dropOffHour: v.number(),
    dropOffMinute: v.number(),
    pickUpHour: v.number(),
    pickUpMinute: v.number(),
    price: v.number(),
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
    minGrade: v.optional(v.number()),
    maxGrade: v.optional(v.number()),
    registrationUrl: v.optional(v.string()),
    sourceId: v.id("scrapeSources"),
    // Completeness fields
    status: v.union(v.literal("draft"), v.literal("active")),
    completenessScore: v.number(),
    missingFields: v.array(v.string()),
    dataSource: v.union(
      v.literal("scraped"),
      v.literal("manual"),
      v.literal("enhanced")
    ),
    // Capacity fields
    capacity: v.optional(v.number()),
    enrolledCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("sessions", {
      campId: args.campId,
      locationId: args.locationId,
      organizationId: args.organizationId,
      cityId: args.cityId,
      startDate: args.startDate,
      endDate: args.endDate,
      dropOffTime: { hour: args.dropOffHour, minute: args.dropOffMinute },
      pickUpTime: { hour: args.pickUpHour, minute: args.pickUpMinute },
      extendedCareAvailable: false,
      price: args.price,
      currency: "USD",
      capacity: args.capacity ?? 20,
      enrolledCount: args.enrolledCount ?? 0,
      waitlistCount: 0,
      ageRequirements: {
        minAge: args.minAge,
        maxAge: args.maxAge,
        minGrade: args.minGrade,
        maxGrade: args.maxGrade,
      },
      status: args.status,
      waitlistEnabled: true,
      externalRegistrationUrl: args.registrationUrl,
      sourceId: args.sourceId,
      lastScrapedAt: Date.now(),
      // Completeness tracking
      completenessScore: args.completenessScore,
      missingFields: args.missingFields,
      dataSource: args.dataSource,
    });
  },
});

/**
 * Create a pending session for manual review
 */
export const createPendingSession = internalMutation({
  args: {
    jobId: v.id("scrapeJobs"),
    sourceId: v.id("scrapeSources"),
    rawData: v.string(),
    partialData: v.object({
      name: v.optional(v.string()),
      dateRaw: v.optional(v.string()),
      priceRaw: v.optional(v.string()),
      ageGradeRaw: v.optional(v.string()),
      timeRaw: v.optional(v.string()),
      location: v.optional(v.string()),
      description: v.optional(v.string()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      registrationUrl: v.optional(v.string()),
    }),
    validationErrors: v.array(
      v.object({
        field: v.string(),
        error: v.string(),
        attemptedValue: v.optional(v.string()),
      })
    ),
    completenessScore: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("pendingSessions", {
      jobId: args.jobId,
      sourceId: args.sourceId,
      rawData: args.rawData,
      partialData: args.partialData,
      validationErrors: args.validationErrors,
      completenessScore: args.completenessScore,
      status: "pending_review",
      createdAt: Date.now(),
    });
  },
});

/**
 * Update a session's price (used when re-scraping finds a price for existing session)
 */
export const updateSessionPrice = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      price: args.price,
      lastScrapedAt: Date.now(),
    });
  },
});

/**
 * Update source session counts and quality metrics
 * Now queries actual session counts from database for accuracy
 */
export const updateSourceSessionCounts = internalMutation({
  args: {
    sourceId: v.id("scrapeSources"),
    dataQualityScore: v.number(),
    qualityTier: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low")
    ),
  },
  handler: async (ctx, args) => {
    // Query actual session counts from database
    const allSessions = await ctx.db
      .query("sessions")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .collect();

    const sessionCount = allSessions.length;
    const activeSessionCount = allSessions.filter(s => s.status === "active").length;

    await ctx.db.patch(args.sourceId, {
      sessionCount,
      activeSessionCount,
      dataQualityScore: args.dataQualityScore,
      qualityTier: args.qualityTier,
      lastSessionsFoundAt: sessionCount > 0 ? Date.now() : undefined,
    });
  },
});

/**
 * Update a pending session status
 */
export const updatePendingSessionStatus = mutation({
  args: {
    pendingSessionId: v.id("pendingSessions"),
    status: v.union(
      v.literal("pending_review"),
      v.literal("manually_fixed"),
      v.literal("imported"),
      v.literal("discarded")
    ),
    reviewedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pendingSessionId, {
      status: args.status,
      reviewedAt: Date.now(),
      reviewedBy: args.reviewedBy,
    });
  },
});

// ============ URL DISCOVERY MUTATIONS ============

/**
 * Record a URL check in history
 */
export const recordUrlCheck = internalMutation({
  args: {
    sourceId: v.id("scrapeSources"),
    url: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) return;

    const history = source.urlHistory || [];
    history.push({
      url: args.url,
      status: args.status,
      checkedAt: Date.now(),
    });

    // Keep only last 10 entries
    const trimmedHistory = history.slice(-10);

    await ctx.db.patch(args.sourceId, {
      urlHistory: trimmedHistory,
    });
  },
});

/**
 * Suggest a URL update for a source
 */
export const suggestUrlUpdate = internalMutation({
  args: {
    sourceId: v.id("scrapeSources"),
    suggestedUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sourceId, {
      suggestedUrl: args.suggestedUrl,
    });
  },
});

/**
 * Apply a suggested URL update
 */
export const applyUrlUpdate = internalMutation({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source?.suggestedUrl) return;

    await ctx.db.patch(args.sourceId, {
      url: source.suggestedUrl,
      suggestedUrl: undefined,
    });
  },
});

/**
 * Create an alert for suspicious zero-price pattern during import.
 * This indicates that the scraper's price extraction may be broken.
 *
 * Avoids creating duplicates by checking for recent unacknowledged alerts.
 */
export const createZeroPriceAlert = internalMutation({
  args: {
    sourceId: v.id("scrapeSources"),
    sourceName: v.string(),
    zeroPricePercent: v.number(),
    zeroPriceCount: v.number(),
    totalCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for existing unacknowledged alert for this source (within last 24 hours)
    const existingAlerts = await ctx.db
      .query("scraperAlerts")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .collect();

    const recentDuplicate = existingAlerts.some(
      (alert) =>
        alert.alertType === "scraper_degraded" &&
        alert.acknowledgedAt === undefined &&
        alert.message.includes("zero-price") &&
        alert.createdAt > Date.now() - 24 * 60 * 60 * 1000
    );

    if (recentDuplicate) {
      return { created: false, reason: "Duplicate alert exists" };
    }

    await ctx.db.insert("scraperAlerts", {
      sourceId: args.sourceId,
      alertType: "scraper_degraded",
      message: `Scraper "${args.sourceName}" has suspicious zero-price pattern: ${args.zeroPricePercent}% of sessions (${args.zeroPriceCount}/${args.totalCount}) have $0 price. Price extraction may be broken.`,
      severity: "warning",
      createdAt: Date.now(),
      acknowledgedAt: undefined,
      acknowledgedBy: undefined,
    });

    return { created: true };
  },
});
