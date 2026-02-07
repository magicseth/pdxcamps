/**
 * Notification Mutations
 *
 * Mutations for recording sent notifications and updating availability snapshots.
 */

import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Record that a notification was sent.
 * Used to prevent duplicate notifications.
 */
export const markNotificationSent = internalMutation({
  args: {
    familyId: v.id('families'),
    sessionId: v.id('sessions'),
    changeType: v.union(v.literal('registration_opened'), v.literal('low_availability')),
    emailId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert('notificationsSent', {
      familyId: args.familyId,
      sessionId: args.sessionId,
      changeType: args.changeType,
      notifiedAt: Date.now(),
      emailId: args.emailId,
    });

    return notificationId;
  },
});

/**
 * Record current availability for a session.
 * Used to detect when availability newly drops below threshold.
 */
export const updateAvailabilitySnapshot = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    enrolledCount: v.number(),
    capacity: v.number(),
  },
  handler: async (ctx, args) => {
    const spotsRemaining = args.capacity - args.enrolledCount;

    const snapshotId = await ctx.db.insert('sessionAvailabilitySnapshots', {
      sessionId: args.sessionId,
      enrolledCount: args.enrolledCount,
      capacity: args.capacity,
      spotsRemaining,
      recordedAt: Date.now(),
    });

    return snapshotId;
  },
});

/**
 * Mark a scrape change as notified.
 * Called after successfully sending registration opened notifications.
 */
export const markScrapeChangeNotified = internalMutation({
  args: {
    changeId: v.id('scrapeChanges'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.changeId, {
      notified: true,
    });

    return args.changeId;
  },
});
