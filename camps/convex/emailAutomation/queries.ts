/**
 * Email Automation Queries
 *
 * Queries for finding users who should receive automated emails.
 */

import { internalQuery } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Find families inactive for 7+ days who haven't received a re-engagement email.
 */
export const getInactiveFamilies = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Get all families with completed onboarding
    const families = await ctx.db.query('families').collect();

    const results: {
      familyId: typeof families[0]['_id'];
      email: string;
      displayName: string;
      primaryCityId: typeof families[0]['primaryCityId'];
      lastLoginAt: number | undefined;
    }[] = [];

    for (const family of families) {
      // Skip families without completed onboarding
      if (!family.onboardingCompletedAt) continue;

      // Skip families that opted out of marketing emails
      if (family.emailPreferences?.marketingEmails === false) continue;

      // Determine last activity time
      const lastActive = family.lastLoginAt || family.onboardingCompletedAt;
      if (lastActive > sevenDaysAgo) continue;

      // Check if we already sent a re-engagement email recently (within 30 days)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentSend = await ctx.db
        .query('automatedEmailsSent')
        .withIndex('by_family_and_type', (q) =>
          q.eq('familyId', family._id).eq('emailType', 're_engagement'),
        )
        .order('desc')
        .first();

      if (recentSend && recentSend.sentAt > thirtyDaysAgo) continue;

      results.push({
        familyId: family._id,
        email: family.email,
        displayName: family.displayName,
        primaryCityId: family.primaryCityId,
        lastLoginAt: family.lastLoginAt,
      });
    }

    return results;
  },
});

/**
 * Get new sessions added in the last 7 days for a city.
 * Used to populate re-engagement emails with real data.
 */
export const getRecentSessionsForCity = internalQuery({
  args: {
    cityId: v.id('cities'),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Get active sessions created in the last 7 days
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId).eq('status', 'active'))
      .order('desc')
      .collect();

    // Filter to recently created and take limit
    const recentSessions = sessions
      .filter((s) => s._creationTime > sevenDaysAgo)
      .slice(0, args.limit);

    const results = [];
    for (const session of recentSessions) {
      const camp = await ctx.db.get(session.campId);
      const org = await ctx.db.get(session.organizationId);
      if (!camp || !org) continue;

      results.push({
        campName: session.campName || camp.name,
        organizationName: session.organizationName || org.name,
        startDate: session.startDate,
        endDate: session.endDate,
        price: session.price,
        externalRegistrationUrl: session.externalRegistrationUrl || null,
      });
    }

    return results;
  },
});

/**
 * Get families eligible for weekly digest.
 * Returns families with completed onboarding who haven't opted out.
 */
export const getDigestEligibleFamilies = internalQuery({
  args: {},
  handler: async (ctx) => {
    const families = await ctx.db.query('families').collect();

    const results: {
      familyId: typeof families[0]['_id'];
      email: string;
      displayName: string;
      primaryCityId: typeof families[0]['primaryCityId'];
    }[] = [];

    for (const family of families) {
      if (!family.onboardingCompletedAt) continue;
      // Default to opted-in; only skip if explicitly opted out
      if (family.emailPreferences?.weeklyDigest === false) continue;

      results.push({
        familyId: family._id,
        email: family.email,
        displayName: family.displayName,
        primaryCityId: family.primaryCityId,
      });
    }

    return results;
  },
});

/**
 * Get weekly digest data for a family: saved camps updates, new camps, filling up camps.
 */
export const getWeeklyDigestData = internalQuery({
  args: {
    familyId: v.id('families'),
    cityId: v.id('cities'),
  },
  handler: async (ctx, args) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // New sessions this week
    const allSessions = await ctx.db
      .query('sessions')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId).eq('status', 'active'))
      .collect();

    const newSessionsThisWeek = allSessions.filter((s) => s._creationTime > sevenDaysAgo).length;

    // Sessions filling up (less than 20% capacity remaining)
    const fillingUp = allSessions.filter((s) => {
      if (s.capacity <= 0) return false;
      const remaining = s.capacity - s.enrolledCount;
      return remaining > 0 && remaining / s.capacity < 0.2;
    }).length;

    // Family's saved camps (registrations with interested/registered/waitlisted)
    const registrations = await ctx.db
      .query('registrations')
      .withIndex('by_family', (q) => q.eq('familyId', args.familyId))
      .collect();

    const activeRegs = registrations.filter(
      (r) => r.status === 'interested' || r.status === 'registered' || r.status === 'waitlisted',
    );

    const savedCampUpdates: {
      campName: string;
      status: string;
      spotsRemaining: number | null;
    }[] = [];

    for (const reg of activeRegs) {
      const session = await ctx.db.get(reg.sessionId);
      if (!session) continue;
      const camp = await ctx.db.get(session.campId);

      const spotsRemaining = session.capacity > 0 ? session.capacity - session.enrolledCount : null;

      savedCampUpdates.push({
        campName: session.campName || camp?.name || 'Unknown Camp',
        status: session.status,
        spotsRemaining,
      });
    }

    // Get a few new camps with details for the email
    const newCampDetails: {
      campName: string;
      organizationName: string;
      price: number;
      startDate: string;
    }[] = [];

    const newSessions = allSessions
      .filter((s) => s._creationTime > sevenDaysAgo)
      .slice(0, 3);

    for (const session of newSessions) {
      const camp = await ctx.db.get(session.campId);
      const org = await ctx.db.get(session.organizationId);
      if (!camp || !org) continue;

      newCampDetails.push({
        campName: session.campName || camp.name,
        organizationName: session.organizationName || org.name,
        price: session.price,
        startDate: session.startDate,
      });
    }

    return {
      newSessionsThisWeek,
      fillingUp,
      savedCampUpdates,
      newCampDetails,
      totalActiveSessions: allSessions.length,
    };
  },
});

/**
 * Get summer countdown stats for a city.
 */
export const getSummerCountdownStats = internalQuery({
  args: {
    cityId: v.id('cities'),
  },
  handler: async (ctx, args) => {
    const allSessions = await ctx.db
      .query('sessions')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId).eq('status', 'active'))
      .collect();

    const totalSessions = allSessions.length;
    const sessionsWithRegistration = allSessions.filter(
      (s) => s.externalRegistrationUrl,
    ).length;
    const filledSessions = allSessions.filter(
      (s) => s.capacity > 0 && s.enrolledCount >= s.capacity,
    ).length;

    // Get unique organizations
    const orgIds = new Set(allSessions.map((s) => s.organizationId));

    return {
      totalSessions,
      sessionsWithRegistration,
      filledSessions,
      organizationCount: orgIds.size,
      registrationOpenPct:
        totalSessions > 0 ? Math.round((sessionsWithRegistration / totalSessions) * 100) : 0,
    };
  },
});

/**
 * Get families eligible for summer countdown emails.
 */
export const getCountdownEligibleFamilies = internalQuery({
  args: {},
  handler: async (ctx) => {
    const families = await ctx.db.query('families').collect();
    const now = Date.now();
    const currentDate = new Date(now);
    const month = currentDate.getMonth(); // 0-indexed: Jan=0

    // Only send Feb-May (months 1-4)
    if (month < 1 || month > 4) return [];

    // Calculate weeks until June 1
    const year = currentDate.getFullYear();
    const summerStart = new Date(year, 5, 1); // June 1
    const weeksUntilSummer = Math.ceil(
      (summerStart.getTime() - now) / (7 * 24 * 60 * 60 * 1000),
    );

    const results: {
      familyId: typeof families[0]['_id'];
      email: string;
      displayName: string;
      primaryCityId: typeof families[0]['primaryCityId'];
      weeksUntilSummer: number;
    }[] = [];

    for (const family of families) {
      if (!family.onboardingCompletedAt) continue;
      if (family.emailPreferences?.marketingEmails === false) continue;

      // Check if we already sent a countdown email this week
      const weekKey = `${year}-W${Math.ceil((currentDate.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`;
      const alreadySent = await ctx.db
        .query('automatedEmailsSent')
        .withIndex('by_family_type_dedupe', (q) =>
          q
            .eq('familyId', family._id)
            .eq('emailType', 'summer_countdown')
            .eq('dedupeKey', weekKey),
        )
        .first();

      if (alreadySent) continue;

      results.push({
        familyId: family._id,
        email: family.email,
        displayName: family.displayName,
        primaryCityId: family.primaryCityId,
        weeksUntilSummer,
      });
    }

    return results;
  },
});

/**
 * Get camp request details for fulfilled notification.
 */
export const getCampRequestDetails = internalQuery({
  args: {
    requestId: v.id('campRequests'),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) return null;

    const family = await ctx.db.get(request.familyId);
    if (!family) return null;

    const city = await ctx.db.get(request.cityId);

    // Get organization details if available
    let orgName: string | undefined;
    let orgWebsite: string | undefined;
    if (request.organizationId) {
      const org = await ctx.db.get(request.organizationId);
      orgName = org?.name;
      orgWebsite = org?.website;
    }

    // Check if already sent
    const alreadySent = await ctx.db
      .query('automatedEmailsSent')
      .withIndex('by_family_type_dedupe', (q) =>
        q
          .eq('familyId', family._id)
          .eq('emailType', 'camp_request_fulfilled')
          .eq('dedupeKey', args.requestId),
      )
      .first();

    return {
      familyId: family._id,
      email: family.email,
      displayName: family.displayName,
      campName: request.campName,
      organizationName: orgName || request.organizationName,
      websiteUrl: orgWebsite || request.websiteUrl,
      cityName: city?.name || 'your city',
      brandName: city?.brandName || 'PDX Camps',
      domain: city?.domain || 'pdxcamps.com',
      fromEmail: city?.fromEmail || 'hello@pdxcamps.com',
      alreadySent: !!alreadySent,
    };
  },
});

/**
 * Get city brand info by ID.
 */
export const getCityBrand = internalQuery({
  args: {
    cityId: v.id('cities'),
  },
  handler: async (ctx, args) => {
    const city = await ctx.db.get(args.cityId);
    if (!city) return null;

    return {
      cityName: city.name,
      brandName: city.brandName || 'PDX Camps',
      domain: city.domain || 'pdxcamps.com',
      fromEmail: city.fromEmail || 'hello@pdxcamps.com',
    };
  },
});
