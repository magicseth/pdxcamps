/**
 * Deduplication
 *
 * Prevents creating duplicate sessions when re-scraping.
 * Uses source ID, start date, and name similarity to detect duplicates.
 */

import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Doc } from "../_generated/dataModel";

/**
 * Find an existing session that matches the given criteria
 * Returns the existing session if found, null otherwise
 */
export const findExistingSession = internalQuery({
  args: {
    sourceId: v.id("scrapeSources"),
    name: v.string(),
    startDate: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"sessions"> | null> => {
    // Find sessions from the same source with the same start date
    const candidates = await ctx.db
      .query("sessions")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .filter((q) => q.eq(q.field("startDate"), args.startDate))
      .collect();

    // Check name similarity for each candidate
    for (const session of candidates) {
      const sessionName = session.campName || "";
      if (similarity(sessionName, args.name) > 0.8) {
        return session;
      }
    }

    return null;
  },
});

/**
 * Find all sessions from a source that match given criteria
 * Useful for batch deduplication checks
 */
export const findExistingSessions = internalQuery({
  args: {
    sourceId: v.id("scrapeSources"),
    sessions: v.array(
      v.object({
        name: v.string(),
        startDate: v.string(),
      })
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<Map<string, Doc<"sessions">>> => {
    // Get all sessions from this source
    const existingSessions = await ctx.db
      .query("sessions")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .collect();

    const matches = new Map<string, Doc<"sessions">>();

    for (const candidate of args.sessions) {
      const key = `${candidate.name}|${candidate.startDate}`;

      for (const existing of existingSessions) {
        if (
          existing.startDate === candidate.startDate &&
          similarity(existing.campName || "", candidate.name) > 0.8
        ) {
          matches.set(key, existing);
          break;
        }
      }
    }

    return matches;
  },
});

/**
 * Update an existing session with new scraped data
 */
export const updateExistingSession = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    updates: v.object({
      price: v.optional(v.number()),
      endDate: v.optional(v.string()),
      dropOffHour: v.optional(v.number()),
      dropOffMinute: v.optional(v.number()),
      pickUpHour: v.optional(v.number()),
      pickUpMinute: v.optional(v.number()),
      registrationUrl: v.optional(v.string()),
      completenessScore: v.optional(v.number()),
      missingFields: v.optional(v.array(v.string())),
      capacity: v.optional(v.number()),
      enrolledCount: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const patchData: Record<string, unknown> = {
      lastScrapedAt: Date.now(),
    };

    // Only update fields that are provided and different
    if (args.updates.price !== undefined && args.updates.price !== session.price) {
      patchData.price = args.updates.price;
    }
    if (args.updates.endDate !== undefined && args.updates.endDate !== session.endDate) {
      patchData.endDate = args.updates.endDate;
    }
    if (args.updates.dropOffHour !== undefined) {
      patchData.dropOffTime = {
        hour: args.updates.dropOffHour,
        minute: args.updates.dropOffMinute ?? 0,
      };
    }
    if (args.updates.pickUpHour !== undefined) {
      patchData.pickUpTime = {
        hour: args.updates.pickUpHour,
        minute: args.updates.pickUpMinute ?? 0,
      };
    }
    if (args.updates.registrationUrl !== undefined) {
      patchData.externalRegistrationUrl = args.updates.registrationUrl;
    }
    if (args.updates.completenessScore !== undefined) {
      patchData.completenessScore = args.updates.completenessScore;
    }
    if (args.updates.missingFields !== undefined) {
      patchData.missingFields = args.updates.missingFields;
    }
    if (args.updates.capacity !== undefined) {
      patchData.capacity = args.updates.capacity;
    }
    if (args.updates.enrolledCount !== undefined) {
      patchData.enrolledCount = args.updates.enrolledCount;
    }

    await ctx.db.patch(args.sessionId, patchData);
    return args.sessionId;
  },
});

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a value between 0 (completely different) and 1 (identical)
 */
export function similarity(a: string, b: string): number {
  const aLower = a?.toLowerCase().trim() || "";
  const bLower = b?.toLowerCase().trim() || "";

  if (aLower === bLower) return 1;
  if (aLower.length === 0 || bLower.length === 0) return 0;

  const maxLen = Math.max(aLower.length, bLower.length);
  const distance = levenshtein(aLower, bLower);

  return 1 - distance / maxLen;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Generate a hash key for deduplication
 * Uses source + normalized name + start date
 */
export function generateDedupeKey(
  sourceId: string,
  name: string,
  startDate: string
): string {
  const normalizedName = name.toLowerCase().trim().replace(/\s+/g, " ");
  return `${sourceId}:${normalizedName}:${startDate}`;
}
