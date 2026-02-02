"use node";

/**
 * Import Pipeline
 *
 * Converts scraped raw data into actual camp/session records.
 * Creates organizations, camps, locations, and sessions from scrape results.
 */

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

// ============ TYPES ============

interface ScrapedSession {
  name: string;
  description?: string;
  category?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  dateRaw?: string;
  timeRaw?: string;
  dropOffHour?: number;
  dropOffMinute?: number;
  pickUpHour?: number;
  pickUpMinute?: number;
  priceInCents?: number;
  memberPriceInCents?: number;
  priceRaw?: string;
  minAge?: number;
  maxAge?: number;
  minGrade?: number;
  maxGrade?: number;
  ageGradeRaw?: string;
  registrationUrl?: string;
  sourceProductId?: string;
  imageUrls?: string[];
  isAvailable?: boolean;
}

interface ScrapedOrganization {
  name: string;
  description?: string;
  website?: string;
  logoUrl?: string;
}

interface ScrapeResult {
  success: boolean;
  sessions: ScrapedSession[];
  organization?: ScrapedOrganization;
  scrapedAt: number;
}

/**
 * Import data from a completed scrape job into actual records
 */
export const importFromJob = action({
  args: {
    jobId: v.id("scrapeJobs"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    organizationId?: Id<"organizations">;
    campsCreated: number;
    sessionsCreated: number;
    locationsCreated: number;
    errors: string[];
  }> => {
    const errors: string[] = [];
    let campsCreated = 0;
    let sessionsCreated = 0;
    let locationsCreated = 0;

    try {
      // Get the raw data
      const rawData = await ctx.runQuery(api.scraping.queries.getRawDataByJob, {
        jobId: args.jobId,
      });

      if (!rawData?.rawJson) {
        return { success: false, campsCreated: 0, sessionsCreated: 0, locationsCreated: 0, errors: ["No raw data found"] };
      }

      const scraped = JSON.parse(rawData.rawJson);
      const result: ScrapeResult = scraped.result;

      if (!result?.success || !result.sessions?.length) {
        return { success: false, campsCreated: 0, sessionsCreated: 0, locationsCreated: 0, errors: ["No sessions in scrape result"] };
      }

      // Get the source
      const source = await ctx.runQuery(api.scraping.queries.getScrapeSource, {
        sourceId: rawData.sourceId,
      });

      if (!source) {
        return { success: false, campsCreated: 0, sessionsCreated: 0, locationsCreated: 0, errors: ["Source not found"] };
      }

      // Get Portland city ID
      const portland = await ctx.runQuery(api.cities.queries.getCityBySlug, {
        slug: "portland",
      });

      if (!portland) {
        return { success: false, campsCreated: 0, sessionsCreated: 0, locationsCreated: 0, errors: ["Portland city not found"] };
      }

      // Create or get organization
      let organizationId: Id<"organizations">;

      if (source.organizationId) {
        organizationId = source.organizationId;
      } else {
        // Create organization from scrape result
        const orgData = result.organization || {
          name: source.name,
          website: source.url,
        };

        organizationId = await ctx.runMutation(api.scraping.importMutations.createOrganization, {
          name: orgData.name,
          description: orgData.description,
          website: orgData.website,
          logoUrl: orgData.logoUrl,
          cityId: portland._id,
        });

        // Link organization to source
        await ctx.runMutation(api.scraping.mutations.linkOrganizationToSource, {
          sourceId: rawData.sourceId,
          organizationId,
        });
      }

      // Group sessions by camp name (theme)
      const sessionsByTheme = new Map<string, ScrapedSession[]>();
      for (const session of result.sessions) {
        const key = session.sourceProductId || session.name;
        if (!sessionsByTheme.has(key)) {
          sessionsByTheme.set(key, []);
        }
        sessionsByTheme.get(key)!.push(session);
      }

      // Track locations we've created
      const locationCache = new Map<string, Id<"locations">>();

      // Create camps and sessions
      for (const [themeKey, sessions] of sessionsByTheme) {
        const firstSession = sessions[0];

        // Create camp
        const campId = await ctx.runMutation(api.scraping.importMutations.createCamp, {
          organizationId,
          name: firstSession.name,
          description: firstSession.description || `${firstSession.name} camp`,
          categories: firstSession.category ? [firstSession.category] : ["General"],
          minAge: firstSession.minAge,
          maxAge: firstSession.maxAge,
          minGrade: firstSession.minGrade,
          maxGrade: firstSession.maxGrade,
          website: firstSession.registrationUrl,
          imageUrls: firstSession.imageUrls,
        });
        campsCreated++;

        // Create sessions for this camp
        for (const session of sessions) {
          // Get or create location
          const locationName = session.location || "Main Location";
          let locationId: Id<"locations">;

          if (locationCache.has(locationName)) {
            locationId = locationCache.get(locationName)!;
          } else {
            locationId = await ctx.runMutation(api.scraping.importMutations.createLocation, {
              organizationId,
              name: locationName,
              cityId: portland._id,
            });
            locationCache.set(locationName, locationId);
            locationsCreated++;
          }

          // Skip sessions without dates
          if (!session.startDate) {
            continue;
          }

          // Create session
          try {
            await ctx.runMutation(api.scraping.importMutations.createSession, {
              campId,
              locationId,
              organizationId,
              cityId: portland._id,
              startDate: session.startDate,
              endDate: session.endDate || session.startDate,
              dropOffHour: session.dropOffHour ?? 9,
              dropOffMinute: session.dropOffMinute ?? 0,
              pickUpHour: session.pickUpHour ?? 15,
              pickUpMinute: session.pickUpMinute ?? 0,
              price: session.priceInCents || 0,
              minAge: session.minAge,
              maxAge: session.maxAge,
              minGrade: session.minGrade,
              maxGrade: session.maxGrade,
              registrationUrl: session.registrationUrl,
              sourceId: rawData.sourceId,
            });
            sessionsCreated++;
          } catch (e) {
            errors.push(`Session ${session.name}: ${e instanceof Error ? e.message : "Unknown error"}`);
          }
        }
      }

      return {
        success: true,
        organizationId,
        campsCreated,
        sessionsCreated,
        locationsCreated,
        errors: errors.slice(0, 20),
      };
    } catch (error) {
      return {
        success: false,
        campsCreated,
        sessionsCreated,
        locationsCreated,
        errors: [...errors, error instanceof Error ? error.message : "Unknown error"],
      };
    }
  },
});

/**
 * Import from the most recent successful job for a source
 */
export const importFromSource = action({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    organizationId?: Id<"organizations">;
    campsCreated?: number;
    sessionsCreated?: number;
    locationsCreated?: number;
    errors?: string[];
    error?: string;
  }> => {
    // Get the most recent completed job
    const jobs = await ctx.runQuery(api.scraping.queries.listScrapeJobs, {
      sourceId: args.sourceId,
      status: "completed" as const,
      limit: 1,
    });

    if (!jobs.length) {
      return { success: false, error: "No completed jobs found for this source" };
    }

    // Import from that job
    const result = await ctx.runAction(api.scraping.import.importFromJob, {
      jobId: jobs[0]._id,
    });
    return result;
  },
});
