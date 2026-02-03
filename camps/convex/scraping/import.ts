"use node";

/**
 * Import Pipeline
 *
 * Converts scraped raw data into actual camp/session records.
 * Creates organizations, camps, locations, and sessions from scrape results.
 *
 * Now includes validation:
 * - Complete sessions (100%) → create as "active"
 * - Partial sessions (50-99%) → create as "draft" with missingFields tracked
 * - Incomplete sessions (<50%) → store in pendingSessions for review
 */

import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import {
  validateSession,
  determineSessionStatus,
  calculateSourceQuality,
  parseDateRange,
  parseTimeRange,
  parsePrice,
  parseAgeRange,
} from "./validation";

// ============ ADDRESS PARSING ============

/**
 * Parse a location string into structured address components.
 * Handles formats like:
 * - "8911 SE Stark St, Portland, OR 97216"
 * - "My Voice Music, 8911 SE Stark, Portland, OR 97216"
 * - "123 Main Street Portland OR"
 */
function parseLocationString(location: string): {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
} {
  if (!location) return {};

  // Common Oregon zip code pattern at the end
  const zipMatch = location.match(/\b(97\d{3})\b/);
  const zip = zipMatch?.[1];

  // State pattern - look for OR, Oregon
  const stateMatch = location.match(/\b(OR|Oregon)\b/i);
  const state = stateMatch ? "OR" : undefined;

  // City pattern - look for Portland or common PDX cities
  const cityPattern = /\b(Portland|Beaverton|Lake Oswego|Tigard|Tualatin|Gresham|Hillsboro|Vancouver|Milwaukie|Clackamas|Oregon City|West Linn|Wilsonville)\b/i;
  const cityMatch = location.match(cityPattern);
  const city = cityMatch?.[1];

  // Street pattern - look for street number followed by street name
  // Common patterns: "123 Main St", "8911 SE Stark"
  const streetMatch = location.match(/\b(\d+\s+(?:[NSEW]\s+)?[A-Za-z]+(?:\s+[A-Za-z]+)*(?:\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Way|Dr|Drive|Ln|Lane|Ct|Court|Pl|Place))?)\b/i);
  let street = streetMatch?.[1];

  // Clean up street if it accidentally captured city/state
  if (street && city) {
    street = street.replace(new RegExp(`\\s*,?\\s*${city}.*$`, 'i'), '').trim();
  }

  return { street, city, state, zip };
}

// ============ TYPES ============

interface ScrapedSession {
  name: string;
  description?: string;
  category?: string;
  location?: string;
  // Structured address (preferred over raw location string)
  locationAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  // Pre-geocoded coordinates (if available from source)
  locationLatitude?: number;
  locationLongitude?: number;
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
  capacity?: number;
  enrolledCount?: number;
  spotsLeft?: number;
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

interface ImportResult {
  success: boolean;
  organizationId?: Id<"organizations">;
  campsCreated: number;
  sessionsCreated: number;
  sessionsAsDraft: number;
  sessionsPending: number;
  locationsCreated: number;
  duplicatesSkipped: number;
  errors: string[];
}

/**
 * Try to enrich a session with parsed data from raw fields
 */
function enrichSessionWithParsedData(session: ScrapedSession): ScrapedSession {
  const enriched = { ...session };

  // Try to parse dates from dateRaw if startDate missing
  if (!enriched.startDate && enriched.dateRaw) {
    const parsed = parseDateRange(enriched.dateRaw);
    if (parsed) {
      enriched.startDate = parsed.startDate;
      enriched.endDate = parsed.endDate;
    }
  }

  // Try to parse times from timeRaw if dropOffHour missing
  if (enriched.dropOffHour === undefined && enriched.timeRaw) {
    const parsed = parseTimeRange(enriched.timeRaw);
    if (parsed) {
      enriched.dropOffHour = parsed.dropOffHour;
      enriched.dropOffMinute = parsed.dropOffMinute;
      enriched.pickUpHour = parsed.pickUpHour;
      enriched.pickUpMinute = parsed.pickUpMinute;
    }
  }

  // Try to parse price from priceRaw if priceInCents missing
  if (enriched.priceInCents === undefined && enriched.priceRaw) {
    const parsed = parsePrice(enriched.priceRaw);
    if (parsed !== null) {
      enriched.priceInCents = parsed;
    }
  }

  // Try to parse age/grade from ageGradeRaw if missing
  if (
    enriched.minAge === undefined &&
    enriched.minGrade === undefined &&
    enriched.ageGradeRaw
  ) {
    const parsed = parseAgeRange(enriched.ageGradeRaw);
    if (parsed) {
      enriched.minAge = parsed.minAge;
      enriched.maxAge = parsed.maxAge;
      enriched.minGrade = parsed.minGrade;
      enriched.maxGrade = parsed.maxGrade;
    }
  }

  return enriched;
}

/**
 * Import data from a completed scrape job into actual records
 */
export const importFromJob = action({
  args: {
    jobId: v.id("scrapeJobs"),
  },
  handler: async (ctx, args): Promise<ImportResult> => {
    const errors: string[] = [];
    let campsCreated = 0;
    let sessionsCreated = 0;
    let sessionsAsDraft = 0;
    let sessionsPending = 0;
    let locationsCreated = 0;
    let duplicatesSkipped = 0;

    try {
      // Get the raw data
      const rawData = await ctx.runQuery(api.scraping.queries.getRawDataByJob, {
        jobId: args.jobId,
      });

      if (!rawData?.rawJson) {
        return {
          success: false,
          campsCreated: 0,
          sessionsCreated: 0,
          sessionsAsDraft: 0,
          sessionsPending: 0,
          locationsCreated: 0,
          duplicatesSkipped: 0,
          errors: ["No raw data found"],
        };
      }

      const scraped = JSON.parse(rawData.rawJson);
      const result: ScrapeResult = scraped.result;

      if (!result?.success || !result.sessions?.length) {
        return {
          success: false,
          campsCreated: 0,
          sessionsCreated: 0,
          sessionsAsDraft: 0,
          sessionsPending: 0,
          locationsCreated: 0,
          duplicatesSkipped: 0,
          errors: ["No sessions in scrape result"],
        };
      }

      // Get the source
      const source = await ctx.runQuery(api.scraping.queries.getScrapeSource, {
        sourceId: rawData.sourceId,
      });

      if (!source) {
        return {
          success: false,
          campsCreated: 0,
          sessionsCreated: 0,
          sessionsAsDraft: 0,
          sessionsPending: 0,
          locationsCreated: 0,
          duplicatesSkipped: 0,
          errors: ["Source not found"],
        };
      }

      // Get Portland city ID
      const portland = await ctx.runQuery(api.cities.queries.getCityBySlug, {
        slug: "portland",
      });

      if (!portland) {
        return {
          success: false,
          campsCreated: 0,
          sessionsCreated: 0,
          sessionsAsDraft: 0,
          sessionsPending: 0,
          locationsCreated: 0,
          duplicatesSkipped: 0,
          errors: ["Portland city not found"],
        };
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

        organizationId = await ctx.runMutation(
          api.scraping.importMutations.createOrganization,
          {
            name: orgData.name,
            description: "description" in orgData ? orgData.description : undefined,
            website: orgData.website,
            logoUrl: "logoUrl" in orgData ? orgData.logoUrl : undefined,
            cityId: portland._id,
          }
        );

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

      // Track completeness scores for quality calculation
      const allCompletenessScores: number[] = [];

      // Create camps and sessions
      for (const [themeKey, sessions] of sessionsByTheme) {
        const firstSession = sessions[0];

        // Create camp
        const campId = await ctx.runMutation(
          api.scraping.importMutations.createCamp,
          {
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
          }
        );
        campsCreated++;

        // Create sessions for this camp
        for (const rawSession of sessions) {
          // Enrich session with parsed data from raw fields
          const session = enrichSessionWithParsedData(rawSession);

          // Validate the session
          const validation = validateSession(session);
          allCompletenessScores.push(validation.completenessScore);

          // Determine what to do based on completeness
          const sessionStatus = determineSessionStatus(
            validation.completenessScore
          );

          // Get or create location
          const locationName = session.location || "Main Location";
          let locationId: Id<"locations">;

          if (locationCache.has(locationName)) {
            locationId = locationCache.get(locationName)!;
          } else {
            // Build location data from session
            let locationData: {
              organizationId: Id<"organizations">;
              name: string;
              cityId: Id<"cities">;
              street?: string;
              city?: string;
              state?: string;
              zip?: string;
              latitude?: number;
              longitude?: number;
            } = {
              organizationId,
              name: locationName,
              cityId: portland._id,
            };

            // Use structured address if available from session
            if (session.locationAddress) {
              locationData.street = session.locationAddress.street;
              locationData.city = session.locationAddress.city;
              locationData.state = session.locationAddress.state;
              locationData.zip = session.locationAddress.zip;
            }

            // If no structured address, try to parse from location string
            if (!locationData.street && locationName && locationName !== "Main Location") {
              const parsed = parseLocationString(locationName);
              if (parsed.street) locationData.street = parsed.street;
              if (parsed.city) locationData.city = parsed.city;
              if (parsed.state) locationData.state = parsed.state;
              if (parsed.zip) locationData.zip = parsed.zip;
            }

            // Use pre-geocoded coordinates if available
            if (session.locationLatitude && session.locationLongitude) {
              locationData.latitude = session.locationLatitude;
              locationData.longitude = session.locationLongitude;
            }

            // If we don't have coordinates, try to geocode
            if (!locationData.latitude || !locationData.longitude) {
              try {
                // Build a geocode query from available data
                let geocodeQuery = "";
                if (session.locationAddress?.street) {
                  geocodeQuery = `${session.locationAddress.street}, ${session.locationAddress.city || "Portland"}, ${session.locationAddress.state || "OR"} ${session.locationAddress.zip || ""}`;
                } else if (session.location && session.location !== "Main Location") {
                  geocodeQuery = session.location;
                }

                if (geocodeQuery) {
                  const geocodeResult = await ctx.runAction(
                    api.lib.geocoding.geocodeQuery,
                    {
                      query: geocodeQuery,
                      nearCity: "Portland, OR",
                    }
                  );

                  if (geocodeResult) {
                    locationData.latitude = geocodeResult.latitude;
                    locationData.longitude = geocodeResult.longitude;
                    // Fill in address components if we got them from geocoding
                    if (!locationData.street && geocodeResult.street) {
                      locationData.street = geocodeResult.street;
                    }
                    if (!locationData.city && geocodeResult.city) {
                      locationData.city = geocodeResult.city;
                    }
                    if (!locationData.state && geocodeResult.state) {
                      locationData.state = geocodeResult.state;
                    }
                    if (!locationData.zip && geocodeResult.zip) {
                      locationData.zip = geocodeResult.zip;
                    }
                  }
                }
              } catch (geocodeError) {
                // Geocoding failed, continue with defaults
                console.warn(`Geocoding failed for "${locationName}":`, geocodeError);
              }
            }

            locationId = await ctx.runMutation(
              api.scraping.importMutations.createLocation,
              locationData
            );
            locationCache.set(locationName, locationId);
            locationsCreated++;
          }

          // Handle based on session status
          if (sessionStatus === "pending_review") {
            // Store in pendingSessions for manual review
            await ctx.runMutation(
              internal.scraping.importMutations.createPendingSession,
              {
                jobId: args.jobId,
                sourceId: rawData.sourceId,
                rawData: JSON.stringify(rawSession),
                partialData: {
                  name: session.name,
                  dateRaw: session.dateRaw,
                  priceRaw: session.priceRaw,
                  ageGradeRaw: session.ageGradeRaw,
                  timeRaw: session.timeRaw,
                  location: session.location,
                  description: session.description,
                  startDate: session.startDate,
                  endDate: session.endDate,
                  registrationUrl: session.registrationUrl,
                },
                validationErrors: validation.errors,
                completenessScore: validation.completenessScore,
              }
            );
            sessionsPending++;
            continue;
          }

          // Sessions without dates still can't be created in our system
          if (!session.startDate) {
            errors.push(
              `Session "${session.name}": Missing start date even after parsing`
            );
            continue;
          }

          // Check for duplicates
          const existingSession = await ctx.runQuery(
            internal.scraping.deduplication.findExistingSession,
            {
              sourceId: rawData.sourceId,
              name: session.name,
              startDate: session.startDate,
            }
          );

          if (existingSession) {
            // Update existing session instead of creating duplicate
            duplicatesSkipped++;
            continue;
          }

          // Create session
          try {
            await ctx.runMutation(
              internal.scraping.importMutations.createSessionWithCompleteness,
              {
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
                price: session.priceInCents ?? 0,
                minAge: session.minAge,
                maxAge: session.maxAge,
                minGrade: session.minGrade,
                maxGrade: session.maxGrade,
                registrationUrl: session.registrationUrl,
                sourceId: rawData.sourceId,
                // New completeness fields
                status: sessionStatus,
                completenessScore: validation.completenessScore,
                missingFields: validation.missingFields,
                dataSource: "scraped" as const,
                // Capacity fields
                capacity: session.capacity,
                enrolledCount: session.enrolledCount,
              }
            );

            if (sessionStatus === "active") {
              sessionsCreated++;
            } else {
              sessionsAsDraft++;
            }
          } catch (e) {
            errors.push(
              `Session ${session.name}: ${e instanceof Error ? e.message : "Unknown error"}`
            );
          }
        }
      }

      // Update source session counts and quality
      // Note: sessionCount is now queried from DB in the mutation for accuracy
      const quality = calculateSourceQuality(
        allCompletenessScores.map((score) => ({ completenessScore: score }))
      );

      await ctx.runMutation(
        internal.scraping.importMutations.updateSourceSessionCounts,
        {
          sourceId: rawData.sourceId,
          dataQualityScore: quality.score,
          qualityTier: quality.tier,
        }
      );

      return {
        success: true,
        organizationId,
        campsCreated,
        sessionsCreated,
        sessionsAsDraft,
        sessionsPending,
        locationsCreated,
        duplicatesSkipped,
        errors: errors.slice(0, 20),
      };
    } catch (error) {
      return {
        success: false,
        campsCreated,
        sessionsCreated,
        sessionsAsDraft,
        sessionsPending,
        locationsCreated,
        duplicatesSkipped,
        errors: [
          ...errors,
          error instanceof Error ? error.message : "Unknown error",
        ],
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
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    organizationId?: Id<"organizations">;
    campsCreated?: number;
    sessionsCreated?: number;
    sessionsAsDraft?: number;
    sessionsPending?: number;
    locationsCreated?: number;
    duplicatesSkipped?: number;
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
