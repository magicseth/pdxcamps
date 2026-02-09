import { mutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { checkIsAdmin } from '../lib/adminAuth';

/**
 * Approve a partner application — generates a unique partner code.
 */
export const approvePartnerApplication = mutation({
  args: {
    applicationId: v.id('partnerApplications'),
  },
  handler: async (ctx, args) => {
    const isAdmin = await checkIsAdmin(ctx);
    if (!isAdmin) throw new Error('Not authorized');

    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error('Application not found');
    if (app.status !== 'pending') throw new Error('Application is not pending');

    // Generate 16-char hex partner code
    const partnerCode = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    await ctx.db.patch(args.applicationId, {
      status: 'approved',
      partnerCode,
      approvedAt: Date.now(),
      totalEarningsCents: 0,
      totalPaidOutCents: 0,
    });

    // Send approval email with partner link
    await ctx.scheduler.runAfter(0, internal.partners.notifications.sendPartnerApprovalEmail, {
      email: app.email,
      contactName: app.contactName,
      organizationName: app.organizationName,
      partnerCode,
    });

    return { partnerCode };
  },
});

/**
 * Reject a partner application.
 */
export const rejectPartnerApplication = mutation({
  args: {
    applicationId: v.id('partnerApplications'),
  },
  handler: async (ctx, args) => {
    const isAdmin = await checkIsAdmin(ctx);
    if (!isAdmin) throw new Error('Not authorized');

    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error('Application not found');
    if (app.status !== 'pending') throw new Error('Application is not pending');

    await ctx.db.patch(args.applicationId, {
      status: 'rejected',
      rejectedAt: Date.now(),
    });

    // Send rejection email
    await ctx.scheduler.runAfter(0, internal.partners.notifications.sendPartnerRejectionEmail, {
      email: app.email,
      contactName: app.contactName,
      organizationName: app.organizationName,
    });

    return { success: true };
  },
});
