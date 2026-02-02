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
      log("INFO", "Starting Stagehand scrape", { url: args.url });

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
          name: z.string().describe("The name of the camp session"),
          description: z.string().optional().describe("Description of the camp"),
          dateRaw: z.string().optional().describe("Raw date text"),
          startDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
          endDate: z.string().optional().describe("End date in YYYY-MM-DD format"),
          timeRaw: z.string().optional().describe("Raw time text like '9am-3pm'"),
          priceRaw: z.string().optional().describe("Raw price text like '$350'"),
          ageGradeRaw: z.string().optional().describe("Age or grade range like 'Ages 5-12'"),
          location: z.string().optional().describe("Location name"),
          registrationUrl: z.string().optional().describe("URL to register"),
          isAvailable: z.boolean().optional().describe("Whether spots are available"),
          category: z.string().optional().describe("Category like 'Sports', 'STEM', 'Arts'"),
          imageUrls: z.array(z.string()).optional().describe("URLs of camp/session images"),
        })),
        organization: z.object({
          name: z.string().optional(),
          description: z.string().optional(),
          website: z.string().optional(),
          logoUrl: z.string().optional(),
        }).optional(),
      });

      const extracted = await stagehand.extract(args.instruction, schema);

      await stagehand.close();

      const sessions: ScrapedSession[] = (extracted.sessions || []).map((s) => ({
        name: s.name || "",
        description: s.description,
        dateRaw: s.dateRaw,
        startDate: s.startDate,
        endDate: s.endDate,
        timeRaw: s.timeRaw,
        priceRaw: s.priceRaw,
        ageGradeRaw: s.ageGradeRaw,
        location: s.location,
        registrationUrl: s.registrationUrl,
        isAvailable: s.isAvailable,
        category: s.category,
        imageUrls: s.imageUrls,
      }));

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
