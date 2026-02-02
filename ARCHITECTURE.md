# Camp Marketplace - Schema & Architecture Plan

## Overview

A multi-city camp marketplace for families to discover, organize, and register for kids' camps. Built on Convex + Next.js + WorkOS.

**Starting city**: Portland, OR
**Architecture**: Multi-city ready from day one

---

## Phase 1: Core Schema

### Tables Overview

| Domain | Tables | Purpose |
|--------|--------|---------|
| Geography | `cities`, `neighborhoods` | Multi-city support, proximity search |
| Users | `families`, `children` | Accounts linked to WorkOS, kid profiles |
| Camps | `organizations`, `camps`, `locations`, `sessions` | Camp discovery and scheduling |
| Booking | `registrations` | Calendar, bookmarks, waitlists |
| Social | `friendships`, `calendarShares` | Friend connections, schedule sharing |
| Scraping | `scrapeSources`, `scrapeJobs`, `scrapeRawData` | Automated camp ingestion |

### Complete Schema

```typescript
// convex/schema.ts
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
  hour: v.number(),   // 0-23
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
    boundingBox: v.optional(v.object({
      northLat: v.number(),
      southLat: v.number(),
      eastLng: v.number(),
      westLng: v.number(),
    })),
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
    typicalPriceRange: v.optional(v.object({
      min: v.number(),
      max: v.number(),
      currency: v.string(),
    })),
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

    // Dates
    startDate: v.string(), // "2024-06-15"
    endDate: v.string(),

    // Daily schedule
    dropOffTime: timeValidator,
    pickUpTime: timeValidator,

    // Extended care
    extendedCareAvailable: v.boolean(),
    extendedCareDetails: v.optional(v.object({
      earlyDropOffTime: v.optional(timeValidator),
      latePickUpTime: v.optional(timeValidator),
      additionalCost: v.optional(v.number()),
    })),

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
    permission: v.union(
      v.literal("view_sessions"),
      v.literal("view_details")
    ),
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
    aiAnalysis: v.optional(v.object({
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
    })),

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

    // AI-generated scraper configuration
    scraperConfig: v.object({
      version: v.number(),
      generatedAt: v.number(),
      generatedBy: v.union(v.literal("claude"), v.literal("manual")),

      entryPoints: v.array(v.object({
        url: v.string(),
        type: v.union(
          v.literal("session_list"),
          v.literal("calendar"),
          v.literal("program_page")
        ),
      })),

      pagination: v.optional(v.object({
        type: v.union(
          v.literal("next_button"),
          v.literal("load_more"),
          v.literal("page_numbers"),
          v.literal("none")
        ),
        selector: v.optional(v.string()),
      })),

      sessionExtraction: v.object({
        containerSelector: v.string(),
        fields: v.object({
          name: v.object({ selector: v.string() }),
          dates: v.object({ selector: v.string(), format: v.string() }),
          price: v.optional(v.object({ selector: v.string() })),
          ageRange: v.optional(v.object({ selector: v.string(), pattern: v.string() })),
          status: v.optional(v.object({
            selector: v.string(),
            soldOutIndicators: v.array(v.string()),
          })),
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
```

---

## Phase 2: File Structure

```
convex/
├── schema.ts              # Schema (above)
├── auth.config.ts         # WorkOS config (existing)
├── http.ts                # Webhooks
│
├── lib/
│   ├── auth.ts            # getFamily(), requireAuth()
│   ├── validators.ts      # Shared validators
│   └── helpers.ts         # Age calc, distance calc
│
├── families/
│   ├── queries.ts         # getCurrentFamily, getOnboardingStatus
│   └── mutations.ts       # createFamily, updateFamily
│
├── children/
│   ├── queries.ts         # listChildren, getChild
│   └── mutations.ts       # addChild, updateChild
│
├── cities/
│   └── queries.ts         # listCities, getCityBySlug
│
├── organizations/
│   ├── queries.ts         # listOrganizations, getOrganization
│   └── mutations.ts       # createOrganization (admin)
│
├── camps/
│   ├── queries.ts         # listCamps, getCamp, searchCamps
│   └── mutations.ts       # createCamp (admin)
│
├── sessions/
│   ├── queries.ts         # searchSessions, getSessionDetail
│   ├── mutations.ts       # createSession, updateCapacity
│   └── filters.ts         # Complex filter helpers
│
├── registrations/
│   ├── queries.ts         # getFamilyCalendar, getRegistration
│   └── mutations.ts       # markInterested, register, cancel
│
├── social/
│   ├── queries.ts         # listFriends, getFriendsAtSession
│   └── mutations.ts       # sendFriendRequest, acceptRequest
│
└── scraping/
    ├── queries.ts         # listSources, getJobHistory
    ├── actions.ts         # runScrapeJob (Node.js)
    ├── internal.ts        # normalizeData
    └── crons.ts           # Scheduled scrapes
```

---

## Key Architecture Decisions

### 1. Denormalization in Sessions
Sessions store `organizationId` and `cityId` directly (not just `campId`) for efficient querying. Trade-off: rare updates if camp moves org.

### 2. Capacity Tracking
`enrolledCount` and `waitlistCount` stored on sessions, updated via internal mutations when registrations change. Enables real-time availability display.

### 3. Age + Grade Support
Both age ranges AND grade levels supported because camps specify either or both. Children have birthdate (for age) + current grade.

### 4. Bidirectional Friendships
Explicit acceptance required. Separate `calendarShares` table for granular per-child sharing permissions.

### 5. Scraping Pipeline
Raw data stored separately for reprocessing. Actions (Node.js) for HTTP fetches, mutations for data normalization.

---

## Key Queries

### Session Search (Discovery Page)
```typescript
searchSessions({
  cityId,
  filters: {
    startDateAfter, startDateBefore,
    childAge, childGrade,
    categories,
    maxPrice,
    excludeSoldOut,
    dropOffAfter, pickUpBefore
  }
})
```

### Family Calendar
```typescript
getFamilyCalendar({
  startDate, endDate,
  statuses: ["interested", "registered", "waitlisted"]
})
// Returns registrations with session + camp + location data
```

### Friends at Session
```typescript
getFriendsAtSession({ sessionId })
// Returns friends attending (respects calendar share permissions)
```

---

## Data Flows

### User Onboarding
1. WorkOS auth -> JWT with `subject` (user ID)
2. `getCurrentFamily()` returns null -> redirect to onboarding
3. `createFamily({ displayName, primaryCityId })`
4. `addChild({ firstName, birthdate, interests })`
5. `completeOnboarding()` -> redirect to dashboard

### Registration Flow
1. `searchSessions()` -> browse/filter
2. `getSessionDetail()` -> view with friends attending
3. `markInterested()` -> bookmark
4. `register()` -> enrolled or waitlisted
5. Triggers `updateCapacityCounts()` -> real-time UI update

### Scraping Pipeline
1. Cron: `checkAndTriggerScrapes()` every 15 min
2. Creates `scrapeJob` record
3. Action: `runScrapeJob()` fetches external site
4. Stores raw data in `scrapeRawData`
5. Mutation: `normalizeData()` upserts sessions
6. Real-time updates to all clients viewing affected sessions

---

---

## Autonomous Scraping System

### Overview

The scraping system is **fully automated** with minimal manual intervention:

1. **Auto-discovers** camps via web searches for each city
2. **AI-analyzes** discovered URLs to determine if they're camp sites
3. **Claude generates** custom scrapers for approved sources
4. **Daily polling** detects sold out, price changes, new sessions
5. **Self-healing** - detects broken scrapers and triggers regeneration
6. **Admin dashboard** for oversight and manual overrides

### Discovery Pipeline

```
Cron (Daily) -> generateDiscoveryQueries(cityId)
              |
              v
       Web Search API (SerpAPI)
              |
              v
       Parse Results -> deduplicateByDomain
              |
              v
       Insert into discoveredSources (status: pending_analysis)
              |
              v
Cron (30min) -> analyzeNextPendingDiscoveries
              |
              v
       Claude API -> Analyze page content
              |
              v
       Update aiAnalysis (status: pending_review)
              |
              v
       Admin Dashboard -> Approve/Reject
              |
              v
       If approved -> generateScraperConfig
              |
              v
       Claude API -> Generate CSS selectors + extraction rules
              |
              v
       Validate config against live page
              |
              v
       Create scrapeSource (status: active)
```

### Search Query Templates

```typescript
const DISCOVERY_QUERIES = [
  "{city} summer camps for kids",
  "{city} day camps children",
  "{city} {category} camps kids",  // sports, art, STEM, etc.
  "best summer camps in {city} {state}",
  "{city} youth programs summer",
];
```

### Scraper Configuration Format

Claude generates declarative configs (not code) for security:

```typescript
{
  version: 1,
  generatedBy: "claude",
  entryPoints: [
    { url: "https://example.com/camps", type: "session_list" }
  ],
  sessionExtraction: {
    containerSelector: ".camp-card",
    fields: {
      name: { selector: ".camp-title" },
      dates: { selector: ".camp-dates", format: "MMM D - MMM D, YYYY" },
      price: { selector: ".camp-price" },
      status: {
        selector: ".availability",
        soldOutIndicators: ["Sold Out", "Full", "Waitlist Only"]
      }
    }
  },
  requiresJavaScript: false
}
```

### Cron Schedule

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `discovery_orchestrator` | Daily 2AM | Find new camps per city |
| `analyze_discoveries` | Every 30min | AI-analyze pending URLs |
| `scrape_scheduler` | Every 15min | Trigger due scrapes |
| `scraper_health_monitor` | Hourly | Check for broken scrapers |

### Change Detection

Tracks all changes between scrapes:
- `session_added` - New session discovered
- `session_removed` - Session no longer on site
- `status_changed` - Sold out / available
- `price_changed` - Price increased/decreased
- `dates_changed` - Schedule modified

### Error Handling & Self-Healing

```
Scrape fails -> Increment consecutiveFailures
            |
            v
   failures < 3? -> Exponential backoff retry
            |
            v
   failures >= 5? -> Set needsRegeneration = true
            |
            v
   Alert admin + attempt scraper regeneration
            |
            v
   failures >= 10? -> Disable source, critical alert
```

### Admin Interface

**Routes:**
```
/admin/discovery     - Pending approvals queue
/admin/sources       - All sources with health status
/admin/sources/[id]  - Source detail, manual controls
/admin/alerts        - Active alerts requiring attention
/admin/jobs          - Recent job history
```

**Key Admin Actions:**
- Approve/reject discovered sources
- Trigger manual re-scrape
- Enable/disable sources
- Acknowledge alerts
- View scraper configs

### Dependencies

```json
{
  "@anthropic-ai/sdk": "^0.30.0",
  "cheerio": "^1.0.0",
  "puppeteer-core": "^23.0.0"
}
```

**External Services:**
- SerpAPI ($50/mo) - Web search
- Claude API - Analysis & scraper generation
- Browserless.io (optional) - JS-rendered pages

---

## File Structure (Updated)

```
convex/
├── schema.ts
├── auth.config.ts
├── crons.ts                # All scheduled jobs
├── http.ts
│
├── lib/
│   ├── auth.ts
│   ├── validators.ts
│   └── helpers.ts
│
├── families/
├── children/
├── cities/
├── organizations/
├── camps/
├── sessions/
├── registrations/
├── social/
│
├── discovery/              # Camp discovery pipeline
│   ├── queries.ts          # getDiscoveryQueue, getPendingAnalysis
│   ├── mutations.ts        # createDiscoveredSource, updateAnalysis
│   └── actions.ts          # executeDiscoverySearch, analyzeDiscoveredUrl
│
├── scraping/               # Scrape execution
│   ├── queries.ts          # getSourcesDueForScrape, getJobHistory
│   ├── mutations.ts        # createJob, processScrapedData, recordChanges
│   ├── actions.ts          # executeScrape, checkAndTriggerScrapes
│   └── internal.ts         # normalizeSession, detectChanges
│
├── scraperGeneration/      # AI scraper creation
│   ├── actions.ts          # generateScraperConfig, validateConfig
│   ├── prompts.ts          # Claude prompt templates
│   └── validation.ts       # Config validation logic
│
└── admin/                  # Admin dashboard
    ├── queries.ts          # getDashboard, getSourcesWithHealth
    └── mutations.ts        # reviewSource, triggerScrape, acknowledgeAlert
```

---

## Implementation Order

### Phase 1: Foundation (Week 1)
1. **Schema** - Deploy all tables and indexes
2. **Auth helpers** - `lib/auth.ts` (every domain needs this)
3. **Cities** - Seed Portland data
4. **Basic scraping** - Manual source creation, job execution

### Phase 2: User Flows (Week 2)
5. **Families + Children** - User onboarding flow
6. **Organizations + Camps + Locations** - Camp data model
7. **Sessions** - Core discovery queries

### Phase 3: Booking & Social (Week 3)
8. **Registrations** - Calendar and booking
9. **Social** - Friends and sharing

### Phase 4: Discovery Pipeline (Week 4)
10. **Web search integration** - SerpAPI setup
11. **URL analysis** - Claude integration
12. **Discovery crons** - Automated daily discovery

### Phase 5: Scraper Generation (Week 5)
13. **Claude scraper generation** - Config creation
14. **Validation system** - Test generated configs
15. **Version tracking** - Scraper rollback

### Phase 6: Admin & Monitoring (Week 6)
16. **Admin dashboard UI** - Discovery queue, source management
17. **Change detection** - Sold out tracking
18. **Alert system** - Health monitoring, notifications
19. **Self-healing** - Auto-regeneration triggers
