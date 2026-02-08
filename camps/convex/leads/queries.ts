import { internalQuery } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Get lead capture stats for admin dashboard.
 */
export const getLeadStats = internalQuery({
  args: {
    citySlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let leads;
    if (args.citySlug) {
      leads = await ctx.db
        .query('leadCaptures')
        .withIndex('by_city_slug', (q) => q.eq('citySlug', args.citySlug!))
        .collect();
    } else {
      leads = await ctx.db.query('leadCaptures').collect();
    }

    const total = leads.length;
    const pending = leads.filter((l) => l.status === 'pending').length;
    const subscribed = leads.filter((l) => l.status === 'subscribed').length;
    const converted = leads.filter((l) => l.status === 'converted').length;

    return { total, pending, subscribed, converted };
  },
});

/**
 * Check if a lead is still eligible for nurture emails.
 * Returns false if lead has converted or been unsubscribed.
 */
export const isLeadStillNurtureable = internalQuery({
  args: {
    leadId: v.id('leadCaptures'),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) return false;
    // Stop nurturing if lead has converted to a signed-up user
    return lead.status !== 'converted';
  },
});

/**
 * Get city brand info by slug (for leads that store citySlug, not cityId).
 */
export const getCityBrandBySlug = internalQuery({
  args: {
    citySlug: v.string(),
  },
  handler: async (ctx, args) => {
    const city = await ctx.db
      .query('cities')
      .withIndex('by_slug', (q) => q.eq('slug', args.citySlug))
      .first();
    if (!city) return null;

    return {
      cityId: city._id,
      cityName: city.name,
      brandName: city.brandName || 'PDX Camps',
      domain: city.domain || 'pdxcamps.com',
      fromEmail: city.fromEmail || 'hello@pdxcamps.com',
    };
  },
});

/**
 * Get sessions for nurture email content.
 * emailIndex 0: popular/featured camps
 * emailIndex 1: recently added camps
 * emailIndex 2: camps with availability (urgency)
 */
export const getSessionsForNurture = internalQuery({
  args: {
    cityId: v.id('cities'),
    emailIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId).eq('status', 'active'))
      .collect();

    let selected;

    if (args.emailIndex === 0) {
      // Popular camps: sort by enrolled count descending
      selected = sessions
        .filter((s) => s.enrolledCount > 0 || s.price > 0)
        .sort((a, b) => b.enrolledCount - a.enrolledCount)
        .slice(0, 3);
      // Fallback to any sessions if none have enrollment data
      if (selected.length === 0) {
        selected = sessions.slice(0, 3);
      }
    } else if (args.emailIndex === 1) {
      // Recently added: sort by creation time descending
      selected = [...sessions]
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 3);
    } else {
      // Camps with spots still available (urgency)
      selected = sessions
        .filter((s) => s.capacity > 0 && s.enrolledCount < s.capacity)
        .sort((a, b) => {
          const aRemaining = a.capacity - a.enrolledCount;
          const bRemaining = b.capacity - b.enrolledCount;
          return aRemaining - bRemaining; // Fewest spots first
        })
        .slice(0, 3);
      if (selected.length === 0) {
        selected = sessions.slice(0, 3);
      }
    }

    const results = [];
    for (const session of selected) {
      const camp = await ctx.db.get(session.campId);
      const org = await ctx.db.get(session.organizationId);
      if (!camp || !org) continue;

      results.push({
        campName: session.campName || camp.name,
        organizationName: session.organizationName || org.name,
        startDate: session.startDate,
        endDate: session.endDate,
        price: session.price,
      });
    }

    return results;
  },
});

/**
 * Get total active session count for a city.
 */
export const getActiveCitySessionCount = internalQuery({
  args: {
    cityId: v.id('cities'),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId).eq('status', 'active'))
      .collect();
    return sessions.length;
  },
});
