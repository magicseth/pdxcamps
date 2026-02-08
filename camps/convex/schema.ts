import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { ageRangeValidator, timeValidator, addressValidator } from './lib/validators';

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
    // Brand info for emails and site customization
    brandName: v.optional(v.string()), // e.g., "PDX Camps", "BOS Camps"
    domain: v.optional(v.string()), // e.g., "pdxcamps.com", "boscamps.com"
    fromEmail: v.optional(v.string()), // e.g., "hello@pdxcamps.com"
    // Icon/branding assets stored in Convex storage
    iconStorageId: v.optional(v.id('_storage')), // City icon (used for favicon, PWA icon)
    headerImageStorageId: v.optional(v.id('_storage')), // Header/hero image
  })
    .index('by_slug', ['slug'])
    .index('by_is_active', ['isActive'])
    .index('by_domain', ['domain']),

  neighborhoods: defineTable({
    cityId: v.id('cities'),
    name: v.string(),
    slug: v.string(),
    boundingBox: v.optional(
      v.object({
        northLat: v.number(),
        southLat: v.number(),
        eastLng: v.number(),
        westLng: v.number(),
      }),
    ),
  })
    .index('by_city', ['cityId'])
    .index('by_city_and_slug', ['cityId', 'slug']),

  // ============ USERS & FAMILIES ============

  families: defineTable({
    workosUserId: v.string(),
    email: v.string(),
    displayName: v.string(),
    primaryCityId: v.id('cities'),
    homeNeighborhoodId: v.optional(v.id('neighborhoods')),
    homeAddress: v.optional(addressValidator),
    maxDriveTimeMinutes: v.optional(v.number()),
    calendarSharingDefault: v.union(v.literal('private'), v.literal('friends_only'), v.literal('public')),
    onboardingCompletedAt: v.optional(v.number()),
    // Referral tracking - stores the code used to refer this family
    referredByCode: v.optional(v.string()),
    // Login tracking for re-engagement emails
    lastLoginAt: v.optional(v.number()),
    // Email preferences for digest/marketing emails
    emailPreferences: v.optional(
      v.object({
        weeklyDigest: v.boolean(),
        marketingEmails: v.boolean(),
      }),
    ),
  })
    .index('by_workos_user_id', ['workosUserId'])
    .index('by_email', ['email'])
    .index('by_primary_city', ['primaryCityId']),

  // Family share links - allows sharing multiple children's plans via single URL
  familyShares: defineTable({
    familyId: v.id('families'),
    shareToken: v.string(),
    childIds: v.array(v.id('children')), // Which children are included in this share
    createdAt: v.number(),
  })
    .index('by_token', ['shareToken'])
    .index('by_family', ['familyId']),

  // ============ REFERRALS ============

  // Referral tracking - stores a family's referral code and earned credits
  referrals: defineTable({
    referrerFamilyId: v.id('families'),
    referralCode: v.string(), // 16-char hex code
    creditsEarned: v.number(), // 0-3 (max 3 credits)
    creditsApplied: v.number(), // Credits already used via Stripe
    createdAt: v.number(),
  })
    .index('by_referrer', ['referrerFamilyId'])
    .index('by_code', ['referralCode']),

  // Referral events - tracks each referral and its status
  referralEvents: defineTable({
    referralCode: v.string(),
    referrerFamilyId: v.id('families'),
    refereeFamilyId: v.id('families'),
    status: v.union(v.literal('pending'), v.literal('completed')),
    creditAppliedAt: v.optional(v.number()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_referee', ['refereeFamilyId'])
    .index('by_referrer', ['referrerFamilyId']),

  children: defineTable({
    familyId: v.id('families'),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    birthdate: v.string(), // ISO date "2018-05-15"
    currentGrade: v.optional(v.number()),
    interests: v.array(v.string()),
    notes: v.optional(v.string()),
    avatarStorageId: v.optional(v.id('_storage')),
    isActive: v.boolean(),
    // Display color for calendar/planner views
    color: v.optional(v.string()),
    // Shareable plan token - allows public viewing of this child's summer plan
    shareToken: v.optional(v.string()),
    // Custom summer date range (defaults to June 1 - Aug 31 if not set)
    summerStartDate: v.optional(v.string()), // ISO date "2025-06-15"
    summerEndDate: v.optional(v.string()), // ISO date "2025-08-22"
  })
    .index('by_family', ['familyId'])
    .index('by_family_and_active', ['familyId', 'isActive'])
    .index('by_share_token', ['shareToken']),

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
    logoStorageId: v.optional(v.id('_storage')),
    cityIds: v.array(v.id('cities')),
    isVerified: v.boolean(),
    isActive: v.boolean(),
    // Contact extraction tracking - prevents retrying the same orgs
    contactExtractionAttemptedAt: v.optional(v.number()),
    // Directory discovery tracking
    discoveredFromDirectoryId: v.optional(v.id('directories')),
  })
    .index('by_slug', ['slug'])
    .index('by_is_active', ['isActive'])
    .index('by_email', ['email'])
    .index('by_directory', ['discoveredFromDirectoryId']),

  camps: defineTable({
    organizationId: v.id('organizations'),
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
      }),
    ),
    // Website URL for camp info/registration
    website: v.optional(v.string()),
    // Images - source URLs from scraping and stored files
    imageUrls: v.optional(v.array(v.string())),
    imageStorageIds: v.array(v.id('_storage')),
    // Custom style prompt for AI image generation (overrides auto-generated style)
    imageStylePrompt: v.optional(v.string()),
    isActive: v.boolean(),
    // Featured camps show on the landing page
    isFeatured: v.optional(v.boolean()),
  })
    .index('by_organization', ['organizationId'])
    .index('by_slug', ['slug'])
    .index('by_featured', ['isFeatured', 'isActive'])
    .index('by_is_active', ['isActive'])
    .searchIndex('search_camps', {
      searchField: 'description',
      filterFields: ['organizationId', 'isActive'],
    }),

  locations: defineTable({
    organizationId: v.optional(v.id('organizations')),
    name: v.string(),
    address: addressValidator,
    cityId: v.id('cities'),
    neighborhoodId: v.optional(v.id('neighborhoods')),
    latitude: v.number(),
    longitude: v.number(),
    parkingNotes: v.optional(v.string()),
    accessibilityNotes: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index('by_city', ['cityId'])
    .index('by_city_and_active', ['cityId', 'isActive'])
    .index('by_organization', ['organizationId'])
    .index('by_is_active', ['isActive']),

  // ============ SESSIONS (Core Entity) ============

  sessions: defineTable({
    campId: v.id('camps'),
    locationId: v.id('locations'),
    // Denormalized for query efficiency
    organizationId: v.id('organizations'),
    cityId: v.id('cities'),

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
    isOvernight: v.optional(v.boolean()), // True for residential/overnight camps

    // Extended care
    extendedCareAvailable: v.boolean(),
    extendedCareDetails: v.optional(
      v.object({
        earlyDropOffTime: v.optional(timeValidator),
        latePickUpTime: v.optional(timeValidator),
        additionalCost: v.optional(v.number()),
      }),
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
      v.literal('draft'),
      v.literal('active'),
      v.literal('sold_out'),
      v.literal('cancelled'),
      v.literal('completed'),
    ),

    // Waitlist
    waitlistEnabled: v.boolean(),
    waitlistCapacity: v.optional(v.number()),

    // External registration
    externalRegistrationUrl: v.optional(v.string()),

    // Scraping source
    sourceId: v.optional(v.id('scrapeSources')),
    lastScrapedAt: v.optional(v.number()),

    // Data completeness tracking
    completenessScore: v.optional(v.number()), // 0-100
    missingFields: v.optional(v.array(v.string())), // ["location", "hours"]
    dataSource: v.optional(v.union(v.literal('scraped'), v.literal('manual'), v.literal('enhanced'))),
  })
    .index('by_camp', ['campId'])
    .index('by_city_and_status', ['cityId', 'status'])
    .index('by_city_and_start_date', ['cityId', 'startDate'])
    .index('by_city_and_status_and_start_date', ['cityId', 'status', 'startDate'])
    .index('by_organization_and_status', ['organizationId', 'status'])
    .index('by_location', ['locationId'])
    .index('by_source', ['sourceId'])
    .index('by_status', ['status']),

  // ============ PRE-COMPUTED AGGREGATES ============

  // Pre-computed available session counts per week per age.
  // One document per (city, year). Recomputed after scrapes and periodically.
  // Makes planner grid load instantly instead of querying thousands of sessions.
  weeklyAvailability: defineTable({
    cityId: v.id('cities'),
    year: v.number(),
    // { [weekStart: string]: { [age: string]: number } }
    // e.g. { "2025-06-02": { "5": 12, "6": 15, "7": 15, ... } }
    counts: v.any(),
    updatedAt: v.number(),
  }).index('by_city_year', ['cityId', 'year']),

  // ============ FAMILY EVENTS (Planner) ============

  familyEvents: defineTable({
    familyId: v.id('families'),
    childIds: v.array(v.id('children')),
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(), // "2024-06-15"
    endDate: v.string(),
    eventType: v.union(
      v.literal('vacation'),
      v.literal('family_visit'),
      v.literal('day_camp'),
      v.literal('summer_school'),
      v.literal('other'),
    ),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index('by_family', ['familyId'])
    .index('by_family_and_active', ['familyId', 'isActive'])
    .index('by_family_and_dates', ['familyId', 'startDate', 'endDate']),

  // ============ CAMP REQUESTS (User-Submitted) ============

  // Requests from users to add camps not in our database
  // Triggers the scraping pipeline to find and add the camp
  campRequests: defineTable({
    familyId: v.id('families'),
    cityId: v.id('cities'),
    // What the user provided
    campName: v.string(),
    organizationName: v.optional(v.string()),
    websiteUrl: v.optional(v.string()), // If user knows the URL
    location: v.optional(v.string()), // General location hint
    notes: v.optional(v.string()),
    // Processing status
    status: v.union(
      v.literal('pending'), // Waiting to be processed
      v.literal('searching'), // Searching for the camp
      v.literal('scraping'), // Found URL, scraping
      v.literal('completed'), // Successfully added to database
      v.literal('failed'), // Could not find/scrape
      v.literal('duplicate'), // Already exists in database
    ),
    // Results
    foundUrl: v.optional(v.string()), // URL we found via search
    scrapeSourceId: v.optional(v.id('scrapeSources')),
    organizationId: v.optional(v.id('organizations')),
    errorMessage: v.optional(v.string()),
    // Metadata
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index('by_family', ['familyId'])
    .index('by_status', ['status'])
    .index('by_city_and_status', ['cityId', 'status']),

  // Custom camps (manual tracking when scraping isn't possible)
  // Used when user wants to track a camp that can't be scraped
  customCamps: defineTable({
    familyId: v.id('families'),
    childId: v.id('children'),
    // Camp details
    campName: v.string(),
    organizationName: v.optional(v.string()),
    location: v.optional(v.string()),
    website: v.optional(v.string()),
    // Schedule
    startDate: v.string(), // "2024-06-15"
    endDate: v.string(),
    dropOffTime: v.optional(v.string()), // "9:00 AM"
    pickUpTime: v.optional(v.string()), // "3:00 PM"
    // Cost
    price: v.optional(v.number()), // cents
    // Status
    status: v.union(v.literal('interested'), v.literal('registered'), v.literal('waitlisted'), v.literal('cancelled')),
    confirmationCode: v.optional(v.string()),
    notes: v.optional(v.string()),
    // Metadata
    createdAt: v.number(),
    isActive: v.boolean(),
  })
    .index('by_family', ['familyId'])
    .index('by_family_and_active', ['familyId', 'isActive'])
    .index('by_child', ['childId'])
    .index('by_child_and_active', ['childId', 'isActive']),

  // ============ REGISTRATIONS ============

  registrations: defineTable({
    familyId: v.id('families'),
    childId: v.id('children'),
    sessionId: v.id('sessions'),
    status: v.union(v.literal('interested'), v.literal('waitlisted'), v.literal('registered'), v.literal('cancelled')),
    waitlistPosition: v.optional(v.number()),
    registeredAt: v.optional(v.number()),
    externalConfirmationCode: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index('by_family', ['familyId'])
    .index('by_family_and_status', ['familyId', 'status'])
    .index('by_child', ['childId'])
    .index('by_session', ['sessionId'])
    .index('by_session_and_status', ['sessionId', 'status'])
    .index('by_child_and_session', ['childId', 'sessionId']),

  // ============ SOCIAL ============

  // Pending friend invitations for users not yet on the platform
  friendInvitations: defineTable({
    inviterFamilyId: v.id('families'),
    invitedEmail: v.string(),
    inviteToken: v.string(),
    status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('expired')),
    createdAt: v.number(),
  })
    .index('by_invited_email', ['invitedEmail', 'status'])
    .index('by_inviter', ['inviterFamilyId'])
    .index('by_token', ['inviteToken']),

  friendships: defineTable({
    requesterId: v.id('families'),
    addresseeId: v.id('families'),
    status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('declined'), v.literal('blocked')),
    acceptedAt: v.optional(v.number()),
  })
    .index('by_requester', ['requesterId'])
    .index('by_addressee', ['addresseeId'])
    .index('by_requester_and_status', ['requesterId', 'status'])
    .index('by_addressee_and_status', ['addresseeId', 'status'])
    .index('by_requester_and_addressee', ['requesterId', 'addresseeId']),

  calendarShares: defineTable({
    ownerFamilyId: v.id('families'),
    sharedWithFamilyId: v.id('families'),
    childIds: v.array(v.id('children')),
    permission: v.union(v.literal('view_sessions'), v.literal('view_details')),
    isActive: v.boolean(),
  })
    .index('by_owner', ['ownerFamilyId'])
    .index('by_shared_with', ['sharedWithFamilyId']),

  // ============ DIRECTORIES (First-class pipeline entities) ============

  directories: defineTable({
    cityId: v.id('cities'),
    name: v.string(), // "ActivityHero Portland"
    url: v.string(),
    domain: v.string(), // "activityhero.com"
    directoryType: v.union(
      v.literal('aggregator'),
      v.literal('municipal'),
      v.literal('curated_list'),
      v.literal('search_result'),
    ),
    linkPattern: v.optional(v.string()), // Regex for filtering links
    baseUrlFilter: v.optional(v.string()),
    status: v.union(
      v.literal('discovered'),
      v.literal('crawling'),
      v.literal('crawled'),
      v.literal('failed'),
      v.literal('excluded'),
    ),
    linksFound: v.optional(v.number()),
    orgsExtracted: v.optional(v.number()),
    lastCrawledAt: v.optional(v.number()),
    crawlError: v.optional(v.string()),
    discoveredFrom: v.optional(v.string()), // "market_discovery", "manual", "known_list"
    discoveryTaskId: v.optional(v.id('marketDiscoveryTasks')),
    createdAt: v.number(),
  })
    .index('by_city', ['cityId'])
    .index('by_city_and_status', ['cityId', 'status'])
    .index('by_domain', ['domain'])
    .index('by_url', ['url']),

  // ============ DISCOVERY PIPELINE ============

  // Candidate camp sources discovered via web search
  discoveredSources: defineTable({
    cityId: v.id('cities'),
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
          v.literal('camp_provider_main'),
          v.literal('camp_program_list'),
          v.literal('aggregator'),
          v.literal('directory'),
          v.literal('unknown'),
        ),
        suggestedScraperApproach: v.string(),
      }),
    ),

    status: v.union(
      v.literal('pending_analysis'),
      v.literal('pending_review'),
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('scraper_generated'),
      v.literal('duplicate'),
    ),
    reviewedBy: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),
    scrapeSourceId: v.optional(v.id('scrapeSources')),
  })
    .index('by_city_and_status', ['cityId', 'status'])
    .index('by_status', ['status'])
    .index('by_domain', ['domain'])
    .index('by_url', ['url']),

  // Search query history for analytics
  discoverySearches: defineTable({
    cityId: v.id('cities'),
    query: v.string(),
    resultsCount: v.number(),
    newSourcesFound: v.number(),
    executedAt: v.number(),
  })
    .index('by_city', ['cityId'])
    .index('by_executed_at', ['executedAt']),

  // ============ SCRAPING ============

  // ============ MARKET DISCOVERY ============

  // Tasks for discovering camp organizations in new markets via web search
  marketDiscoveryTasks: defineTable({
    // Target market
    cityId: v.id('cities'),
    regionName: v.string(), // "Phoenix, Arizona" - for search queries

    // Task state
    status: v.union(
      v.literal('pending'),
      v.literal('searching'), // Web search phase
      v.literal('discovering'), // Directory crawl phase
      v.literal('completed'),
      v.literal('failed'),
    ),

    // Search configuration
    searchQueries: v.array(v.string()), // Generated search queries
    maxSearchResults: v.optional(v.number()), // Default 50

    // Progress tracking
    searchesCompleted: v.optional(v.number()),
    directoriesFound: v.optional(v.number()),
    urlsDiscovered: v.optional(v.number()),
    orgsCreated: v.optional(v.number()),
    orgsExisted: v.optional(v.number()),
    sourcesCreated: v.optional(v.number()),

    // Results
    discoveredUrls: v.optional(
      v.array(
        v.object({
          url: v.string(),
          source: v.string(), // "google", "bing", "directory"
          title: v.optional(v.string()),
          domain: v.string(),
        }),
      ),
    ),
    directoryUrls: v.optional(v.array(v.string())), // Camp listing sites found

    // Error handling
    error: v.optional(v.string()),

    // Daemon tracking
    claimedAt: v.optional(v.number()),
    claimedBy: v.optional(v.string()), // Daemon session ID

    // Timestamps
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_status', ['status'])
    .index('by_city', ['cityId']),

  // Queue for directory URLs to be scraped and seeded
  directoryQueue: defineTable({
    cityId: v.id('cities'),
    url: v.string(),
    status: v.union(v.literal('pending'), v.literal('processing'), v.literal('completed'), v.literal('failed')),
    linkPattern: v.optional(v.string()), // Regex to filter links
    baseUrlFilter: v.optional(v.string()), // Domain filter
    error: v.optional(v.string()),
    // Results
    linksFound: v.optional(v.number()),
    orgsCreated: v.optional(v.number()),
    orgsExisted: v.optional(v.number()),
    processedAt: v.optional(v.number()),
  })
    .index('by_status', ['status'])
    .index('by_city', ['cityId'])
    .index('by_url', ['url']),

  scrapeSources: defineTable({
    organizationId: v.optional(v.id('organizations')),
    cityId: v.id('cities'), // Market this source belongs to (required)
    name: v.string(),
    url: v.string(),

    // Additional URLs for sites with multiple entry points
    // e.g., different seasons, locations, or programs
    additionalUrls: v.optional(
      v.array(
        v.object({
          url: v.string(),
          label: v.optional(v.string()), // e.g., "2026 Summer", "Eastside Location"
        }),
      ),
    ),

    // Scraper module name (e.g., "omsi", "portland-parks")
    // References convex/scraping/scrapers/{module}.ts
    scraperModule: v.optional(v.string()),

    // Scraper code - stored directly for AI-generated scrapers
    // This is the actual TypeScript code that will be executed
    scraperCode: v.optional(v.string()),

    // AI-generated scraper configuration (legacy/fallback)
    // Optional - daemon will generate this for new sources
    scraperConfig: v.optional(
      v.object({
        version: v.number(),
        generatedAt: v.number(),
        generatedBy: v.union(v.literal('claude'), v.literal('manual')),

        entryPoints: v.array(
          v.object({
            url: v.string(),
            type: v.union(v.literal('session_list'), v.literal('calendar'), v.literal('program_page')),
          }),
        ),

        pagination: v.optional(
          v.object({
            type: v.union(
              v.literal('next_button'),
              v.literal('load_more'),
              v.literal('page_numbers'),
              v.literal('none'),
            ),
            selector: v.optional(v.string()),
          }),
        ),

        sessionExtraction: v.object({
          containerSelector: v.string(),
          fields: v.object({
            name: v.object({ selector: v.string() }),
            dates: v.object({ selector: v.string(), format: v.string() }),
            price: v.optional(v.object({ selector: v.string() })),
            ageRange: v.optional(v.object({ selector: v.string(), pattern: v.string() })),
            status: v.optional(
              v.object({
                selector: v.string(),
                soldOutIndicators: v.array(v.string()),
              }),
            ),
            registrationUrl: v.optional(v.object({ selector: v.string() })),
          }),
        }),

        requiresJavaScript: v.boolean(),
        waitForSelector: v.optional(v.string()),
      }),
    ),

    // Health tracking
    scraperHealth: v.object({
      lastSuccessAt: v.optional(v.number()),
      lastFailureAt: v.optional(v.number()),
      consecutiveFailures: v.number(),
      totalRuns: v.number(),
      successRate: v.number(),
      lastError: v.optional(v.string()),
      needsRegeneration: v.boolean(),
      consecutiveZeroResults: v.optional(v.number()),
    }),

    scrapeFrequencyHours: v.number(),
    lastScrapedAt: v.optional(v.number()),
    nextScheduledScrape: v.optional(v.number()),
    isActive: v.boolean(),

    // Denormalized session counts (updated after import)
    sessionCount: v.optional(v.number()), // Total sessions from this source
    activeSessionCount: v.optional(v.number()), // Sessions with status "active"
    lastSessionsFoundAt: v.optional(v.number()), // When we last found >0 sessions

    // URL discovery and fallback tracking
    urlHistory: v.optional(
      v.array(
        v.object({
          url: v.string(),
          status: v.string(), // 'valid', '404', 'redirected'
          checkedAt: v.number(),
        }),
      ),
    ),
    suggestedUrl: v.optional(v.string()),

    // Data quality tracking
    dataQualityScore: v.optional(v.number()), // 0-100 based on average session completeness
    qualityTier: v.optional(
      v.union(
        v.literal('high'), // >80% complete sessions
        v.literal('medium'), // 50-80% complete
        v.literal('low'), // <50% complete (like aggregator data)
      ),
    ),

    // Admin notes for parsing guidance
    parsingNotes: v.optional(v.string()), // Notes on how to parse this source
    parsingNotesUpdatedAt: v.optional(v.number()),

    // Re-scan flag
    needsRescan: v.optional(v.boolean()), // Flag to trigger priority re-scan
    rescanRequestedAt: v.optional(v.number()),
    rescanReason: v.optional(v.string()),

    // Feature flag: opt-in to new pipeline (HTML extraction + validation in actions.ts)
    // Defaults to false so existing scrapers keep working via executor.ts -> import.ts
    useNewPipeline: v.optional(v.boolean()),

    // Configurable timeout for long-running scrapes (in seconds, default 60)
    scrapeTimeoutSeconds: v.optional(v.number()),

    // Circuit breaker: max consecutive failures before auto-disabling (default 10)
    maxConsecutiveFailures: v.optional(v.number()),

    // Closure tracking - for sources that don't actually offer camps
    closureReason: v.optional(v.string()), // Why this source was marked closed
    closedAt: v.optional(v.number()), // When it was marked closed
    closedBy: v.optional(v.string()), // "daemon" or admin user ID

    // Directory tracking
    directoryId: v.optional(v.id('directories')),
  })
    .index('by_organization', ['organizationId'])
    .index('by_city', ['cityId'])
    .index('by_next_scheduled_scrape', ['nextScheduledScrape'])
    .index('by_is_active', ['isActive'])
    .index('by_url', ['url'])
    .index('by_directory', ['directoryId']),

  // Pending sessions for review (incomplete or failed validation)
  // ============ SCRAPER DEVELOPMENT ============

  // Queue of sites needing scraper development
  scraperDevelopmentRequests: defineTable({
    // Target site info
    sourceName: v.string(),
    sourceUrl: v.string(),
    sourceId: v.optional(v.id('scrapeSources')), // Link to existing source if updating
    cityId: v.id('cities'), // Market this request is for (required)

    // Request details
    requestedBy: v.optional(v.string()),
    requestedAt: v.number(),
    notes: v.optional(v.string()), // Initial guidance for the scraper

    // Development status
    status: v.union(
      v.literal('pending'), // Waiting for Claude Code to pick up
      v.literal('in_progress'), // Claude Code is working on it
      v.literal('testing'), // Scraper written, being tested
      v.literal('needs_feedback'), // User needs to review and provide feedback
      v.literal('completed'), // Scraper is ready
      v.literal('failed'), // Could not develop a working scraper
    ),

    // Claude Code session tracking
    claudeSessionId: v.optional(v.string()),
    claudeSessionStartedAt: v.optional(v.number()),

    // Generated scraper
    generatedScraperCode: v.optional(v.string()),
    scraperVersion: v.optional(v.number()),

    // Test results
    lastTestRun: v.optional(v.number()),
    lastTestSessionsFound: v.optional(v.number()),
    lastTestError: v.optional(v.string()),
    lastTestSampleData: v.optional(v.string()), // JSON sample of extracted sessions

    // Feedback loop
    feedbackHistory: v.optional(
      v.array(
        v.object({
          feedbackAt: v.number(),
          feedbackBy: v.optional(v.string()),
          feedback: v.string(),
          scraperVersionBefore: v.number(),
        }),
      ),
    ),

    // Site exploration results (discovered navigation structure)
    siteExploration: v.optional(
      v.object({
        exploredAt: v.number(),
        siteType: v.optional(v.string()),
        hasMultipleLocations: v.optional(v.boolean()),
        locations: v.optional(
          v.array(
            v.object({
              name: v.string(),
              url: v.optional(v.string()),
              siteId: v.optional(v.string()),
            }),
          ),
        ),
        hasCategories: v.optional(v.boolean()),
        categories: v.optional(
          v.array(
            v.object({
              name: v.string(),
              id: v.optional(v.string()),
            }),
          ),
        ),
        registrationSystem: v.optional(v.string()),
        urlPatterns: v.optional(v.array(v.string())),
        navigationNotes: v.optional(v.array(v.string())),
        // API Discovery results
        discoveredApis: v.optional(
          v.array(
            v.object({
              url: v.string(),
              method: v.string(),
              contentType: v.string(),
              responseSize: v.number(),
              matchCount: v.number(),
              structureHint: v.optional(v.string()),
              urlPattern: v.optional(v.string()),
              sampleData: v.optional(v.string()), // First 2KB of response for preview
            }),
          ),
        ),
        apiSearchTerm: v.optional(v.string()),
      }),
    ),

    // Retry tracking
    testRetryCount: v.optional(v.number()),
    maxTestRetries: v.optional(v.number()), // Default 3

    // Completion
    completedAt: v.optional(v.number()),
    finalScraperCode: v.optional(v.string()),
  })
    .index('by_status', ['status'])
    .index('by_source', ['sourceId'])
    .index('by_city', ['cityId'])
    .index('by_source_url', ['sourceUrl']),

  pendingSessions: defineTable({
    jobId: v.id('scrapeJobs'),
    sourceId: v.id('scrapeSources'),
    rawData: v.string(), // Original JSON
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
      }),
    ),
    completenessScore: v.number(), // 0-100
    status: v.union(
      v.literal('pending_review'),
      v.literal('manually_fixed'),
      v.literal('imported'),
      v.literal('discarded'),
    ),
    createdAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.string()),
  })
    .index('by_source', ['sourceId'])
    .index('by_status', ['status'])
    .index('by_job', ['jobId']),

  // Scraper version history for rollback
  scraperVersions: defineTable({
    scrapeSourceId: v.id('scrapeSources'),
    version: v.number(),
    config: v.string(), // JSON
    createdAt: v.number(),
    createdBy: v.string(),
    changeReason: v.string(),
    isActive: v.boolean(),
  })
    .index('by_source', ['scrapeSourceId'])
    .index('by_source_and_active', ['scrapeSourceId', 'isActive']),

  scrapeJobs: defineTable({
    sourceId: v.id('scrapeSources'),
    status: v.union(v.literal('pending'), v.literal('running'), v.literal('completed'), v.literal('failed')),
    triggeredBy: v.optional(v.string()), // Manual trigger user ID
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    sessionsFound: v.optional(v.number()),
    sessionsCreated: v.optional(v.number()),
    sessionsUpdated: v.optional(v.number()),
    retryCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    error: v.optional(v.string()), // Error message for workflow failures
    workflowId: v.optional(v.string()), // Workflow ID for tracking
  })
    .index('by_source', ['sourceId'])
    .index('by_source_and_status', ['sourceId', 'status'])
    .index('by_status', ['status']),

  scrapeRawData: defineTable({
    jobId: v.id('scrapeJobs'),
    sourceId: v.id('scrapeSources'),
    rawJson: v.string(),
    processedAt: v.optional(v.number()),
    resultingSessionId: v.optional(v.id('sessions')),
    processingError: v.optional(v.string()),
  })
    .index('by_job', ['jobId'])
    .index('by_source', ['sourceId']),

  // Change tracking for sold out detection
  scrapeChanges: defineTable({
    jobId: v.id('scrapeJobs'),
    sourceId: v.id('scrapeSources'),
    sessionId: v.optional(v.id('sessions')),
    changeType: v.union(
      v.literal('session_added'),
      v.literal('session_removed'),
      v.literal('status_changed'),
      v.literal('price_changed'),
      v.literal('dates_changed'),
    ),
    previousValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    detectedAt: v.number(),
    notified: v.boolean(),
  })
    .index('by_source', ['sourceId'])
    .index('by_session', ['sessionId'])
    .index('by_not_notified', ['notified'])
    .index('by_notified_and_change_type', ['notified', 'changeType'])
    .index('by_job', ['jobId']),

  // ============ INBOUND EMAILS ============

  inboundEmails: defineTable({
    // Resend-provided fields
    resendId: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    textBody: v.optional(v.string()),
    htmlBody: v.optional(v.string()),

    // Parsed metadata
    fromEmail: v.string(), // Extracted email address
    fromName: v.optional(v.string()), // Extracted name

    // Processing status
    status: v.union(v.literal('received'), v.literal('processed'), v.literal('archived')),

    // Link to organization if we can match by email
    matchedOrganizationId: v.optional(v.id('organizations')),

    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index('by_from_email', ['fromEmail'])
    .index('by_status', ['status'])
    .index('by_received_at', ['receivedAt'])
    .index('by_organization', ['matchedOrganizationId']),

  // ============ NOTIFICATIONS ============

  // Track what notifications have been sent to avoid duplicates
  notificationsSent: defineTable({
    familyId: v.id('families'),
    sessionId: v.id('sessions'),
    changeType: v.union(v.literal('registration_opened'), v.literal('low_availability')),
    notifiedAt: v.number(),
    emailId: v.optional(v.string()),
  })
    .index('by_family', ['familyId'])
    .index('by_family_session_type', ['familyId', 'sessionId', 'changeType']),

  // Track availability to detect when it drops below threshold
  sessionAvailabilitySnapshots: defineTable({
    sessionId: v.id('sessions'),
    enrolledCount: v.number(),
    capacity: v.number(),
    spotsRemaining: v.number(),
    recordedAt: v.number(),
  }).index('by_session', ['sessionId']),

  // Track automated email sends (re-engagement, digest, countdown, etc.)
  automatedEmailsSent: defineTable({
    familyId: v.id('families'),
    emailType: v.union(
      v.literal('re_engagement'),
      v.literal('weekly_digest'),
      v.literal('summer_countdown'),
      v.literal('paywall_nudge'),
      v.literal('near_paywall_nudge'),
      v.literal('camp_request_fulfilled'),
    ),
    sentAt: v.number(),
    emailId: v.optional(v.string()),
    // Optional metadata (e.g., camp request ID, week key for dedup)
    dedupeKey: v.optional(v.string()),
  })
    .index('by_family', ['familyId'])
    .index('by_family_and_type', ['familyId', 'emailType'])
    .index('by_family_type_dedupe', ['familyId', 'emailType', 'dedupeKey']),

  // ============ MARKET EXPANSION ============

  expansionMarkets: defineTable({
    marketKey: v.string(), // "seattle-wa"
    tier: v.number(), // 1, 2, or 3

    // Domain - primary domain (backwards compatible)
    selectedDomain: v.optional(v.string()),
    domainPurchased: v.boolean(),
    domainPurchasedAt: v.optional(v.number()),
    porkbunOrderId: v.optional(v.string()),

    // Multiple domains support
    domains: v.optional(
      v.array(
        v.object({
          domain: v.string(),
          isPrimary: v.boolean(),
          purchasedAt: v.optional(v.number()),
          orderId: v.optional(v.string()),
          dnsConfigured: v.optional(v.boolean()),
          netlifyZoneId: v.optional(v.string()),
          resendDomainId: v.optional(v.string()),
        }),
      ),
    ),

    // DNS
    dnsConfigured: v.boolean(),
    netlifyZoneId: v.optional(v.string()),

    // City
    cityId: v.optional(v.id('cities')),

    // Icon generation
    iconOptions: v.optional(v.array(v.string())), // URLs of generated icon options
    iconPrompt: v.optional(v.string()), // The prompt used to generate icons
    selectedIconStorageId: v.optional(v.id('_storage')), // Selected icon in Convex storage
    selectedIconSourceUrl: v.optional(v.string()), // Original URL of selected icon

    // Status
    status: v.union(
      v.literal('not_started'),
      v.literal('domain_purchased'),
      v.literal('dns_configured'),
      v.literal('city_created'),
      v.literal('launched'),
    ),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_market_key', ['marketKey'])
    .index('by_status', ['status']),

  // ============ ORG OUTREACH ============

  orgOutreach: defineTable({
    organizationId: v.id('organizations'),
    cityId: v.id('cities'),
    emailAddress: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('sent'),
      v.literal('opened'),
      v.literal('replied'),
      v.literal('bounced'),
    ),
    // Which email in the sequence (1, 2, or 3)
    sequenceStep: v.number(),
    sentAt: v.optional(v.number()),
    emailId: v.optional(v.string()), // Resend email ID
    followUpCount: v.number(),
    // Track scheduling for follow-ups
    nextFollowUpAt: v.optional(v.number()),
    // Notes / admin context
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_organization', ['organizationId'])
    .index('by_status', ['status'])
    .index('by_city', ['cityId'])
    .index('by_next_follow_up', ['nextFollowUpAt']),

  // Admin alerts
  scraperAlerts: defineTable({
    sourceId: v.optional(v.id('scrapeSources')),
    alertType: v.union(
      v.literal('scraper_disabled'),
      v.literal('scraper_degraded'),
      v.literal('high_change_volume'),
      v.literal('scraper_needs_regeneration'),
      v.literal('new_sources_pending'),
      v.literal('zero_results'),
      v.literal('rate_limited'),
      v.literal('source_recovered'),
      v.literal('cross_source_duplicates'),
      v.literal('circuit_breaker'),
    ),
    message: v.string(),
    severity: v.union(v.literal('info'), v.literal('warning'), v.literal('error'), v.literal('critical')),
    createdAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
    acknowledgedBy: v.optional(v.string()),
  })
    .index('by_source', ['sourceId'])
    .index('by_unacknowledged', ['acknowledgedAt'])
    .index('by_severity', ['severity']),

  // ============ REVIEWS ============

  reviews: defineTable({
    familyId: v.id('families'),
    campId: v.id('camps'),
    sessionId: v.optional(v.id('sessions')),
    rating: v.number(), // 1-5
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    yearAttended: v.optional(v.number()),
    isVerified: v.boolean(), // true if family had a registration for this camp
    status: v.union(v.literal('published'), v.literal('pending'), v.literal('rejected')),
    createdAt: v.number(),
  })
    .index('by_camp', ['campId'])
    .index('by_family', ['familyId'])
    .index('by_camp_and_status', ['campId', 'status']),

  // ============ USER FEEDBACK ============

  feedback: defineTable({
    familyId: v.optional(v.id('families')), // Optional - anonymous feedback allowed
    email: v.optional(v.string()), // For logged-in users
    message: v.string(),
    page: v.optional(v.string()), // Where the feedback was submitted from
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_family', ['familyId']),

  // ============ LEAD CAPTURES ============

  leadCaptures: defineTable({
    email: v.string(),
    citySlug: v.string(),
    source: v.string(), // e.g., 'discover', 'homepage'
    interests: v.optional(v.array(v.string())),
    status: v.union(v.literal('pending'), v.literal('subscribed'), v.literal('converted')),
    createdAt: v.number(),
    convertedFamilyId: v.optional(v.id('families')),
    // Lead nurture drip tracking
    nurtureEmailsSent: v.optional(v.number()), // 0, 1, 2, or 3
    lastNurtureEmailAt: v.optional(v.number()),
  })
    .index('by_email', ['email'])
    .index('by_city_slug', ['citySlug'])
    .index('by_status', ['status']),

  // ============ BLOG ============

  blogPosts: defineTable({
    title: v.string(),
    slug: v.string(),
    content: v.string(), // Markdown content
    excerpt: v.string(), // Short summary for cards
    heroImageStorageId: v.optional(v.id('_storage')),
    cityId: v.optional(v.id('cities')), // Optional - some posts are city-specific
    category: v.string(), // e.g., "guide", "stem", "budget", "tips", "weekly-update"
    tags: v.optional(v.array(v.string())),
    publishedAt: v.optional(v.number()), // Undefined = draft
    status: v.union(v.literal('draft'), v.literal('published'), v.literal('archived')),
    // SEO
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    // Generation metadata
    generatedBy: v.optional(v.union(v.literal('claude'), v.literal('manual'))),
    generatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_status', ['status'])
    .index('by_status_and_published', ['status', 'publishedAt'])
    .index('by_city', ['cityId'])
    .index('by_category', ['category']),

  // ============ ORG DASHBOARD ============

  orgClaims: defineTable({
    organizationId: v.id('organizations'),
    email: v.string(),
    claimToken: v.string(),
    status: v.union(v.literal('pending'), v.literal('verified'), v.literal('rejected')),
    verifiedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_email', ['email'])
    .index('by_token', ['claimToken']),

  // ============ FEATURED LISTINGS ============

  featuredListings: defineTable({
    organizationId: v.id('organizations'),
    campId: v.optional(v.id('camps')),
    tier: v.union(v.literal('featured'), v.literal('spotlight')),
    startsAt: v.number(),
    expiresAt: v.number(),
    stripePaymentId: v.optional(v.string()),
    status: v.union(v.literal('active'), v.literal('expired'), v.literal('pending')),
    createdAt: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_org', ['organizationId'])
    .index('by_camp', ['campId']),

  // ============ CHURN TRACKING ============

  // ============ PARTNER APPLICATIONS ============

  partnerApplications: defineTable({
    organizationName: v.string(),
    contactName: v.string(),
    email: v.string(),
    organizationType: v.string(), // PTA, school, nonprofit, other
    message: v.optional(v.string()),
    status: v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected')),
    createdAt: v.number(),
  })
    .index('by_email', ['email']),

  // ============ CHURN TRACKING ============

  churnReasons: defineTable({
    familyId: v.id('families'),
    reason: v.string(),
    feedback: v.optional(v.string()),
    canceledAt: v.number(),
    winbackEmailsSent: v.number(),
  })
    .index('by_family', ['familyId']),
});
