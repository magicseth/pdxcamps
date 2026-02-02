"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import * as cheerio from "cheerio";

// Debug logger
function log(level: "INFO" | "DEBUG" | "WARN" | "ERROR", message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` | ${JSON.stringify(data, null, 2)}` : "";
  console.log(`[${timestamp}] [${level}] ${message}${dataStr}`);
}

interface ScrapedCamp {
  name: string;
  description: string;
  dates: string;
  startDate?: string;
  endDate?: string;
  times: string;
  dropOffHour?: number;
  dropOffMinute?: number;
  pickUpHour?: number;
  pickUpMinute?: number;
  price: string;
  priceInCents?: number;
  memberPrice?: string;
  memberPriceInCents?: number;
  grades: string;
  minGrade?: number;
  maxGrade?: number;
  ages?: string;
  minAge?: number;
  maxAge?: number;
  location: string;
  availability: string;
  registrationUrl?: string;
  rawHtml?: string;
}

/**
 * Scrape OMSI camps page - attempts multiple methods
 */
export const scrapeOmsi = action({
  args: {
    debug: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const debug = args.debug ?? true;
    const results: {
      method: string;
      success: boolean;
      camps: ScrapedCamp[];
      error?: string;
      rawResponse?: string;
      logs: string[];
    } = {
      method: "unknown",
      success: false,
      camps: [],
      logs: [],
    };

    const addLog = (level: "INFO" | "DEBUG" | "WARN" | "ERROR", msg: string, data?: unknown) => {
      log(level, msg, data);
      results.logs.push(`[${level}] ${msg}${data ? ": " + JSON.stringify(data) : ""}`);
    };

    addLog("INFO", "Starting OMSI scrape");

    // Method 1: Try the secure.omsi.edu API directly
    try {
      addLog("INFO", "Method 1: Attempting to fetch OMSI API");

      const apiUrl = "https://secure.omsi.edu/api/camps-classes";
      addLog("DEBUG", "Fetching", { url: apiUrl });

      const apiResponse = await fetch(apiUrl, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });

      addLog("DEBUG", "API Response", { status: apiResponse.status, statusText: apiResponse.statusText });

      if (apiResponse.ok) {
        const data = await apiResponse.json();
        addLog("INFO", "Got API response", { type: typeof data, keys: Object.keys(data) });
        results.method = "api";
        results.success = true;
        results.rawResponse = JSON.stringify(data).substring(0, 5000);
        // Parse the API response...
      }
    } catch (apiError) {
      addLog("WARN", "API method failed", { error: String(apiError) });
    }

    // Method 2: Scrape the main camps page
    if (!results.success) {
      try {
        addLog("INFO", "Method 2: Fetching main camps page");

        const mainUrl = "https://omsi.edu/camps/";
        const response = await fetch(mainUrl, {
          headers: {
            "Accept": "text/html,application/xhtml+xml",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });

        addLog("DEBUG", "Response", { status: response.status, contentType: response.headers.get("content-type") });

        const html = await response.text();
        addLog("DEBUG", "HTML length", { length: html.length });

        if (debug) {
          results.rawResponse = html.substring(0, 10000);
        }

        const $ = cheerio.load(html);

        // Look for camp-related content
        addLog("DEBUG", "Searching for camp content...");

        // Try various selectors
        const selectors = [
          ".camp-card",
          ".program-card",
          "[class*='camp']",
          ".wp-block-columns",
          "article",
          ".entry-content a[href*='camp']",
          "a[href*='camp']",
        ];

        for (const selector of selectors) {
          const elements = $(selector);
          addLog("DEBUG", `Selector "${selector}"`, { count: elements.length });

          if (elements.length > 0 && elements.length < 50) {
            elements.each((i, el) => {
              const text = $(el).text().trim().substring(0, 200);
              const href = $(el).attr("href") || "";
              if (text || href) {
                addLog("DEBUG", `  Element ${i}`, { text: text.substring(0, 100), href });
              }
            });
          }
        }

        // Look for any links to camp-related pages
        const campLinks: string[] = [];
        $("a").each((i, el) => {
          const href = $(el).attr("href") || "";
          if (href.includes("camp") || href.includes("class") || href.includes("program")) {
            campLinks.push(href);
          }
        });

        addLog("INFO", "Found camp-related links", { count: campLinks.length, links: [...new Set(campLinks)].slice(0, 20) });

        results.method = "html_scrape";
        results.success = campLinks.length > 0;

      } catch (htmlError) {
        addLog("ERROR", "HTML scrape failed", { error: String(htmlError) });
        results.error = String(htmlError);
      }
    }

    // Method 3: Try the secure catalog page
    if (!results.success) {
      try {
        addLog("INFO", "Method 3: Fetching secure catalog page");

        const catalogUrl = "https://secure.omsi.edu/camps-and-classes";
        const response = await fetch(catalogUrl, {
          headers: {
            "Accept": "text/html,application/xhtml+xml",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        });

        addLog("DEBUG", "Catalog response", { status: response.status });

        const html = await response.text();
        addLog("DEBUG", "Catalog HTML length", { length: html.length });

        if (debug) {
          results.rawResponse = html.substring(0, 10000);
        }

        const $ = cheerio.load(html);

        // Look for any script tags that might contain camp data
        $("script").each((i, el) => {
          const content = $(el).html() || "";
          if (content.includes("camp") || content.includes("class") || content.includes("program")) {
            addLog("DEBUG", `Found relevant script ${i}`, { preview: content.substring(0, 500) });
          }
        });

        // Look for any data attributes
        $("[data-camps], [data-classes], [data-programs]").each((i, el) => {
          addLog("DEBUG", `Found data attribute element ${i}`, {
            html: $(el).prop("outerHTML")?.substring(0, 500)
          });
        });

        results.method = "catalog_scrape";

      } catch (catalogError) {
        addLog("ERROR", "Catalog scrape failed", { error: String(catalogError) });
      }
    }

    // Method 4: Check for any embedded JSON or API endpoints in scripts
    try {
      addLog("INFO", "Method 4: Looking for embedded data/APIs");

      const urls = [
        "https://omsi.edu/wp-json/wp/v2/camps",
        "https://omsi.edu/wp-json/wp/v2/posts?categories=camps",
        "https://secure.omsi.edu/api/v1/programs",
      ];

      for (const url of urls) {
        try {
          addLog("DEBUG", "Trying API endpoint", { url });
          const resp = await fetch(url, {
            headers: { "Accept": "application/json" },
          });
          addLog("DEBUG", "Response", { url, status: resp.status });

          if (resp.ok) {
            const data = await resp.text();
            addLog("INFO", "Got data from API", { url, preview: data.substring(0, 500) });
          }
        } catch (e) {
          addLog("DEBUG", "Endpoint failed", { url, error: String(e) });
        }
      }
    } catch (e) {
      addLog("WARN", "Method 4 failed", { error: String(e) });
    }

    addLog("INFO", "Scrape complete", {
      method: results.method,
      success: results.success,
      campsFound: results.camps.length,
      totalLogs: results.logs.length,
    });

    return results;
  },
});

/**
 * Parse OMSI camp data and create sessions in the database
 */
export const importOmsiCamps = action({
  args: {
    camps: v.array(v.object({
      name: v.string(),
      description: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      dropOffHour: v.number(),
      dropOffMinute: v.number(),
      pickUpHour: v.number(),
      pickUpMinute: v.number(),
      priceInCents: v.number(),
      minAge: v.optional(v.number()),
      maxAge: v.optional(v.number()),
      minGrade: v.optional(v.number()),
      maxGrade: v.optional(v.number()),
      location: v.string(),
      registrationUrl: v.optional(v.string()),
    })),
    organizationId: v.id("organizations"),
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    log("INFO", "Importing OMSI camps", { count: args.camps.length });

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const camp of args.camps) {
      try {
        // Check if camp already exists
        const existingCamp = await ctx.runQuery(api.camps.queries.searchCamps, {
          query: camp.name,
          cityId: args.cityId,
        });

        let campId: string;

        if (existingCamp.length > 0) {
          campId = existingCamp[0]._id;
          log("DEBUG", "Using existing camp", { name: camp.name, campId });
        } else {
          // Create camp
          campId = await ctx.runMutation(api.camps.mutations.createCamp, {
            organizationId: args.organizationId,
            name: camp.name,
            description: camp.description,
            categories: ["STEM"], // Default for OMSI
            ageRequirements: {
              minAge: camp.minAge,
              maxAge: camp.maxAge,
              minGrade: camp.minGrade,
              maxGrade: camp.maxGrade,
            },
          });
          log("INFO", "Created camp", { name: camp.name, campId });
        }

        // Get or create location
        const locations = await ctx.runQuery(api.locations.queries.listLocations, {
          cityId: args.cityId,
          organizationId: args.organizationId,
        });

        let locationId: string;
        const existingLocation = locations.find((l: { name: string }) => l.name.includes(camp.location));

        if (existingLocation) {
          locationId = existingLocation._id;
        } else {
          locationId = await ctx.runMutation(api.locations.mutations.createLocation, {
            organizationId: args.organizationId,
            name: camp.location,
            address: {
              street: "1945 SE Water Ave",
              city: "Portland",
              state: "OR",
              zip: "97214",
            },
            cityId: args.cityId,
            latitude: 45.5083,
            longitude: -122.6658,
          });
          log("INFO", "Created location", { name: camp.location, locationId });
        }

        // Create session
        await ctx.runMutation(api.sessions.mutations.createSession, {
          campId: campId as any,
          locationId: locationId as any,
          startDate: camp.startDate,
          endDate: camp.endDate,
          dropOffTime: { hour: camp.dropOffHour, minute: camp.dropOffMinute },
          pickUpTime: { hour: camp.pickUpHour, minute: camp.pickUpMinute },
          price: camp.priceInCents,
          currency: "USD",
          capacity: 20,
          ageRequirements: {
            minAge: camp.minAge,
            maxAge: camp.maxAge,
            minGrade: camp.minGrade,
            maxGrade: camp.maxGrade,
          },
          extendedCareAvailable: false,
          waitlistEnabled: true,
          externalRegistrationUrl: camp.registrationUrl,
        });

        results.imported++;
        log("INFO", "Created session", { name: camp.name, startDate: camp.startDate });

      } catch (error) {
        const errorMsg = `Failed to import "${camp.name}": ${error}`;
        log("ERROR", errorMsg);
        results.errors.push(errorMsg);
      }
    }

    return results;
  },
});

/**
 * Manual test endpoint - creates sample OMSI camps directly
 * Use this if scraping doesn't work
 */
export const createSampleOmsiCamps = action({
  args: {
    organizationId: v.id("organizations"),
    cityId: v.id("cities"),
  },
  handler: async (ctx, args): Promise<{ imported: number; skipped: number; errors: string[] }> => {
    log("INFO", "Creating sample OMSI camps");

    // Sample OMSI camps based on their typical offerings
    const sampleCamps = [
      {
        name: "Robotics: LEGO Mindstorms",
        description: "Build and program LEGO Mindstorms robots! Learn fundamental programming concepts while creating robots that can navigate mazes, respond to sensors, and complete challenges.",
        startDate: "2026-06-23",
        endDate: "2026-06-27",
        dropOffHour: 9,
        dropOffMinute: 0,
        pickUpHour: 16,
        pickUpMinute: 0,
        priceInCents: 42500,
        minGrade: 3,
        maxGrade: 5,
        location: "OMSI",
      },
      {
        name: "Chemistry Wizards",
        description: "Discover the magic of chemistry through hands-on experiments! Create slime, make things fizz and bubble, and learn about chemical reactions in a safe, fun environment.",
        startDate: "2026-06-23",
        endDate: "2026-06-27",
        dropOffHour: 9,
        dropOffMinute: 0,
        pickUpHour: 16,
        pickUpMinute: 0,
        priceInCents: 39500,
        minGrade: 1,
        maxGrade: 3,
        location: "OMSI",
      },
      {
        name: "Coding with Scratch",
        description: "Learn to code by creating your own video games and animations! Using MIT's Scratch programming language, campers will develop computational thinking skills while having fun.",
        startDate: "2026-06-30",
        endDate: "2026-07-04",
        dropOffHour: 9,
        dropOffMinute: 0,
        pickUpHour: 16,
        pickUpMinute: 0,
        priceInCents: 42500,
        minGrade: 2,
        maxGrade: 5,
        location: "OMSI",
      },
      {
        name: "Forensic Science CSI",
        description: "Become a forensic scientist! Analyze fingerprints, examine evidence, solve mysteries using real forensic techniques. Great for kids who love solving puzzles.",
        startDate: "2026-07-07",
        endDate: "2026-07-11",
        dropOffHour: 9,
        dropOffMinute: 0,
        pickUpHour: 16,
        pickUpMinute: 0,
        priceInCents: 42500,
        minGrade: 4,
        maxGrade: 6,
        location: "OMSI",
      },
      {
        name: "Nature Explorers at Oregon Zoo",
        description: "Explore the Oregon Zoo and learn about animals from around the world! Meet zookeepers, observe animal behaviors, and discover what it takes to care for zoo animals.",
        startDate: "2026-07-14",
        endDate: "2026-07-18",
        dropOffHour: 9,
        dropOffMinute: 0,
        pickUpHour: 15,
        pickUpMinute: 30,
        priceInCents: 44500,
        minGrade: 1,
        maxGrade: 3,
        location: "Oregon Zoo",
      },
      {
        name: "Engineering Challenge",
        description: "Design, build, and test! Tackle engineering challenges using everyday materials. Build bridges, towers, catapults, and more while learning about structural engineering.",
        startDate: "2026-07-21",
        endDate: "2026-07-25",
        dropOffHour: 9,
        dropOffMinute: 0,
        pickUpHour: 16,
        pickUpMinute: 0,
        priceInCents: 42500,
        minGrade: 3,
        maxGrade: 6,
        location: "OMSI",
      },
    ];

    return await ctx.runAction(api.scraping.omsi.importOmsiCamps, {
      camps: sampleCamps,
      organizationId: args.organizationId,
      cityId: args.cityId,
    });
  },
});
