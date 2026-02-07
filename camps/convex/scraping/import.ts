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
  // Flexible date tracking for directory sources
  isFlexible?: boolean;
  flexibleDateRange?: string;
  // Overnight/residential camp flag
  isOvernight?: boolean;
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
      // Track if this is a flexible date (e.g., "Summer 2026")
      if (parsed.isFlexible) {
        enriched.isFlexible = true;
        enriched.flexibleDateRange = enriched.dateRaw;
      }
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

  // Default times to typical camp hours (9am-3pm) if not specified
  // This allows directory sources to pass validation
  if (enriched.dropOffHour === undefined) {
    enriched.dropOffHour = 9;
    enriched.dropOffMinute = 0;
  }
  if (enriched.pickUpHour === undefined) {
    enriched.pickUpHour = 15; // 3pm
    enriched.pickUpMinute = 0;
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

  // Detect overnight camps from name or description
  if (enriched.isOvernight === undefined) {
    const textToSearch = `${enriched.name || ''} ${enriched.description || ''}`.toLowerCase();
    const overnightKeywords = ['overnight', 'sleepaway', 'residential', 'sleep-away'];
    enriched.isOvernight = overnightKeywords.some(keyword => textToSearch.includes(keyword));
  }

  return enriched;
}

/**
 * Expand flexible date sessions (e.g., "Summer 2026") into weekly sessions.
 * This is necessary because camps with "Summer 2026" dates need to be broken
 * into individual weeks so users can actually book specific weeks.
 */
function expandFlexibleSessions(sessions: ScrapedSession[]): ScrapedSession[] {
  const expanded: ScrapedSession[] = [];

  for (const session of sessions) {
    // If not a flexible date session, keep as-is
    if (!session.isFlexible || !session.startDate || !session.endDate) {
      expanded.push(session);
      continue;
    }

    // Calculate the span in days
    const startDate = new Date(session.startDate);
    const endDate = new Date(session.endDate);
    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // If span is 3 weeks or less, keep as single session
    if (daysDiff <= 21) {
      expanded.push(session);
      continue;
    }

    // Generate weekly sessions (Mon-Fri)
    // Find the first Monday on or after the start date
    const currentDate = new Date(startDate);
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 1) {
      // Move to next Monday (or current day if already Monday)
      const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
      currentDate.setDate(currentDate.getDate() + daysUntilMonday);
    }

    let weekNumber = 1;
    while (currentDate < endDate) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 4); // Friday (4 days after Monday)

      // Don't create sessions that extend past the end date
      if (weekStart > endDate) break;

      // Create a weekly session
      const weeklySession: ScrapedSession = {
        ...session,
        name: `${session.name} - Week ${weekNumber}`,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        // Clear flexible flag since this is now a concrete week
        isFlexible: false,
        // Keep original date range for reference
        flexibleDateRange: session.dateRaw || session.flexibleDateRange,
      };

      expanded.push(weeklySession);
      weekNumber++;

      // Move to next Monday
      currentDate.setDate(currentDate.getDate() + 7);
    }
  }

  return expanded;
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

      // Get the city for this source
      const cityId = source.cityId;
      if (!cityId) {
        return {
          success: false,
          campsCreated: 0,
          sessionsCreated: 0,
          sessionsAsDraft: 0,
          sessionsPending: 0,
          locationsCreated: 0,
          duplicatesSkipped: 0,
          errors: ["Source has no cityId"],
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
            cityId: cityId,
          }
        );

        // Link organization to source
        await ctx.runMutation(api.scraping.mutations.linkOrganizationToSource, {
          sourceId: rawData.sourceId,
          organizationId,
        });
      }

      // Pre-process sessions:
      // 1. Enrich with parsed data (to detect flexible dates like "Summer 2026")
      // 2. Expand flexible date sessions into weekly sessions
      const enrichedSessions = result.sessions.map(s => enrichSessionWithParsedData(s));
      const expandedSessions = expandFlexibleSessions(enrichedSessions);

      // Group sessions by camp name (theme)
      // Use original name (without week suffix) for grouping
      const sessionsByTheme = new Map<string, ScrapedSession[]>();
      for (const session of expandedSessions) {
        // Strip " - Week N" suffix for grouping purposes
        const baseName = session.name.replace(/ - Week \d+$/, '');
        const key = session.sourceProductId || baseName;
        if (!sessionsByTheme.has(key)) {
          sessionsByTheme.set(key, []);
        }
        sessionsByTheme.get(key)!.push(session);
      }

      // Track locations we've created
      const locationCache = new Map<string, Id<"locations">>();

      // Track completeness scores for quality calculation
      const allCompletenessScores: number[] = [];

      // Track price stats for zero-price alerting
      let totalSessionsProcessed = 0;
      let zeroPriceSessions = 0;

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
        // Note: sessions are already enriched and expanded from pre-processing
        for (const session of sessions) {
          // Track price stats for alerting
          totalSessionsProcessed++;
          if (session.priceInCents === 0 || session.priceInCents === undefined) {
            zeroPriceSessions++;
          }

          // Validate the session
          const validation = validateSession(session);
          allCompletenessScores.push(validation.completenessScore);

          // Determine what to do based on completeness and price
          const sessionStatus = determineSessionStatus({
            completenessScore: validation.completenessScore,
            priceInCents: session.priceInCents,
            priceRaw: session.priceRaw,
          });

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
              cityId: cityId,
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
                rawData: JSON.stringify(session),
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
              organizationId,
              name: session.name,
              startDate: session.startDate,
            }
          );

          if (existingSession) {
            // Update price if we have better data and existing is missing
            const shouldUpdatePrice =
              session.priceInCents &&
              session.priceInCents > 0 &&
              (!existingSession.price || existingSession.price === 0);
            // Always update availability when we have fresh spotsLeft data
            const shouldUpdateCapacity =
              session.spotsLeft !== undefined && session.spotsLeft >= 0;

            if (shouldUpdatePrice || shouldUpdateCapacity) {
              await ctx.runMutation(
                internal.scraping.importMutations.updateSessionPriceAndCapacity,
                {
                  sessionId: existingSession._id,
                  price: shouldUpdatePrice ? session.priceInCents : undefined,
                  capacity: shouldUpdateCapacity ? session.spotsLeft : undefined,
                  sourceId: rawData.sourceId,
                }
              );
            }
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
                cityId: cityId,
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
                // Capacity fields - use spotsLeft as capacity if capacity not provided
                capacity: session.capacity ?? session.spotsLeft,
                enrolledCount: session.enrolledCount,
                // Overnight camp detection
                isOvernight: session.isOvernight,
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
      // Session counts are passed as arguments to avoid read-write conflicts
      const quality = calculateSourceQuality(
        allCompletenessScores.map((score) => ({ completenessScore: score }))
      );

      // Total sessions created (both active and draft)
      const totalSessionCount = sessionsCreated + sessionsAsDraft;

      await ctx.runMutation(
        internal.scraping.importMutations.updateSourceSessionCounts,
        {
          sourceId: rawData.sourceId,
          sessionCount: totalSessionCount,
          activeSessionCount: sessionsCreated, // Only fully complete sessions are "active"
          dataQualityScore: quality.score,
          qualityTier: quality.tier,
        }
      );

      // Check for suspicious zero-price pattern and create alert
      // Alert if >80% of sessions have $0 price - indicates price extraction may be broken
      const zeroPriceThreshold = 0.8;
      if (
        totalSessionsProcessed >= 3 && // Need at least 3 sessions to be meaningful
        zeroPriceSessions / totalSessionsProcessed > zeroPriceThreshold
      ) {
        const zeroPricePercent = Math.round(
          (zeroPriceSessions / totalSessionsProcessed) * 100
        );
        await ctx.runMutation(internal.scraping.importMutations.createZeroPriceAlert, {
          sourceId: rawData.sourceId,
          sourceName: source.name,
          zeroPricePercent,
          zeroPriceCount: zeroPriceSessions,
          totalCount: totalSessionsProcessed,
        });
      }

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
