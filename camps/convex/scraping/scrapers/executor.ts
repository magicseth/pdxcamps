"use node";

/**
 * Dynamic Scraper Executor
 *
 * Executes scraper code stored in the database.
 * Scrapers are JavaScript/TypeScript code strings that get executed at runtime.
 *
 * Each scraper must export a default async function with signature:
 *   async function scrape(config, log, fetch) => ScrapeResult
 */

import { action } from "../../_generated/server";
import { api } from "../../_generated/api";
import { v } from "convex/values";
import { ScrapedSession, ScrapeResult, ScraperConfig, ScraperLogger } from "./types";
import { Stagehand } from "@browserbasehq/stagehand";

// Built-in scrapers that are hardcoded (for bootstrapping)
import { omsiScraper } from "./omsi";

const BUILTIN_SCRAPERS: Record<string, typeof omsiScraper> = {
  omsi: omsiScraper,
};

/**
 * Execute a scraper for a given source
 * Uses either built-in scraper or dynamically executes code from DB
 */
export const executeScraper = action({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args): Promise<ScrapeResult> => {
    const startTime = Date.now();
    const logs: string[] = [];

    const log: ScraperLogger = (level, message, data) => {
      const logEntry = `[${level}] ${message}${data ? `: ${JSON.stringify(data)}` : ""}`;
      console.log(`[Scraper] ${logEntry}`);
      logs.push(logEntry);
    };

    try {
      // Get the source configuration
      const source = await ctx.runQuery(api.scraping.queries.getScrapeSource, {
        sourceId: args.sourceId,
      });

      if (!source) {
        throw new Error("Scrape source not found");
      }

      log("INFO", "Starting scrape", { name: source.name, url: source.url });

      const config: ScraperConfig = {
        sourceId: args.sourceId,
        url: source.url,
        name: source.name,
        organizationId: source.organizationId,
      };

      let result: ScrapeResult;

      // Check for built-in scraper first
      if (source.scraperModule && BUILTIN_SCRAPERS[source.scraperModule]) {
        log("DEBUG", "Using built-in scraper", { module: source.scraperModule });
        result = await BUILTIN_SCRAPERS[source.scraperModule].scrape(config, log);
      }
      // Check for dynamic scraper code in DB
      else if (source.scraperCode) {
        log("DEBUG", "Executing dynamic scraper code");
        result = await executeDynamicScraper(source.scraperCode, config, log);
      }
      // No scraper available
      else {
        throw new Error(
          `No scraper available for source "${source.name}". ` +
            `Set scraperModule to a built-in scraper or provide scraperCode.`
        );
      }

      // Create and start scrape job record
      const jobId = await ctx.runMutation(api.scraping.mutations.createScrapeJob, {
        sourceId: args.sourceId,
        triggeredBy: "executor",
      });

      // Start the job
      await ctx.runMutation(api.scraping.mutations.startScrapeJob, {
        jobId,
      });

      // Store raw data
      await ctx.runMutation(api.scraping.mutations.storeRawData, {
        jobId,
        rawJson: JSON.stringify({
          result,
          logs,
          config,
        }),
      });

      // Mark job complete
      await ctx.runMutation(api.scraping.mutations.completeScrapeJob, {
        jobId,
        sessionsFound: result.sessions.length,
        sessionsCreated: 0, // Will be updated when sessions are imported
        sessionsUpdated: 0,
      });

      log("INFO", "Scrape complete", {
        success: result.success,
        sessionsFound: result.sessions.length,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log("ERROR", "Scrape failed", { error: errorMessage });

      return {
        success: false,
        sessions: [],
        error: errorMessage,
        scrapedAt: Date.now(),
        durationMs: Date.now() - startTime,
        pagesScraped: 0,
      };
    }
  },
});

/**
 * Execute dynamically loaded scraper code
 *
 * The code should be a function body that:
 * - Receives: config, log, fetch as arguments
 * - Returns: ScrapeResult
 *
 * Example code stored in DB:
 * ```
 * const response = await fetch(config.url);
 * const html = await response.text();
 * // ... parse html ...
 * return { success: true, sessions: [...], scrapedAt: Date.now(), durationMs: 0, pagesScraped: 1 };
 * ```
 */
async function executeDynamicScraper(
  code: string,
  config: ScraperConfig,
  log: ScraperLogger
): Promise<ScrapeResult> {
  try {
    // Create a function from the code string
    // The function receives config, log, and fetch as parameters
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

    const scraperFn = new AsyncFunction(
      "config",
      "log",
      "fetch",
      "cheerio",
      code
    );

    // Import cheerio for HTML parsing (commonly needed)
    const cheerio = await import("cheerio");

    // Execute the scraper with a timeout
    const timeoutMs = 60000; // 1 minute timeout
    const result = await Promise.race([
      scraperFn(config, log, fetch, cheerio),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Scraper timeout")), timeoutMs)
      ),
    ]);

    // Validate result shape
    if (!result || typeof result !== "object") {
      throw new Error("Scraper did not return a valid result object");
    }

    return {
      success: result.success ?? false,
      sessions: Array.isArray(result.sessions) ? result.sessions : [],
      organization: result.organization,
      error: result.error,
      scrapedAt: result.scrapedAt ?? Date.now(),
      durationMs: result.durationMs ?? 0,
      pagesScraped: result.pagesScraped ?? 1,
      rawDataSummary: result.rawDataSummary,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Execution error";
    log("ERROR", "Dynamic scraper execution failed", { error: errorMessage });

    return {
      success: false,
      sessions: [],
      error: `Dynamic execution failed: ${errorMessage}`,
      scrapedAt: Date.now(),
      durationMs: 0,
      pagesScraped: 0,
    };
  }
}

/**
 * Test a scraper code snippet without saving
 * Useful for development and validation
 */
export const testScraperCode = action({
  args: {
    code: v.string(),
    url: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ScrapeResult> => {
    const logs: string[] = [];

    const log: ScraperLogger = (level, message, data) => {
      const logEntry = `[${level}] ${message}${data ? `: ${JSON.stringify(data)}` : ""}`;
      console.log(`[TestScraper] ${logEntry}`);
      logs.push(logEntry);
    };

    const config: ScraperConfig = {
      sourceId: "test" as any,
      url: args.url,
      name: args.name || "Test Scraper",
    };

    log("INFO", "Testing scraper code", { url: args.url });

    const result = await executeDynamicScraper(args.code, config, log);

    return {
      ...result,
      rawDataSummary: `Logs: ${logs.length} entries`,
    };
  },
});

/**
 * Generate and store scraper code for a source
 * This is called by Claude Code after analyzing a website
 */
export const saveScraperCode = action({
  args: {
    sourceId: v.id("scrapeSources"),
    code: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
    sessionsFound?: number;
    message?: string;
  }> => {
    // Validate the code by doing a test run
    const source = await ctx.runQuery(api.scraping.queries.getScrapeSource, {
      sourceId: args.sourceId,
    }) as { url: string; name: string } | null;

    if (!source) {
      throw new Error("Source not found");
    }

    // Test the code first - call the function directly instead of through API
    const logs: string[] = [];
    const log: ScraperLogger = (level, message, data) => {
      logs.push(`[${level}] ${message}${data ? `: ${JSON.stringify(data)}` : ""}`);
    };

    const testConfig: ScraperConfig = {
      sourceId: args.sourceId,
      url: source.url,
      name: source.name,
    };

    const testResult = await executeDynamicScraper(args.code, testConfig, log);

    if (!testResult.success) {
      return {
        success: false,
        error: `Scraper code test failed: ${testResult.error}`,
      };
    }

    // Save the code to the source
    await ctx.runMutation(api.scraping.mutations.updateScraperCode, {
      sourceId: args.sourceId,
      code: args.code,
    });

    return {
      success: true,
      sessionsFound: testResult.sessions.length,
      message: `Scraper saved and tested successfully. Found ${testResult.sessions.length} sessions.`,
    };
  },
});

/**
 * Execute a Stagehand-based scraper for JavaScript-heavy sites
 * Uses Browserbase for headless browser execution
 */
export const executeStagehandScraper = action({
  args: {
    url: v.string(),
    instruction: v.string(),
    sourceId: v.optional(v.id("scrapeSources")),
    parsingNotes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ScrapeResult> => {
    const startTime = Date.now();
    const logs: string[] = [];

    const log: ScraperLogger = (level, message, data) => {
      const logEntry = `[${level}] ${message}${data ? `: ${JSON.stringify(data)}` : ""}`;
      console.log(`[Stagehand] ${logEntry}`);
      logs.push(logEntry);
    };

    try {
      // Fetch source's parsing notes if sourceId provided and no notes passed directly
      let parsingNotes = args.parsingNotes;
      if (args.sourceId && !parsingNotes) {
        const source = await ctx.runQuery(api.scraping.queries.getScrapeSource, {
          sourceId: args.sourceId,
        });
        parsingNotes = source?.parsingNotes;
        if (parsingNotes) {
          log("INFO", "Using parsing notes from source");
        }
      }

      log("INFO", "Starting Stagehand scrape", { url: args.url, hasParsingNotes: !!parsingNotes });

      // Import zod for schema
      const { z } = await import("zod");

      // Initialize Stagehand with Browserbase
      const stagehand = new Stagehand({
        env: "BROWSERBASE",
        apiKey: process.env.BROWSERBASE_API_KEY,
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        model: {
          modelName: "anthropic/claude-sonnet-4-20250514",
          apiKey: process.env.MODEL_API_KEY!,
        },
        disablePino: true,
        verbose: 0,
      });

      await stagehand.init();
      log("DEBUG", "Stagehand initialized");

      // Get the page from context
      const page = stagehand.context.pages()[0];
      await page.goto(args.url, { waitUntil: "domcontentloaded", timeoutMs: 30000 });
      log("DEBUG", "Page loaded");

      // Wait for dynamic content to render
      await page.waitForTimeout(5000);

      // Extract camp information using Stagehand's AI extraction
      const schema = z.object({
        sessions: z.array(z.object({
          // REQUIRED - Name
          name: z.string().describe("The name of the camp session"),
          description: z.string().optional().describe("Description of the camp"),

          // REQUIRED - Dates (critical)
          startDate: z.string().optional().describe("Start date in YYYY-MM-DD format. IMPORTANT: Convert any date format to YYYY-MM-DD."),
          endDate: z.string().optional().describe("End date in YYYY-MM-DD format. IMPORTANT: Convert any date format to YYYY-MM-DD."),
          dateRaw: z.string().optional().describe("Original date text exactly as shown on the page, for debugging"),

          // REQUIRED - Times (critical)
          dropOffHour: z.number().optional().describe("Drop-off hour in 24-hour format (0-23). Convert 9am to 9, 9pm to 21."),
          dropOffMinute: z.number().optional().describe("Drop-off minute (0-59). Default to 0 if not specified."),
          pickUpHour: z.number().optional().describe("Pick-up hour in 24-hour format (0-23). Convert 3pm to 15."),
          pickUpMinute: z.number().optional().describe("Pick-up minute (0-59). Default to 0 if not specified."),
          timeRaw: z.string().optional().describe("Original time text like '9am-3pm'"),

          // REQUIRED - Location (critical) - extract FULL address when possible
          location: z.string().optional().describe("Full address or location name where the camp takes place"),
          // Structured address components (preferred over raw location string)
          locationStreet: z.string().optional().describe("Street address (e.g., '1234 Main St')"),
          locationCity: z.string().optional().describe("City name (e.g., 'Portland')"),
          locationState: z.string().optional().describe("State abbreviation (e.g., 'OR')"),
          locationZip: z.string().optional().describe("ZIP code (e.g., '97201')"),

          // REQUIRED - Ages (critical)
          minAge: z.number().optional().describe("Minimum age in years"),
          maxAge: z.number().optional().describe("Maximum age in years"),
          minGrade: z.number().optional().describe("Minimum grade (K=0, 1st=1, Pre-K=-1)"),
          maxGrade: z.number().optional().describe("Maximum grade (K=0, 1st=1, etc.)"),
          ageGradeRaw: z.string().optional().describe("Original age/grade text like 'Ages 5-12' or 'Grades K-5'"),

          // REQUIRED - Price (critical, 0 for free is valid)
          priceInCents: z.number().optional().describe("Price in cents (e.g., $350 = 35000). Use 0 for free camps."),
          priceRaw: z.string().optional().describe("Original price text like '$350' or 'Free'"),

          // IMPORTANT - Capacity/Availability
          capacity: z.number().optional().describe("Total number of spots available"),
          enrolledCount: z.number().optional().describe("Number of spots already taken/enrolled"),
          spotsLeft: z.number().optional().describe("Number of remaining spots (if shown)"),
          isAvailable: z.boolean().optional().describe("Whether spots are available or if it's sold out/full"),
          availabilityRaw: z.string().optional().describe("Original availability text like '5 spots left' or 'Sold Out'"),

          // Additional fields
          registrationUrl: z.string().optional().describe("URL to register for this specific session"),
          category: z.string().optional().describe("Category like 'Sports', 'STEM', 'Arts', 'Nature', 'Music'"),
          imageUrls: z.array(z.string()).optional().describe("URLs of images for this camp/session"),

          // Source tracking
          sourceProductId: z.string().optional().describe("Unique ID for this camp/program if visible in the page"),
          sourceSessionId: z.string().optional().describe("Unique ID for this specific session if different from product"),
        })),
        organization: z.object({
          name: z.string().optional().describe("Name of the organization running the camps"),
          description: z.string().optional().describe("About the organization"),
          website: z.string().optional().describe("Organization's main website"),
          logoUrl: z.string().optional().describe("URL to organization's logo image"),
        }).optional(),
      });

      // Build enhanced instruction with parsing notes if available
      let enhancedInstruction = `${args.instruction}

EXTRACTION REQUIREMENTS:
For EACH session, you MUST extract these fields if present on the page:
1. Name of the camp/session
2. Start and end dates (convert to YYYY-MM-DD format)
3. Drop-off and pick-up times (convert to 24-hour format numbers)
4. Location/address - IMPORTANT: Extract the FULL physical address if shown:
   - locationStreet: Street address (e.g., "1234 Main St")
   - locationCity: City name (e.g., "Portland")
   - locationState: State abbreviation (e.g., "OR")
   - locationZip: ZIP code (e.g., "97201")
   - Also include the full address in the "location" field
5. Age range OR grade range
6. Price (convert to cents, e.g., $350 = 35000)
7. Capacity/spots available if shown

Extract EVERY individual session - if there are 10 weeks of the same camp, extract all 10 as separate sessions with different dates.
Mark any sold-out or unavailable sessions as isAvailable: false.
`;

      // Add parsing notes if provided
      if (parsingNotes) {
        enhancedInstruction += `
SITE-SPECIFIC PARSING NOTES:
${parsingNotes}
`;
        log("DEBUG", "Added parsing notes to instruction");
      }

      const extracted = await stagehand.extract(enhancedInstruction, schema);

      await stagehand.close();

      const sessions: ScrapedSession[] = (extracted.sessions || []).map((s) => {
        // Build structured address if components are available
        const hasAddressComponents = s.locationStreet || s.locationCity || s.locationState || s.locationZip;
        const locationAddress = hasAddressComponents ? {
          street: s.locationStreet,
          city: s.locationCity,
          state: s.locationState,
          zip: s.locationZip,
        } : undefined;

        return {
          name: s.name || "",
          description: s.description,
          dateRaw: s.dateRaw,
          startDate: s.startDate,
          endDate: s.endDate,
          timeRaw: s.timeRaw,
          priceRaw: s.priceRaw,
          ageGradeRaw: s.ageGradeRaw,
          location: s.location,
          locationAddress,
          registrationUrl: s.registrationUrl,
          isAvailable: s.isAvailable,
          category: s.category,
          imageUrls: s.imageUrls,
        };
      });

      log("INFO", "Stagehand extraction complete", { sessionsFound: sessions.length });

      const result: ScrapeResult = {
        success: true,
        sessions,
        organization: extracted.organization as ScrapeResult["organization"],
        scrapedAt: Date.now(),
        durationMs: Date.now() - startTime,
        pagesScraped: 1,
        rawDataSummary: `Extracted ${sessions.length} sessions via Stagehand`,
      };

      // If sourceId provided, create job and store results
      if (args.sourceId) {
        const jobId = await ctx.runMutation(api.scraping.mutations.createScrapeJob, {
          sourceId: args.sourceId,
          triggeredBy: "stagehand",
        });

        await ctx.runMutation(api.scraping.mutations.startScrapeJob, { jobId });

        await ctx.runMutation(api.scraping.mutations.storeRawData, {
          jobId,
          rawJson: JSON.stringify({
            result,
            logs,
            url: args.url,
            instruction: args.instruction,
          }),
        });

        await ctx.runMutation(api.scraping.mutations.completeScrapeJob, {
          jobId,
          sessionsFound: sessions.length,
          sessionsCreated: 0,
          sessionsUpdated: 0,
        });

        log("INFO", "Job created and saved", { jobId });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log("ERROR", "Stagehand scrape failed", { error: errorMessage });

      return {
        success: false,
        sessions: [],
        error: errorMessage,
        scrapedAt: Date.now(),
        durationMs: Date.now() - startTime,
        pagesScraped: 0,
      };
    }
  },
});

/**
 * Scrape a source using all its configured URLs and parsing notes
 * This is the primary way to scrape sources with multiple entry points
 */
export const scrapeSource = action({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    totalSessions: number;
    urlsScraped: number;
    results: Array<{
      url: string;
      label?: string;
      success: boolean;
      sessionsFound: number;
      error?: string;
    }>;
    error?: string;
  }> => {
    // Fetch the source with all its configuration
    const source = await ctx.runQuery(api.scraping.queries.getScrapeSource, {
      sourceId: args.sourceId,
    });

    if (!source) {
      return {
        success: false,
        totalSessions: 0,
        urlsScraped: 0,
        results: [],
        error: "Source not found",
      };
    }

    if (!source.isActive) {
      return {
        success: false,
        totalSessions: 0,
        urlsScraped: 0,
        results: [],
        error: "Source is not active",
      };
    }

    // Build list of all URLs to scrape
    const urlsToScrape: Array<{ url: string; label?: string }> = [
      { url: source.url, label: "Primary URL" },
    ];

    if (source.additionalUrls && source.additionalUrls.length > 0) {
      urlsToScrape.push(...source.additionalUrls);
    }

    const results: Array<{
      url: string;
      label?: string;
      success: boolean;
      sessionsFound: number;
      error?: string;
    }> = [];

    let totalSessions = 0;

    // Scrape each URL
    for (const urlInfo of urlsToScrape) {
      try {
        const instruction = `Extract all summer camp sessions from this page for ${source.name}.`;

        // Call the Stagehand scraper with parsing notes
        const result = await ctx.runAction(
          api.scraping.scrapers.executor.executeStagehandScraper,
          {
            url: urlInfo.url,
            instruction,
            sourceId: args.sourceId,
            parsingNotes: source.parsingNotes,
          }
        );

        results.push({
          url: urlInfo.url,
          label: urlInfo.label,
          success: result.success,
          sessionsFound: result.sessions.length,
          error: result.error,
        });

        if (result.success) {
          totalSessions += result.sessions.length;
        }
      } catch (error) {
        results.push({
          url: urlInfo.url,
          label: urlInfo.label,
          success: false,
          sessionsFound: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Clear rescan flag if set
    if (source.needsRescan) {
      await ctx.runMutation(api.scraping.mutations.clearRescanFlag, {
        sourceId: args.sourceId,
      });
    }

    return {
      success: results.some(r => r.success),
      totalSessions,
      urlsScraped: results.filter(r => r.success).length,
      results,
    };
  },
});
