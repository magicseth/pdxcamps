"use node";

import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

// TODO: Add Stagehand integration
// import { Stagehand } from "convex-stagehand";
// import { components } from "../_generated/api";
// import { z } from "zod";
//
// const stagehand = new Stagehand(components.stagehand, {
//   browserbaseApiKey: process.env.BROWSERBASE_API_KEY!,
//   browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID!,
//   modelApiKey: process.env.MODEL_API_KEY!,
// });

// Types for extracted session data
interface ExtractedSession {
  name: string;
  dates: {
    startDate: string;
    endDate: string;
  };
  price?: number;
  ageRange?: {
    minAge?: number;
    maxAge?: number;
  };
  status?: string;
  registrationUrl?: string;
  rawHtml?: string;
}

interface ScrapeResult {
  success: boolean;
  sessions: ExtractedSession[];
  error?: string;
  pagesScraped: number;
  rawData: string;
  jobId?: Id<"scrapeJobs">;
}

/**
 * Execute a scrape for a given source
 * Main scrape action that orchestrates the scraping process
 */
export const executeScrape = action({
  args: {
    sourceId: v.id("scrapeSources"),
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ScrapeResult> => {
    // 1. Get the scrape source config
    const source = await ctx.runQuery(api.scraping.queries.getScrapeSource, {
      sourceId: args.sourceId,
    });

    if (!source) {
      throw new Error("Scrape source not found");
    }

    if (!source.isActive) {
      throw new Error("Scrape source is not active");
    }

    // 2. Create a job record
    const jobId = await ctx.runMutation(api.scraping.mutations.createScrapeJob, {
      sourceId: args.sourceId,
      triggeredBy: args.triggeredBy,
    });

    // 3. Start the job
    await ctx.runMutation(api.scraping.mutations.startScrapeJob, {
      jobId,
    });

    const config = source.scraperConfig;
    if (!config) {
      throw new Error("Scrape source has no scraper configuration");
    }

    let allSessions: ExtractedSession[] = [];
    let pagesScraped = 0;
    const rawDataAccumulator: unknown[] = [];

    try {
      // 4. Fetch URL(s) based on config
      for (const entryPoint of config.entryPoints) {
        const result = await scrapeUrl(entryPoint.url, config);
        allSessions = allSessions.concat(result.sessions);
        pagesScraped += result.pagesScraped;
        rawDataAccumulator.push({
          url: entryPoint.url,
          type: entryPoint.type,
          data: result.rawData,
        });
      }

      // 5. Store raw data
      const rawJson = JSON.stringify(rawDataAccumulator);
      await ctx.runMutation(api.scraping.mutations.storeRawData, {
        jobId,
        rawJson,
      });

      // 6. Update health metrics (internal)
      await ctx.runMutation(internal.scraping.internal.updateScraperHealth, {
        sourceId: args.sourceId,
        success: true,
      });

      // 7. Schedule next scrape (internal)
      await ctx.runMutation(internal.scraping.internal.scheduleNextScrape, {
        sourceId: args.sourceId,
      });

      return {
        success: true,
        sessions: allSessions,
        pagesScraped,
        rawData: rawJson,
        jobId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Mark job as failed
      await ctx.runMutation(api.scraping.mutations.failScrapeJob, {
        jobId,
        errorMessage,
      });

      // Still schedule next scrape attempt
      await ctx.runMutation(internal.scraping.internal.scheduleNextScrape, {
        sourceId: args.sourceId,
      });

      return {
        success: false,
        sessions: [],
        error: errorMessage,
        pagesScraped,
        rawData: JSON.stringify(rawDataAccumulator),
        jobId,
      };
    }
  },
});

/**
 * Internal helper to scrape a single URL
 * This is where browser automation would happen
 */
async function scrapeUrl(
  url: string,
  config: {
    requiresJavaScript: boolean;
    waitForSelector?: string;
    sessionExtraction: {
      containerSelector: string;
      fields: {
        name: { selector: string };
        dates: { selector: string; format: string };
        price?: { selector: string };
        ageRange?: { selector: string; pattern: string };
        status?: { selector: string; soldOutIndicators: string[] };
        registrationUrl?: { selector: string };
      };
    };
    pagination?: {
      type: string;
      selector?: string;
    };
  }
): Promise<{
  sessions: ExtractedSession[];
  pagesScraped: number;
  rawData: unknown;
}> {
  if (config.requiresJavaScript) {
    // TODO: Use Stagehand for JavaScript-rendered pages
    // Example with Stagehand Convex component:
    //
    // const result = await stagehand.extract(ctx, {
    //   url: url,
    //   instruction: "Extract all summer camp sessions with their names, dates, prices, and availability status",
    //   schema: z.object({
    //     sessions: z.array(z.object({
    //       name: z.string(),
    //       startDate: z.string(),
    //       endDate: z.string(),
    //       price: z.string().optional(),
    //       status: z.string().optional(),
    //       registrationUrl: z.string().optional(),
    //     }))
    //   })
    // });

    console.log(`[Scraper] Would use Stagehand to scrape: ${url}`);
    console.log(`[Scraper] Wait for selector: ${config.waitForSelector}`);
    console.log(
      `[Scraper] Container selector: ${config.sessionExtraction.containerSelector}`
    );

    // Simulated response for development
    return {
      sessions: [],
      pagesScraped: 1,
      rawData: {
        url,
        scrapedAt: new Date().toISOString(),
        method: "stagehand_stub",
        html: null,
      },
    };
  } else {
    // For static pages, use simple fetch
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; PDXCampsBot/1.0; +https://pdxcamps.com/bot)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error: ${response.status} ${response.statusText}`
        );
      }

      const html = await response.text();

      // TODO: Parse HTML with selectors from config
      const sessions = extractSessionsFromHtml(html, config.sessionExtraction);

      return {
        sessions,
        pagesScraped: 1,
        rawData: {
          url,
          scrapedAt: new Date().toISOString(),
          method: "fetch",
          htmlLength: html.length,
          htmlPreview: html.substring(0, 10000),
        },
      };
    } catch (error) {
      console.error(`[Scraper] Error fetching ${url}:`, error);
      throw error;
    }
  }
}

/**
 * Extract sessions from HTML using CSS selectors
 * Stub implementation - would use cheerio or similar in production
 */
function extractSessionsFromHtml(
  _html: string,
  _extraction: {
    containerSelector: string;
    fields: {
      name: { selector: string };
      dates: { selector: string; format: string };
      price?: { selector: string };
      ageRange?: { selector: string; pattern: string };
      status?: { selector: string; soldOutIndicators: string[] };
      registrationUrl?: { selector: string };
    };
  }
): ExtractedSession[] {
  // TODO: Implement actual HTML parsing with cheerio
  // import * as cheerio from 'cheerio';
  // const $ = cheerio.load(html);
  // const containers = $(extraction.containerSelector);
  // return containers.map((_, el) => ({
  //   name: $(el).find(extraction.fields.name.selector).text(),
  //   dates: parseDates($(el).find(extraction.fields.dates.selector).text()),
  //   ...
  // })).get();

  console.log("[Scraper] Would extract sessions using selectors");
  return [];
}

/**
 * Process scraped raw data into sessions
 * Normalizes data and upserts sessions, detecting changes
 */
export const processScrapedData = action({
  args: {
    jobId: v.id("scrapeJobs"),
  },
  handler: async (ctx, args) => {
    // 1. Get the job and raw data
    const job = await ctx.runQuery(api.scraping.queries.getScrapeJob, {
      jobId: args.jobId,
    });

    if (!job) {
      throw new Error("Scrape job not found");
    }

    if (!job.rawData || job.rawData.length === 0) {
      throw new Error("No raw data found for job");
    }

    const source = job.source;
    if (!source) {
      throw new Error("Source not found for job");
    }

    let sessionsCreated = 0;
    let sessionsUpdated = 0;
    let sessionsFound = 0;
    const errors: string[] = [];

    // 2. Process each raw data record
    for (const rawDataRecord of job.rawData) {
      try {
        const rawData = JSON.parse(rawDataRecord.rawJson);

        // Handle array of scraped pages
        const pages = Array.isArray(rawData) ? rawData : [rawData];

        for (const pageData of pages) {
          // Skip if no actual session data
          if (!pageData.sessions || !Array.isArray(pageData.sessions)) {
            continue;
          }

          for (const sessionData of pageData.sessions) {
            sessionsFound++;

            try {
              // 3. Normalize to session format
              const normalizedSession = normalizeSessionData(sessionData, source);

              if (!normalizedSession) {
                errors.push(`Failed to normalize session: ${sessionData.name}`);
                continue;
              }

              // 4. Check if session already exists
              const existingSession = await findExistingSession(
                ctx,
                source._id,
                normalizedSession
              );

              if (existingSession) {
                // 5. Detect and record changes
                const changes = detectChanges(existingSession, normalizedSession);

                if (changes.length > 0) {
                  for (const change of changes) {
                    await ctx.runMutation(api.scraping.mutations.recordChange, {
                      jobId: args.jobId,
                      sessionId: existingSession._id,
                      changeType: change.type,
                      previousValue: change.previousValue,
                      newValue: change.newValue,
                    });
                  }
                  sessionsUpdated++;
                }
              } else {
                sessionsCreated++;

                await ctx.runMutation(api.scraping.mutations.recordChange, {
                  jobId: args.jobId,
                  sessionId: undefined,
                  changeType: "session_added",
                  previousValue: undefined,
                  newValue: JSON.stringify({
                    name: normalizedSession.name,
                    startDate: normalizedSession.startDate,
                    endDate: normalizedSession.endDate,
                  }),
                });
              }

              // Mark raw data as processed
              await ctx.runMutation(
                internal.scraping.internal.markRawDataProcessed,
                {
                  rawDataId: rawDataRecord._id,
                  resultingSessionId: existingSession?._id,
                  processingError: undefined,
                }
              );
            } catch (sessionError) {
              const errorMsg =
                sessionError instanceof Error
                  ? sessionError.message
                  : "Unknown error processing session";
              errors.push(errorMsg);
            }
          }
        }
      } catch (parseError) {
        const errorMsg =
          parseError instanceof Error
            ? parseError.message
            : "Failed to parse raw data";
        errors.push(errorMsg);

        await ctx.runMutation(internal.scraping.internal.markRawDataProcessed, {
          rawDataId: rawDataRecord._id,
          resultingSessionId: undefined,
          processingError: errorMsg,
        });
      }
    }

    // 6. Update job completion stats
    await ctx.runMutation(api.scraping.mutations.completeScrapeJob, {
      jobId: args.jobId,
      sessionsFound,
      sessionsCreated,
      sessionsUpdated,
    });

    // Create alert if high change volume
    if (sessionsCreated + sessionsUpdated > 20) {
      await ctx.runMutation(api.scraping.mutations.createAlert, {
        sourceId: source._id,
        alertType: "high_change_volume",
        message: `High change volume: ${sessionsCreated} created, ${sessionsUpdated} updated from "${source.name}"`,
        severity: "info",
      });
    }

    return {
      success: errors.length === 0,
      sessionsFound,
      sessionsCreated,
      sessionsUpdated,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
});

/**
 * Normalize extracted session data to the database format
 */
function normalizeSessionData(
  _sessionData: ExtractedSession,
  _source: { _id: Id<"scrapeSources">; organizationId?: Id<"organizations"> }
): {
  name: string;
  startDate: string;
  endDate: string;
  price?: number;
  ageRequirements?: { minAge?: number; maxAge?: number };
  status?: string;
  externalRegistrationUrl?: string;
} | null {
  // TODO: Implement actual normalization logic
  console.log("[Processor] Would normalize session data");
  return null;
}

/**
 * Find an existing session that matches the scraped data
 */
async function findExistingSession(
  _ctx: unknown,
  _sourceId: Id<"scrapeSources">,
  _normalizedSession: {
    name: string;
    startDate: string;
    endDate: string;
  }
): Promise<{ _id: Id<"sessions">; price: number; status: string } | null> {
  // TODO: Implement session matching logic
  console.log("[Processor] Would find existing session");
  return null;
}

/**
 * Detect changes between existing and new session data
 */
function detectChanges(
  existing: { price: number; status: string },
  normalized: { price?: number; status?: string }
): Array<{
  type: "status_changed" | "price_changed" | "dates_changed";
  previousValue: string;
  newValue: string;
}> {
  const changes: Array<{
    type: "status_changed" | "price_changed" | "dates_changed";
    previousValue: string;
    newValue: string;
  }> = [];

  if (normalized.price !== undefined && existing.price !== normalized.price) {
    changes.push({
      type: "price_changed",
      previousValue: existing.price.toString(),
      newValue: normalized.price.toString(),
    });
  }

  if (normalized.status !== undefined && existing.status !== normalized.status) {
    changes.push({
      type: "status_changed",
      previousValue: existing.status,
      newValue: normalized.status,
    });
  }

  return changes;
}

/**
 * Internal action for executing scrapes from scheduler
 */
export const internalExecuteScrape = internalAction({
  args: {
    sourceId: v.id("scrapeSources"),
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ScrapeResult> => {
    const source = await ctx.runQuery(api.scraping.queries.getScrapeSource, {
      sourceId: args.sourceId,
    });

    if (!source) {
      return {
        success: false,
        sessions: [],
        error: "Scrape source not found",
        pagesScraped: 0,
        rawData: "{}",
      };
    }

    if (!source.isActive) {
      return {
        success: false,
        sessions: [],
        error: "Scrape source is not active",
        pagesScraped: 0,
        rawData: "{}",
      };
    }

    const jobId = await ctx.runMutation(api.scraping.mutations.createScrapeJob, {
      sourceId: args.sourceId,
      triggeredBy: args.triggeredBy,
    });

    await ctx.runMutation(api.scraping.mutations.startScrapeJob, { jobId });

    const config = source.scraperConfig;
    if (!config) {
      return {
        success: false,
        sessions: [],
        error: "Scrape source has no scraper configuration",
        pagesScraped: 0,
        rawData: "{}",
      };
    }

    let allSessions: ExtractedSession[] = [];
    let pagesScraped = 0;
    const rawDataAccumulator: unknown[] = [];

    try {
      for (const entryPoint of config.entryPoints) {
        const result = await scrapeUrl(entryPoint.url, config);
        allSessions = allSessions.concat(result.sessions);
        pagesScraped += result.pagesScraped;
        rawDataAccumulator.push({
          url: entryPoint.url,
          type: entryPoint.type,
          data: result.rawData,
        });
      }

      const rawJson = JSON.stringify(rawDataAccumulator);
      await ctx.runMutation(api.scraping.mutations.storeRawData, { jobId, rawJson });

      await ctx.runMutation(internal.scraping.internal.updateScraperHealth, {
        sourceId: args.sourceId,
        success: true,
      });

      await ctx.runMutation(internal.scraping.internal.scheduleNextScrape, {
        sourceId: args.sourceId,
      });

      return {
        success: true,
        sessions: allSessions,
        pagesScraped,
        rawData: rawJson,
        jobId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await ctx.runMutation(api.scraping.mutations.failScrapeJob, { jobId, errorMessage });
      await ctx.runMutation(internal.scraping.internal.scheduleNextScrape, {
        sourceId: args.sourceId,
      });

      return {
        success: false,
        sessions: [],
        error: errorMessage,
        pagesScraped,
        rawData: JSON.stringify(rawDataAccumulator),
        jobId,
      };
    }
  },
});

/**
 * Run scheduled scrapes for all sources due
 * This action is meant to be called by a cron job
 */
export const runScheduledScrapes = internalAction({
  args: {},
  handler: async (ctx) => {
    const dueForScrape = await ctx.runQuery(
      api.scraping.queries.getSourcesDueForScrape,
      {}
    );

    const results: Array<{
      sourceId: Id<"scrapeSources">;
      sourceName: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const source of dueForScrape) {
      try {
        const scrapeResult = await ctx.runAction(
          internal.scraping.actions.internalExecuteScrape,
          {
            sourceId: source._id,
            triggeredBy: "scheduler",
          }
        );

        results.push({
          sourceId: source._id,
          sourceName: source.name,
          success: scrapeResult.success,
          error: scrapeResult.error,
        });
      } catch (error) {
        results.push({
          sourceId: source._id,
          sourceName: source.name,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      totalProcessed: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  },
});
