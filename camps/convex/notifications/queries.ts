/**
 * Notification Queries
 *
 * Queries for finding sessions that need notifications and
 * families that are interested in those sessions.
 */

import { internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';

/**
 * Get families with "interested" registrations for a specific session.
 * Returns family info needed for sending notifications.
 */
export const getFamiliesWithInterestedRegistrations = internalQuery({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    // Get all interested registrations for this session
    const registrations = await ctx.db
      .query('registrations')
      .withIndex('by_session_and_status', (q) => q.eq('sessionId', args.sessionId).eq('status', 'interested'))
      .collect();

    if (registrations.length === 0) {
      return [];
    }

    // Get unique family IDs
    const familyIds = [...new Set(registrations.map((r) => r.familyId))];

    // Get family and child details
    const results: {
      familyId: Id<'families'>;
      email: string;
      displayName: string;
      childId: Id<'children'>;
      childName: string;
    }[] = [];

    for (const reg of registrations) {
      const family = await ctx.db.get(reg.familyId);
      const child = await ctx.db.get(reg.childId);

      if (family && child) {
        // Respect availabilityAlerts preference (default to true for families without the setting)
        if (family.emailPreferences?.availabilityAlerts === false) continue;

        results.push({
          familyId: reg.familyId,
          email: family.email,
          displayName: family.displayName,
          childId: reg.childId,
          childName: child.firstName,
        });
      }
    }

    return results;
  },
});

/**
 * Get sessions where registration just opened (status changed to active).
 * Checks scrapeChanges for recent status_changed events with newValue="active".
 */
export const getRecentRegistrationOpens = internalQuery({
  args: {
    sinceTime: v.number(), // Only look at changes after this timestamp
  },
  handler: async (ctx, args) => {
    // Get status changes where newValue is "active"
    const changes = await ctx.db
      .query('scrapeChanges')
      .withIndex('by_notified_and_change_type', (q) => q.eq('notified', false).eq('changeType', 'status_changed'))
      .filter((q) => q.and(q.eq(q.field('newValue'), 'active'), q.gte(q.field('detectedAt'), args.sinceTime)))
      .collect();

    // Filter to changes where previousValue was sold_out or draft
    const relevantChanges = changes.filter((c) => {
      const prev = c.previousValue;
      return prev === 'sold_out' || prev === 'draft';
    });

    // Get session details for each change
    const results: {
      changeId: Id<'scrapeChanges'>;
      sessionId: Id<'sessions'>;
      session: {
        campName: string;
        organizationName: string;
        startDate: string;
        endDate: string;
        dropOffTime: { hour: number; minute: number };
        pickUpTime: { hour: number; minute: number };
        locationName: string;
        locationAddress: string;
        price: number;
        externalRegistrationUrl: string | null;
        spotsRemaining: number;
      };
    }[] = [];

    for (const change of relevantChanges) {
      if (!change.sessionId) continue;

      const session = await ctx.db.get(change.sessionId);
      if (!session) continue;

      // Get camp and organization names
      const camp = await ctx.db.get(session.campId);
      const org = await ctx.db.get(session.organizationId);
      const location = await ctx.db.get(session.locationId);

      if (!camp || !org) continue;

      const spotsRemaining = session.capacity - session.enrolledCount;
      const locationAddress = session.locationAddress
        ? `${session.locationAddress.street}, ${session.locationAddress.city}, ${session.locationAddress.state} ${session.locationAddress.zip}`
        : location?.address
          ? `${location.address.street}, ${location.address.city}, ${location.address.state} ${location.address.zip}`
          : '';

      results.push({
        changeId: change._id,
        sessionId: change.sessionId,
        session: {
          campName: session.campName || camp.name,
          organizationName: session.organizationName || org.name,
          startDate: session.startDate,
          endDate: session.endDate,
          dropOffTime: session.dropOffTime,
          pickUpTime: session.pickUpTime,
          locationName: session.locationName || location?.name || 'TBD',
          locationAddress,
          price: session.price,
          externalRegistrationUrl: session.externalRegistrationUrl || null,
          spotsRemaining,
        },
      });
    }

    return results;
  },
});

/**
 * Get sessions with low availability (spots remaining < 5 and > 0).
 * Compares against previous snapshots to only notify when it newly drops below threshold.
 */
export const getSessionsWithLowAvailability = internalQuery({
  args: {
    threshold: v.number(), // Default will be 5
  },
  handler: async (ctx, args) => {
    // Get active sessions with low availability
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .collect();

    const results: {
      sessionId: Id<'sessions'>;
      spotsRemaining: number;
      isNewlyLow: boolean;
      session: {
        campName: string;
        organizationName: string;
        startDate: string;
        endDate: string;
        dropOffTime: { hour: number; minute: number };
        pickUpTime: { hour: number; minute: number };
        locationName: string;
        locationAddress: string;
        price: number;
        externalRegistrationUrl: string | null;
      };
    }[] = [];

    for (const session of sessions) {
      const spotsRemaining = session.capacity - session.enrolledCount;

      // Only interested in low availability (but not sold out)
      if (spotsRemaining >= args.threshold || spotsRemaining <= 0) {
        continue;
      }

      // Check if this is newly low by looking at the last snapshot
      const lastSnapshot = await ctx.db
        .query('sessionAvailabilitySnapshots')
        .withIndex('by_session', (q) => q.eq('sessionId', session._id))
        .order('desc')
        .first();

      // It's "newly low" if there's no previous snapshot OR the previous snapshot had >= threshold
      const isNewlyLow = !lastSnapshot || lastSnapshot.spotsRemaining >= args.threshold;

      if (!isNewlyLow) {
        // Already notified about this session being low
        continue;
      }

      // Get related data
      const camp = await ctx.db.get(session.campId);
      const org = await ctx.db.get(session.organizationId);
      const location = await ctx.db.get(session.locationId);

      if (!camp || !org) continue;

      const locationAddress = session.locationAddress
        ? `${session.locationAddress.street}, ${session.locationAddress.city}, ${session.locationAddress.state} ${session.locationAddress.zip}`
        : location?.address
          ? `${location.address.street}, ${location.address.city}, ${location.address.state} ${location.address.zip}`
          : '';

      results.push({
        sessionId: session._id,
        spotsRemaining,
        isNewlyLow,
        session: {
          campName: session.campName || camp.name,
          organizationName: session.organizationName || org.name,
          startDate: session.startDate,
          endDate: session.endDate,
          dropOffTime: session.dropOffTime,
          pickUpTime: session.pickUpTime,
          locationName: session.locationName || location?.name || 'TBD',
          locationAddress,
          price: session.price,
          externalRegistrationUrl: session.externalRegistrationUrl || null,
        },
      });
    }

    return results;
  },
});

/**
 * Check if a notification has already been sent.
 */
export const hasNotificationBeenSent = internalQuery({
  args: {
    familyId: v.id('families'),
    sessionId: v.id('sessions'),
    changeType: v.union(v.literal('registration_opened'), v.literal('low_availability')),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('notificationsSent')
      .withIndex('by_family_session_type', (q) =>
        q.eq('familyId', args.familyId).eq('sessionId', args.sessionId).eq('changeType', args.changeType),
      )
      .first();

    return existing !== null;
  },
});

/**
 * Get city brand info for a family (for email branding).
 */
export const getFamilyCityBrand = internalQuery({
  args: {
    familyId: v.id('families'),
  },
  handler: async (ctx, args) => {
    const family = await ctx.db.get(args.familyId);
    if (!family) return null;

    const city = await ctx.db.get(family.primaryCityId);
    if (!city) return null;

    return {
      brandName: city.brandName || 'PDX Camps',
      domain: city.domain || 'pdxcamps.com',
      fromEmail: city.fromEmail || 'hello@pdxcamps.com',
    };
  },
});
