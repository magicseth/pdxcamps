import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Shared validators
const ageRangeValidator = v.object({
  minAge: v.optional(v.number()),
  maxAge: v.optional(v.number()),
  minGrade: v.optional(v.number()), // K=0, 1st=1, Pre-K=-1
  maxGrade: v.optional(v.number()),
});

const timeValidator = v.object({
  hour: v.number(), // 0-23
  minute: v.number(), // 0-59
});

const addressValidator = v.object({
  street: v.string(),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
});

export default defineSchema({
  // ============ GEOGRAPHY ============

  cities: defineTable({
    name: v.string(),
    slug: v.string(),
    state: v.string(),
    timezone: v.string(),
    isActive: v.boolean(),
    centerLatitude: v.number(),
    centerLongitude: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_is_active", ["isActive"]),

  neighborhoods: defineTable({
    cityId: v.id("cities"),
    name: v.string(),
    slug: v.string(),
    boundingBox: v.optional(
      v.object({
        northLat: v.number(),
        southLat: v.number(),
        eastLng: v.number(),
        westLng: v.number(),
      })
    ),
  })
    .index("by_city", ["cityId"])
    .index("by_city_and_slug", ["cityId", "slug"]),

  // ============ USERS & FAMILIES ============

  families: defineTable({
    workosUserId: v.string(),
    email: v.string(),
    displayName: v.string(),
    primaryCityId: v.id("cities"),
    homeNeighborhoodId: v.optional(v.id("neighborhoods")),
    homeAddress: v.optional(addressValidator),
    maxDriveTimeMinutes: v.optional(v.number()),
    calendarSharingDefault: v.union(
      v.literal("private"),
      v.literal("friends_only"),
      v.literal("public")
    ),
    onboardingCompletedAt: v.optional(v.number()),
  })
    .index("by_workos_user_id", ["workosUserId"])
    .index("by_email", ["email"])
    .index("by_primary_city", ["primaryCityId"]),

  children: defineTable({
    familyId: v.id("families"),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    birthdate: v.string(), // ISO date "2018-05-15"
    currentGrade: v.optional(v.number()),
    interests: v.array(v.string()),
    notes: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    isActive: v.boolean(),
  })
    .index("by_family", ["familyId"])
    .index("by_family_and_active", ["familyId", "isActive"]),

  // ============ ORGANIZATIONS & CAMPS ============

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    website: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    description: v.optional(v.string()),
    // Logo - source URL from scraping and stored file
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    cityIds: v.array(v.id("cities")),
    isVerified: v.boolean(),
    isActive: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_is_active", ["isActive"]),

  camps: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    categories: v.array(v.string()),
    ageRequirements: ageRangeValidator,
    typicalPriceRange: v.optional(
      v.object({
        min: v.number(),
        max: v.number(),
        currency: v.string(),
      })
    ),
    // Website URL for camp info/registration
    website: v.optional(v.string()),
    // Images - source URLs from scraping and stored files
    imageUrls: v.optional(v.array(v.string())),
    imageStorageIds: v.array(v.id("_storage")),
    isActive: v.boolean(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_slug", ["slug"])
    .searchIndex("search_camps", {
      searchField: "description",
      filterFields: ["organizationId", "isActive"],
    }),

  locations: defineTable({
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    address: addressValidator,
    cityId: v.id("cities"),
    neighborhoodId: v.optional(v.id("neighborhoods")),
    latitude: v.number(),
    longitude: v.number(),
    parkingNotes: v.optional(v.string()),
    accessibilityNotes: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_city", ["cityId"])
    .index("by_city_and_active", ["cityId", "isActive"])
    .index("by_organization", ["organizationId"]),

  // ============ SESSIONS (Core Entity) ============

  sessions: defineTable({
    campId: v.id("camps"),
    locationId: v.id("locations"),
    // Denormalized for query efficiency
    organizationId: v.id("organizations"),
    cityId: v.id("cities"),

    // Denormalized fields for search results
    campName: v.optional(v.string()),
    campCategories: v.optional(v.array(v.string())),
    organizationName: v.optional(v.string()),
    locationName: v.optional(v.string()),
    locationAddress: v.optional(addressValidator),

    // Dates
    startDate: v.string(), // "2024-06-15"
    endDate: v.string(),

    // Daily schedule
    dropOffTime: timeValidator,
    pickUpTime: timeValidator,

    // Extended care
    extendedCareAvailable: v.boolean(),
    extendedCareDetails: v.optional(
      v.object({
        earlyDropOffTime: v.optional(timeValidator),
        latePickUpTime: v.optional(timeValidator),
        additionalCost: v.optional(v.number()),
      })
    ),

    // Pricing (cents to avoid float issues)
    price: v.number(),
    currency: v.string(),

    // Capacity (denormalized counts)
    capacity: v.number(),
    enrolledCount: v.number(),
    waitlistCount: v.number(),

    // Requirements
    ageRequirements: ageRangeValidator,

    // Status
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("sold_out"),
      v.literal("cancelled"),
      v.literal("completed")
    ),

    // Waitlist
    waitlistEnabled: v.boolean(),
    waitlistCapacity: v.optional(v.number()),

    // External registration
    externalRegistrationUrl: v.optional(v.string()),

    // Scraping source
    sourceId: v.optional(v.id("scrapeSources")),
    lastScrapedAt: v.optional(v.number()),
  })
    .index("by_camp", ["campId"])
    .index("by_city_and_status", ["cityId", "status"])
    .index("by_city_and_start_date", ["cityId", "startDate"])
    .index("by_city_and_status_and_start_date", ["cityId", "status", "startDate"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_location", ["locationId"])
    .index("by_source", ["sourceId"]),

  // ============ FAMILY EVENTS (Planner) ============

  familyEvents: defineTable({
    familyId: v.id("families"),
    childIds: v.array(v.id("children")),
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(), // "2024-06-15"
    endDate: v.string(),
    eventType: v.union(
      v.literal("vacation"),
      v.literal("family_visit"),
      v.literal("day_camp"),
      v.literal("summer_school"),
      v.literal("other")
    ),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_family", ["familyId"])
    .index("by_family_and_active", ["familyId", "isActive"])
    .index("by_family_and_dates", ["familyId", "startDate", "endDate"]),

  // ============ REGISTRATIONS ============

  registrations: defineTable({
    familyId: v.id("families"),
    childId: v.id("children"),
    sessionId: v.id("sessions"),
    status: v.union(
      v.literal("interested"),
      v.literal("waitlisted"),
      v.literal("registered"),
      v.literal("cancelled")
    ),
    waitlistPosition: v.optional(v.number()),
    registeredAt: v.optional(v.number()),
    externalConfirmationCode: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_family", ["familyId"])
    .index("by_family_and_status", ["familyId", "status"])
    .index("by_child", ["childId"])
    .index("by_session", ["sessionId"])
    .index("by_session_and_status", ["sessionId", "status"])
    .index("by_child_and_session", ["childId", "sessionId"]),

  // ============ SOCIAL ============

  friendships: defineTable({
    requesterId: v.id("families"),
    addresseeId: v.id("families"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("blocked")
    ),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_requester", ["requesterId"])
    .index("by_addressee", ["addresseeId"])
    .index("by_requester_and_status", ["requesterId", "status"])
    .index("by_addressee_and_status", ["addresseeId", "status"])
    .index("by_requester_and_addressee", ["requesterId", "addresseeId"]),

  calendarShares: defineTable({
    ownerFamilyId: v.id("families"),
    sharedWithFamilyId: v.id("families"),
    childIds: v.array(v.id("children")),
    permission: v.union(v.literal("view_sessions"), v.literal("view_details")),
    isActive: v.boolean(),
  })
    .index("by_owner", ["ownerFamilyId"])
    .index("by_shared_with", ["sharedWithFamilyId"]),

  // ============ DISCOVERY PIPELINE ============

  // Candidate camp sources discovered via web search
  discoveredSources: defineTable({
    cityId: v.id("cities"),
    discoveredAt: v.number(),
    discoveryQuery: v.string(),
    url: v.string(),
    domain: v.string(),
    title: v.string(),
    snippet: v.optional(v.string()),

    // AI analysis results
    aiAnalysis: v.optional(
      v.object({
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
      })
    ),

    status: v.union(
      v.literal("pending_analysis"),
      v.literal("pending_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("scraper_generated"),
      v.literal("duplicate")
    ),
    reviewedBy: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),
    scrapeSourceId: v.optional(v.id("scrapeSources")),
  })
    .index("by_city_and_status", ["cityId", "status"])
    .index("by_status", ["status"])
    .index("by_domain", ["domain"])
    .index("by_url", ["url"]),

  // Search query history for analytics
  discoverySearches: defineTable({
    cityId: v.id("cities"),
    query: v.string(),
    resultsCount: v.number(),
    newSourcesFound: v.number(),
    executedAt: v.number(),
  })
    .index("by_city", ["cityId"])
    .index("by_executed_at", ["executedAt"]),

  // ============ SCRAPING ============

  scrapeSources: defineTable({
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    url: v.string(),

    // Scraper module name (e.g., "omsi", "portland-parks")
    // References convex/scraping/scrapers/{module}.ts
    scraperModule: v.optional(v.string()),

    // Scraper code - stored directly for AI-generated scrapers
    // This is the actual TypeScript code that will be executed
    scraperCode: v.optional(v.string()),

    // AI-generated scraper configuration (legacy/fallback)
    scraperConfig: v.object({
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
    }),

    // Health tracking
    scraperHealth: v.object({
      lastSuccessAt: v.optional(v.number()),
      lastFailureAt: v.optional(v.number()),
      consecutiveFailures: v.number(),
      totalRuns: v.number(),
      successRate: v.number(),
      lastError: v.optional(v.string()),
      needsRegeneration: v.boolean(),
    }),

    scrapeFrequencyHours: v.number(),
    lastScrapedAt: v.optional(v.number()),
    nextScheduledScrape: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_next_scheduled_scrape", ["nextScheduledScrape"])
    .index("by_is_active", ["isActive"]),

  // Scraper version history for rollback
  scraperVersions: defineTable({
    scrapeSourceId: v.id("scrapeSources"),
    version: v.number(),
    config: v.string(), // JSON
    createdAt: v.number(),
    createdBy: v.string(),
    changeReason: v.string(),
    isActive: v.boolean(),
  })
    .index("by_source", ["scrapeSourceId"])
    .index("by_source_and_active", ["scrapeSourceId", "isActive"]),

  scrapeJobs: defineTable({
    sourceId: v.id("scrapeSources"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    triggeredBy: v.optional(v.string()), // Manual trigger user ID
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    sessionsFound: v.optional(v.number()),
    sessionsCreated: v.optional(v.number()),
    sessionsUpdated: v.optional(v.number()),
    retryCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_source", ["sourceId"])
    .index("by_source_and_status", ["sourceId", "status"])
    .index("by_status", ["status"]),

  scrapeRawData: defineTable({
    jobId: v.id("scrapeJobs"),
    sourceId: v.id("scrapeSources"),
    rawJson: v.string(),
    processedAt: v.optional(v.number()),
    resultingSessionId: v.optional(v.id("sessions")),
    processingError: v.optional(v.string()),
  })
    .index("by_job", ["jobId"])
    .index("by_source", ["sourceId"]),

  // Change tracking for sold out detection
  scrapeChanges: defineTable({
    jobId: v.id("scrapeJobs"),
    sourceId: v.id("scrapeSources"),
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
    detectedAt: v.number(),
    notified: v.boolean(),
  })
    .index("by_source", ["sourceId"])
    .index("by_session", ["sessionId"])
    .index("by_not_notified", ["notified"]),

  // Admin alerts
  scraperAlerts: defineTable({
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
    createdAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
    acknowledgedBy: v.optional(v.string()),
  })
    .index("by_source", ["sourceId"])
    .index("by_unacknowledged", ["acknowledgedAt"])
    .index("by_severity", ["severity"]),
});
