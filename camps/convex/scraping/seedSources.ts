import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Seed Portland camp providers as scrape sources
 * These are real Portland-area camp providers that need scrapers
 */
export const seedPortlandSources = mutation({
  args: {
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    // Check if already seeded
    const existingSources = await ctx.db.query("scrapeSources").collect();
    if (existingSources.length > 0) {
      return { message: "Scrape sources already exist", skipped: true, count: existingSources.length };
    }

    // Portland camp providers with their websites
    const portlandCampProviders = [
      // Major institutions
      {
        name: "OMSI Science Camps",
        url: "https://secure.omsi.edu/camps-and-classes",
        scrapeType: "visualforce_api" as const,
        notes: "Uses Salesforce Visualforce Remoting API",
        priority: 1,
      },
      {
        name: "Portland Parks & Recreation",
        url: "https://www.portland.gov/parks/recreation/summer-camps",
        scrapeType: "html" as const,
        notes: "City of Portland parks department",
        priority: 1,
      },
      {
        name: "Portland Art Museum",
        url: "https://portlandartmuseum.org/learn/camps/",
        scrapeType: "html" as const,
        notes: "Art camps for kids",
        priority: 2,
      },
      {
        name: "Oregon Zoo Camps",
        url: "https://www.oregonzoo.org/camps",
        scrapeType: "html" as const,
        notes: "Zoo education programs",
        priority: 1,
      },
      // Nature & outdoor
      {
        name: "Trackers Earth",
        url: "https://trackers.world/",
        scrapeType: "html" as const,
        notes: "Wilderness skills, nature-based learning",
        priority: 1,
      },
      {
        name: "Forest Park Conservancy",
        url: "https://forestparkconservancy.org/",
        scrapeType: "html" as const,
        notes: "Nature exploration",
        priority: 3,
      },
      {
        name: "Tualatin Hills Park & Recreation",
        url: "https://www.thprd.org/activities/summer-camps",
        scrapeType: "html" as const,
        notes: "Beaverton area parks dept",
        priority: 2,
      },
      {
        name: "Metro Parks (NCPRD)",
        url: "https://ncprd.com/camps",
        scrapeType: "html" as const,
        notes: "North Clackamas Parks",
        priority: 2,
      },
      // Sports
      {
        name: "Nike Sports Camps",
        url: "https://www.ussportscamps.com/nike-sports-camps",
        scrapeType: "html" as const,
        notes: "Various sports camps in PDX area",
        priority: 2,
      },
      {
        name: "Multnomah Athletic Club",
        url: "https://themac.com/camps",
        scrapeType: "html" as const,
        notes: "Sports and activity camps",
        priority: 2,
      },
      // Tech & STEM
      {
        name: "Code Ninjas Portland",
        url: "https://www.codeninjas.com/portland-or",
        scrapeType: "html" as const,
        notes: "Coding camps for kids",
        priority: 2,
      },
      {
        name: "Portland Community College",
        url: "https://www.pcc.edu/community/youth-camps/",
        scrapeType: "html" as const,
        notes: "Various youth programs",
        priority: 3,
      },
      // Arts & performance
      {
        name: "Oregon Children's Theatre",
        url: "https://octc.org/academy/summer-academy/",
        scrapeType: "html" as const,
        notes: "Theater and drama camps",
        priority: 2,
      },
      {
        name: "Portland Center Stage",
        url: "https://www.pcs.org/education/summer-camps",
        scrapeType: "html" as const,
        notes: "Theater education",
        priority: 2,
      },
      {
        name: "Portland Youth Philharmonic",
        url: "https://www.portlandyouthphil.org/",
        scrapeType: "html" as const,
        notes: "Music camps",
        priority: 3,
      },
      // Adventure & specialty
      {
        name: "Camp Fire Columbia",
        url: "https://campfirecolumbia.org/camps/",
        scrapeType: "html" as const,
        notes: "Traditional day and overnight camps",
        priority: 2,
      },
      {
        name: "Girl Scouts of Oregon",
        url: "https://www.girlscoutsosw.org/en/our-council/camps.html",
        scrapeType: "html" as const,
        notes: "Girl Scout camps",
        priority: 2,
      },
      {
        name: "Boy Scouts Cascade Pacific Council",
        url: "https://www.cpcbsa.org/",
        scrapeType: "html" as const,
        notes: "Scout camps",
        priority: 3,
      },
      // Academic
      {
        name: "Reed College",
        url: "https://www.reed.edu/cep/",
        scrapeType: "html" as const,
        notes: "College prep and academic camps",
        priority: 3,
      },
      {
        name: "Lewis & Clark College",
        url: "https://www.lclark.edu/programs/summer_programs/",
        scrapeType: "html" as const,
        notes: "Academic summer programs",
        priority: 3,
      },
      // Specialty
      {
        name: "The Lego Store (Legacy)",
        url: "https://www.lego.com/en-us/stores",
        scrapeType: "html" as const,
        notes: "LEGO building camps at stores",
        priority: 3,
      },
      {
        name: "Portland Fencing Club",
        url: "https://portlandfencing.com/",
        scrapeType: "html" as const,
        notes: "Fencing camps",
        priority: 3,
      },
      {
        name: "World of Speed",
        url: "https://worldofspeed.org/education/camps/",
        scrapeType: "html" as const,
        notes: "Automotive/STEM camps",
        priority: 3,
      },
    ];

    let created = 0;
    for (const provider of portlandCampProviders) {
      // Create a minimal scraper config (will be refined per-provider)
      const scraperConfig = {
        version: 1,
        generatedAt: Date.now(),
        generatedBy: "manual" as const,
        entryPoints: [
          {
            url: provider.url,
            type: "session_list" as const,
          },
        ],
        pagination: {
          type: "none" as const,
          selector: undefined,
        },
        sessionExtraction: {
          containerSelector: ".camp, .session, .program, article",
          fields: {
            name: { selector: "h2, h3, .title, .name" },
            dates: { selector: ".dates, .schedule, .time", format: "auto" },
            price: { selector: ".price, .cost, .fee" },
            ageRange: { selector: ".ages, .grades", pattern: "(\\d+)-(\\d+)" },
            status: {
              selector: ".status, .availability",
              soldOutIndicators: ["sold out", "full", "waitlist"],
            },
            registrationUrl: { selector: "a.register, a.signup" },
          },
        },
        requiresJavaScript: provider.scrapeType !== "html",
        waitForSelector: undefined,
      };

      const scraperHealth = {
        lastSuccessAt: undefined,
        lastFailureAt: undefined,
        consecutiveFailures: 0,
        totalRuns: 0,
        successRate: 0,
        lastError: undefined,
        needsRegeneration: true,
      };

      await ctx.db.insert("scrapeSources", {
        organizationId: undefined, // Will be linked when organization is created
        cityId: args.cityId, // Market this source belongs to
        name: provider.name,
        url: provider.url,
        scraperConfig,
        scraperHealth,
        scrapeFrequencyHours: 24, // Daily scrapes
        lastScrapedAt: undefined,
        nextScheduledScrape: undefined,
        isActive: false, // Start inactive until scraper is configured
      });
      created++;
    }

    return {
      message: "Portland camp sources seeded",
      skipped: false,
      count: created,
    };
  },
});

/**
 * Add a new scrape source manually
 */
export const addScrapeSource = mutation({
  args: {
    name: v.string(),
    url: v.string(),
    cityId: v.id("cities"), // Required: market this source belongs to
    organizationId: v.optional(v.id("organizations")),
    scrapeType: v.union(v.literal("html"), v.literal("visualforce_api"), v.literal("stagehand")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate URL
    const existing = await ctx.db
      .query("scrapeSources")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();

    if (existing) {
      return { success: false, error: "Source with this URL already exists", sourceId: existing._id };
    }

    const scraperConfig = {
      version: 1,
      generatedAt: Date.now(),
      generatedBy: "manual" as const,
      entryPoints: [
        {
          url: args.url,
          type: "session_list" as const,
        },
      ],
      pagination: {
        type: "none" as const,
        selector: undefined,
      },
      sessionExtraction: {
        containerSelector: ".camp, .session, .program",
        fields: {
          name: { selector: "h2, h3, .title" },
          dates: { selector: ".dates, .schedule", format: "auto" },
          price: { selector: ".price, .cost" },
          ageRange: { selector: ".ages, .grades", pattern: "(\\d+)-(\\d+)" },
          status: {
            selector: ".status",
            soldOutIndicators: ["sold out", "full"],
          },
          registrationUrl: { selector: "a.register" },
        },
      },
      requiresJavaScript: args.scrapeType !== "html",
      waitForSelector: undefined,
    };

    const scraperHealth = {
      lastSuccessAt: undefined,
      lastFailureAt: undefined,
      consecutiveFailures: 0,
      totalRuns: 0,
      successRate: 0,
      lastError: undefined,
      needsRegeneration: true,
    };

    const sourceId = await ctx.db.insert("scrapeSources", {
      organizationId: args.organizationId,
      cityId: args.cityId,
      name: args.name,
      url: args.url,
      scraperConfig,
      scraperHealth,
      scrapeFrequencyHours: 24,
      lastScrapedAt: undefined,
      nextScheduledScrape: undefined,
      isActive: false,
    });

    return { success: true, sourceId };
  },
});

/**
 * List all scrape sources for a city (via organizations)
 */
export const listScrapeSources = mutation({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query("scrapeSources").collect();
    return sources.map(s => ({
      _id: s._id,
      name: s.name,
      url: s.url,
      isActive: s.isActive,
      lastScrapedAt: s.lastScrapedAt,
      scraperHealth: s.scraperHealth,
    }));
  },
});
