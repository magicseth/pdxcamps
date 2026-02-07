/**
 * Pre-computed weekly session availability aggregates.
 *
 * Stores compact session summaries per week per city so the planner grid
 * can load instantly. Supports client-side filtering by age, grade,
 * category, and organization.
 *
 * Recomputed after scrape imports and periodically via cron.
 */

import { internalMutation, internalAction, query } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { getFamily } from '../lib/auth';
import { generateSummerWeeks } from '../lib/helpers';

/**
 * Recompute weekly availability for a single city + year.
 * Called after scrape jobs complete and periodically via cron.
 */
export const recomputeForCity = internalMutation({
  args: {
    cityId: v.id('cities'),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const weeks = generateSummerWeeks(args.year);
    if (weeks.length === 0) return;

    const summerStart = weeks[0].startDate;
    const summerEnd = weeks[weeks.length - 1].endDate;

    // Load active sessions that could overlap summer
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_city_and_status_and_start_date', (q) =>
        q.eq('cityId', args.cityId).eq('status', 'active').lte('startDate', summerEnd),
      )
      .collect();

    // Filter: must overlap summer and have spots
    const available = sessions.filter((s) => s.endDate >= summerStart && s.capacity > s.enrolledCount);

    // Fetch camp records for sessions missing denormalized categories
    const sessionsNeedingCamps = available.filter((s) => !s.campCategories);
    const campIds = [...new Set(sessionsNeedingCamps.map((s) => s.campId))];
    const campsRaw = await Promise.all(campIds.map((id) => ctx.db.get(id)));
    const campMap = new Map(campsRaw.filter((c): c is NonNullable<typeof c> => c !== null).map((c) => [c._id, c]));

    // Fetch org names for all orgs referenced by available sessions
    const orgIds = [...new Set(available.map((s) => s.organizationId))];
    const orgsRaw = await Promise.all(orgIds.map((id) => ctx.db.get(id)));
    const orgsFiltered = orgsRaw.filter((o): o is NonNullable<typeof o> => o !== null);

    // Resolve logo storage IDs to URLs
    const logoUrls = await Promise.all(
      orgsFiltered.map(async (o) => {
        if (o.logoStorageId) {
          const url = await ctx.storage.getUrl(o.logoStorageId);
          return [o._id, url] as const;
        }
        return [o._id, null] as const;
      }),
    );
    const logoUrlMap = new Map(logoUrls);

    const orgMap = new Map(
      orgsFiltered.map((o) => [o._id, { name: o.name, logoUrl: logoUrlMap.get(o._id) ?? undefined }]),
    );

    // Build per-week session summaries, deduplicating identical entries
    const weekData: Record<
      string,
      Array<{
        minAge?: number;
        maxAge?: number;
        minGrade?: number;
        maxGrade?: number;
        cats: string[];
        orgId: string;
        orgName: string;
        orgLogoUrl?: string;
        n?: number; // session count (omitted when 1)
      }>
    > = {};

    for (const week of weeks) {
      const overlapping = available.filter((s) => s.startDate <= week.endDate && s.endDate >= week.startDate);

      if (overlapping.length === 0) continue;

      // Aggregate identical entries to reduce document size
      const buckets = new Map<
        string,
        {
          minAge?: number;
          maxAge?: number;
          minGrade?: number;
          maxGrade?: number;
          cats: string[];
          orgId: string;
          orgName: string;
          orgLogoUrl?: string;
          n: number;
        }
      >();

      for (const s of overlapping) {
        const org = orgMap.get(s.organizationId);
        const cats = s.campCategories || campMap.get(s.campId)?.categories || [];
        const key = `${s.organizationId}|${s.ageRequirements.minAge ?? ''}|${s.ageRequirements.maxAge ?? ''}|${s.ageRequirements.minGrade ?? ''}|${s.ageRequirements.maxGrade ?? ''}|${cats.sort().join(',')}`;

        const existing = buckets.get(key);
        if (existing) {
          existing.n++;
        } else {
          buckets.set(key, {
            minAge: s.ageRequirements.minAge,
            maxAge: s.ageRequirements.maxAge,
            minGrade: s.ageRequirements.minGrade,
            maxGrade: s.ageRequirements.maxGrade,
            cats,
            orgId: s.organizationId,
            orgName: s.organizationName || org?.name || 'Unknown',
            orgLogoUrl: org?.logoUrl,
            n: 1,
          });
        }
      }

      weekData[week.startDate] = Array.from(buckets.values()).map((b) => (b.n === 1 ? { ...b, n: undefined } : b));
    }

    // Upsert the aggregate document
    const existing = await ctx.db
      .query('weeklyAvailability')
      .withIndex('by_city_year', (q) => q.eq('cityId', args.cityId).eq('year', args.year))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        counts: weekData,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('weeklyAvailability', {
        cityId: args.cityId,
        year: args.year,
        counts: weekData,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Recompute for all active cities. Called by cron.
 */
export const recomputeAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    // Compute for current year, and next year if September or later
    const years = [currentYear];
    if (currentMonth >= 8) years.push(currentYear + 1);

    // Get all active cities
    const { api: _api } = await import('../_generated/api');
    // Use internal query to get cities - we'll just call the mutation for known cities
    // For now, recompute for all cities by querying them
    for (const year of years) {
      await ctx.runMutation(internal.planner.aggregates.recomputeAllCitiesMutation, {
        year,
      });
    }
  },
});

/**
 * Helper mutation to find active cities and schedule recomputes.
 */
export const recomputeAllCitiesMutation = internalMutation({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const cities = await ctx.db
      .query('cities')
      .withIndex('by_is_active', (q) => q.eq('isActive', true))
      .collect();

    for (const city of cities) {
      await ctx.scheduler.runAfter(0, internal.planner.aggregates.recomputeForCity, {
        cityId: city._id,
        year: args.year,
      });
    }
  },
});

/**
 * Read the pre-computed weekly availability.
 * Returns raw session summaries so the client can filter by category, org, etc.
 */
export const getWeeklyAvailability = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const family = await getFamily(ctx);
    if (!family) return null;

    const doc = await ctx.db
      .query('weeklyAvailability')
      .withIndex('by_city_year', (q) => q.eq('cityId', family.primaryCityId).eq('year', args.year))
      .unique();

    if (!doc) return null;

    return {
      weeks: doc.counts as Record<
        string,
        Array<{
          minAge?: number;
          maxAge?: number;
          minGrade?: number;
          maxGrade?: number;
          cats: string[];
          orgId: string;
          orgName: string;
          orgLogoUrl?: string;
          n?: number;
        }>
      >,
      updatedAt: doc.updatedAt,
    };
  },
});
