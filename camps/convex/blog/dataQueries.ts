import { internalQuery } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Internal queries used by blog generation actions to gather real data.
 */

export const getCityBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('cities')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();
  },
});

export const getActiveSessions = internalQuery({
  args: { cityId: v.string() },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_city_and_status', (q) =>
        q.eq('cityId', args.cityId as any).eq('status', 'active'),
      )
      .collect();

    // Only future sessions
    const today = new Date().toISOString().split('T')[0];
    const futureSessions = sessions.filter((s) => s.startDate >= today);

    return futureSessions.map((s) => ({
      campName: s.campName ?? 'Unknown Camp',
      orgName: s.organizationName ?? 'Unknown Org',
      price: s.price,
      startDate: s.startDate,
      endDate: s.endDate,
      dropOffHour: s.dropOffTime.hour,
      pickUpHour: s.pickUpTime.hour,
      ageMin: s.ageRequirements.minAge,
      ageMax: s.ageRequirements.maxAge,
      categories: s.campCategories ?? [],
      locationName: s.locationName ?? 'Unknown Location',
    }));
  },
});

export const getActiveOrgs = internalQuery({
  args: { cityId: v.string() },
  handler: async (ctx, args) => {
    const orgs = await ctx.db
      .query('organizations')
      .withIndex('by_is_active', (q) => q.eq('isActive', true))
      .collect();

    // Filter orgs that have this city in their cityIds
    return orgs
      .filter((o) => o.cityIds.includes(args.cityId as any))
      .map((o) => ({
        name: o.name,
        slug: o.slug,
        website: o.website,
      }));
  },
});

export const getActiveCamps = internalQuery({
  args: { cityId: v.string() },
  handler: async (ctx, args) => {
    // Get org IDs for this city first
    const orgs = await ctx.db
      .query('organizations')
      .withIndex('by_is_active', (q) => q.eq('isActive', true))
      .collect();
    const cityOrgs = orgs.filter((o) => o.cityIds.includes(args.cityId as any));
    const orgIds = new Set(cityOrgs.map((o) => o._id));

    const camps = await ctx.db
      .query('camps')
      .withIndex('by_is_active', (q) => q.eq('isActive', true))
      .collect();

    return camps
      .filter((c) => orgIds.has(c.organizationId))
      .map((c) => ({
        name: c.name,
        slug: c.slug,
        categories: c.categories,
        orgId: c.organizationId,
      }));
  },
});

export const getRecentSessions = internalQuery({
  args: { daysBack: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.daysBack * 24 * 60 * 60 * 1000;

    // Get all sessions and filter by creation time
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .collect();

    // Filter to recently created sessions
    const recent = sessions.filter((s) => s._creationTime > cutoff);

    return recent.map((s) => ({
      campName: s.campName ?? 'Unknown Camp',
      orgName: s.organizationName ?? 'Unknown Org',
      price: s.price,
      startDate: s.startDate,
      endDate: s.endDate,
      ageMin: s.ageRequirements.minAge,
      ageMax: s.ageRequirements.maxAge,
      categories: s.campCategories ?? [],
    }));
  },
});
