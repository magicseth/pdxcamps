/**
 * Deduplication
 *
 * Prevents creating duplicate sessions when re-scraping.
 * Uses source ID, start date, and name similarity to detect duplicates.
 */

import { internalQuery, internalMutation } from '../_generated/server';
import { v } from 'convex/values';
import { Doc } from '../_generated/dataModel';

/**
 * Find an existing session that matches the given criteria
 * Returns the existing session if found, null otherwise
 */
export const findExistingSession = internalQuery({
  args: {
    sourceId: v.id('scrapeSources'),
    organizationId: v.optional(v.id('organizations')),
    name: v.string(),
    startDate: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<'sessions'> | null> => {
    // Find sessions from the same source with the same start date
    const candidates = await ctx.db
      .query('sessions')
      .withIndex('by_source', (q) => q.eq('sourceId', args.sourceId))
      .filter((q) => q.eq(q.field('startDate'), args.startDate))
      .collect();

    // Check name similarity for each candidate
    for (const session of candidates) {
      const sessionName = session.campName || '';
      if (similarity(sessionName, args.name) > 0.8) {
        return session;
      }
    }

    // Fallback: search by organization if no source match found
    // This handles sessions imported before sourceId tracking was added
    if (args.organizationId) {
      const orgCandidates = await ctx.db
        .query('sessions')
        .withIndex('by_organization_and_status', (q) => q.eq('organizationId', args.organizationId!))
        .filter((q) => q.eq(q.field('startDate'), args.startDate))
        .collect();

      for (const session of orgCandidates) {
        const sessionName = session.campName || '';
        if (similarity(sessionName, args.name) > 0.8) {
          return session;
        }
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
    sourceId: v.id('scrapeSources'),
    sessions: v.array(
      v.object({
        name: v.string(),
        startDate: v.string(),
      }),
    ),
  },
  handler: async (ctx, args): Promise<Map<string, Doc<'sessions'>>> => {
    // Get all sessions from this source
    const existingSessions = await ctx.db
      .query('sessions')
      .withIndex('by_source', (q) => q.eq('sourceId', args.sourceId))
      .collect();

    const matches = new Map<string, Doc<'sessions'>>();

    for (const candidate of args.sessions) {
      const key = `${candidate.name}|${candidate.startDate}`;

      for (const existing of existingSessions) {
        if (existing.startDate === candidate.startDate && similarity(existing.campName || '', candidate.name) > 0.8) {
          matches.set(key, existing);
          break;
        }
      }
    }

    return matches;
  },
});

/**
 * Find an existing camp by organization and normalized name.
 * Used to avoid creating duplicate camp records for grade/age variants.
 */
export const findExistingCamp = internalQuery({
  args: {
    organizationId: v.id('organizations'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const camps = await ctx.db
      .query('camps')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    for (const camp of camps) {
      if (similarity(camp.name, args.name) > 0.8) {
        return camp;
      }
    }
    return null;
  },
});

/**
 * Update an existing session with new scraped data
 */
export const updateExistingSession = internalMutation({
  args: {
    sessionId: v.id('sessions'),
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
      throw new Error('Session not found');
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
 * Normalize a session name by stripping grade/age suffixes
 * e.g. "Pottery Studio (Grades 3-5)" → "pottery studio"
 */
export function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\s*\(grades?\s*[\d\-kK]+\s*(?:-\s*[\d\-kK]+)?\)\s*$/i, '')
    .replace(/\s*\(ages?\s*\d+\s*(?:-\s*\d+)?\)\s*$/i, '')
    .trim();
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a value between 0 (completely different) and 1 (identical)
 * Normalizes names by stripping grade/age suffixes before comparing
 */
export function similarity(a: string, b: string): number {
  const aNorm = normalizeName(a);
  const bNorm = normalizeName(b);

  if (aNorm === bNorm) return 1;
  if (aNorm.length === 0 || bNorm.length === 0) return 0;

  const maxLen = Math.max(aNorm.length, bNorm.length);
  const distance = levenshtein(aNorm, bNorm);

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
          matrix[i - 1][j] + 1, // deletion
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
export function generateDedupeKey(sourceId: string, name: string, startDate: string): string {
  const normalizedName = name.toLowerCase().trim().replace(/\s+/g, ' ');
  return `${sourceId}:${normalizedName}:${startDate}`;
}

// ============================================
// 10F: Cross-source duplicate detection
// ============================================

/**
 * A cross-source duplicate group: sessions from different sources
 * that appear to represent the same camp session.
 */
interface CrossSourceDuplicate {
  organizationId: string;
  startDate: string;
  sessions: Array<{
    sessionId: string;
    sourceId: string;
    campName: string;
    similarityScore: number;
  }>;
}

/**
 * Find sessions from DIFFERENT sources under the same organization
 * that share a start date and have >80% name similarity.
 *
 * Returns groups of potential duplicates for manual review.
 * Does NOT auto-merge -- this is informational only.
 */
export const findCrossSourceDuplicates = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<CrossSourceDuplicate[]> => {
    const maxResults = args.limit ?? 50;

    // Get all active sessions that have a sourceId
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .collect();

    // Group sessions by organizationId + startDate
    const groups = new Map<
      string,
      Array<{
        sessionId: string;
        sourceId: string;
        campName: string;
        organizationId: string;
        startDate: string;
      }>
    >();

    for (const session of sessions) {
      if (!session.sourceId || !session.organizationId) continue;

      const key = `${session.organizationId}:${session.startDate}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push({
        sessionId: session._id,
        sourceId: session.sourceId,
        campName: session.campName || '',
        organizationId: session.organizationId,
        startDate: session.startDate,
      });
    }

    const duplicates: CrossSourceDuplicate[] = [];

    // For each group, check for sessions from DIFFERENT sources with similar names
    for (const [, groupSessions] of groups) {
      // Need at least 2 sessions to have duplicates
      if (groupSessions.length < 2) continue;

      // Check all pairs for cross-source name similarity
      const matchedIndices = new Set<number>();
      const crossSourceMatches: Array<{
        sessionId: string;
        sourceId: string;
        campName: string;
        similarityScore: number;
      }> = [];

      for (let i = 0; i < groupSessions.length; i++) {
        for (let j = i + 1; j < groupSessions.length; j++) {
          // Must be from different sources
          if (groupSessions[i].sourceId === groupSessions[j].sourceId) continue;

          const sim = similarity(groupSessions[i].campName, groupSessions[j].campName);

          if (sim > 0.8) {
            if (!matchedIndices.has(i)) {
              matchedIndices.add(i);
              crossSourceMatches.push({
                sessionId: groupSessions[i].sessionId,
                sourceId: groupSessions[i].sourceId,
                campName: groupSessions[i].campName,
                similarityScore: sim,
              });
            }
            if (!matchedIndices.has(j)) {
              matchedIndices.add(j);
              crossSourceMatches.push({
                sessionId: groupSessions[j].sessionId,
                sourceId: groupSessions[j].sourceId,
                campName: groupSessions[j].campName,
                similarityScore: sim,
              });
            }
          }
        }
      }

      if (crossSourceMatches.length >= 2) {
        duplicates.push({
          organizationId: groupSessions[0].organizationId,
          startDate: groupSessions[0].startDate,
          sessions: crossSourceMatches,
        });

        if (duplicates.length >= maxResults) break;
      }
    }

    return duplicates;
  },
});

/**
 * Detect cross-source duplicates and create alerts for review.
 * Called by the daily dedup cron. Does NOT auto-merge -- only logs and alerts.
 */
export const detectAndAlertCrossSourceDuplicates = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Inline the cross-source detection logic (can't call internalQuery from mutation)
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .collect();

    // Group sessions by organizationId + startDate
    const groups = new Map<
      string,
      Array<{
        sessionId: string;
        sourceId: string;
        campName: string;
        organizationId: string;
        startDate: string;
      }>
    >();

    for (const session of sessions) {
      if (!session.sourceId || !session.organizationId) continue;

      const key = `${session.organizationId}:${session.startDate}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push({
        sessionId: session._id,
        sourceId: session.sourceId,
        campName: session.campName || '',
        organizationId: session.organizationId,
        startDate: session.startDate,
      });
    }

    let totalDuplicateGroups = 0;

    for (const [, groupSessions] of groups) {
      if (groupSessions.length < 2) continue;

      let hasCrossSourceDupe = false;
      for (let i = 0; i < groupSessions.length && !hasCrossSourceDupe; i++) {
        for (let j = i + 1; j < groupSessions.length && !hasCrossSourceDupe; j++) {
          if (groupSessions[i].sourceId === groupSessions[j].sourceId) continue;
          const sim = similarity(groupSessions[i].campName, groupSessions[j].campName);
          if (sim > 0.8) {
            hasCrossSourceDupe = true;
          }
        }
      }

      if (hasCrossSourceDupe) {
        totalDuplicateGroups++;
      }
    }

    if (totalDuplicateGroups > 0) {
      console.log(`[CrossSourceDedup] Found ${totalDuplicateGroups} cross-source duplicate groups`);

      // Create a single summary alert (not one per group)
      await ctx.db.insert('scraperAlerts', {
        sourceId: undefined,
        alertType: 'cross_source_duplicates',
        message: `Found ${totalDuplicateGroups} potential cross-source duplicate session groups. Use findCrossSourceDuplicates query to review.`,
        severity: 'info',
        createdAt: Date.now(),
        acknowledgedAt: undefined,
        acknowledgedBy: undefined,
      });
    }

    return { duplicateGroups: totalDuplicateGroups };
  },
});
