/**
 * Org Outreach Mutations
 *
 * Mutations for managing org outreach records.
 */

import { mutation, internalMutation } from '../_generated/server';
import { v } from 'convex/values';
import { checkIsAdmin } from '../lib/adminAuth';

/**
 * Queue outreach for an organization.
 * Creates a pending outreach record.
 */
export const queueOrgOutreach = mutation({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const isAdmin = await checkIsAdmin(ctx);
    if (!isAdmin) throw new Error('Not authorized');

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error('Organization not found');
    if (!org.email) throw new Error('Organization has no email address');

    // Check if there's already an active outreach for this org
    const existing = await ctx.db
      .query('orgOutreach')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    const activeOutreach = existing.find(
      (r) => r.status === 'pending' || r.status === 'sent',
    );
    if (activeOutreach) {
      throw new Error('There is already active outreach for this organization');
    }

    // Get primary city
    const cityId = org.cityIds[0];
    if (!cityId) throw new Error('Organization has no city');

    return await ctx.db.insert('orgOutreach', {
      organizationId: args.organizationId,
      cityId,
      emailAddress: org.email,
      status: 'pending',
      sequenceStep: 1,
      followUpCount: 0,
      createdAt: Date.now(),
    });
  },
});

/**
 * Batch queue outreach for multiple organizations.
 */
export const batchQueueOutreach = mutation({
  args: {
    organizationIds: v.array(v.id('organizations')),
  },
  handler: async (ctx, args) => {
    const isAdmin = await checkIsAdmin(ctx);
    if (!isAdmin) throw new Error('Not authorized');

    let queued = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const orgId of args.organizationIds) {
      try {
        const org = await ctx.db.get(orgId);
        if (!org) {
          errors.push(`Org ${orgId}: not found`);
          continue;
        }
        if (!org.email) {
          skipped++;
          continue;
        }

        // Check for existing active outreach
        const existing = await ctx.db
          .query('orgOutreach')
          .withIndex('by_organization', (q) => q.eq('organizationId', orgId))
          .collect();
        const activeOutreach = existing.find(
          (r) => r.status === 'pending' || r.status === 'sent',
        );
        if (activeOutreach) {
          skipped++;
          continue;
        }

        const cityId = org.cityIds[0];
        if (!cityId) {
          skipped++;
          continue;
        }

        await ctx.db.insert('orgOutreach', {
          organizationId: orgId,
          cityId,
          emailAddress: org.email,
          status: 'pending',
          sequenceStep: 1,
          followUpCount: 0,
          createdAt: Date.now(),
        });
        queued++;
      } catch (err) {
        errors.push(`Org ${orgId}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    return { queued, skipped, errors };
  },
});

/**
 * Update outreach status after sending.
 */
export const updateOutreachStatus = internalMutation({
  args: {
    outreachId: v.id('orgOutreach'),
    status: v.union(
      v.literal('sent'),
      v.literal('opened'),
      v.literal('replied'),
      v.literal('bounced'),
    ),
    emailId: v.optional(v.string()),
    nextFollowUpAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const update: Record<string, unknown> = {
      status: args.status,
    };

    if (args.status === 'sent') {
      update.sentAt = Date.now();
    }
    if (args.emailId) {
      update.emailId = args.emailId;
    }
    if (args.nextFollowUpAt) {
      update.nextFollowUpAt = args.nextFollowUpAt;
    }

    await ctx.db.patch(args.outreachId, update);
  },
});

/**
 * Queue a follow-up email for an org.
 * Creates a new outreach record at the next sequence step.
 */
export const queueFollowUp = mutation({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const isAdmin = await checkIsAdmin(ctx);
    if (!isAdmin) throw new Error('Not authorized');

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error('Organization not found');
    if (!org.email) throw new Error('Organization has no email address');

    // Get previous outreach records
    const existing = await ctx.db
      .query('orgOutreach')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    const maxStep = Math.max(...existing.map((r) => r.sequenceStep), 0);
    if (maxStep >= 3) {
      throw new Error('Maximum follow-up sequence reached (3 emails)');
    }

    // Check no pending outreach
    const pendingOutreach = existing.find((r) => r.status === 'pending');
    if (pendingOutreach) {
      throw new Error('There is already a pending outreach for this organization');
    }

    const cityId = org.cityIds[0];
    if (!cityId) throw new Error('Organization has no city');

    return await ctx.db.insert('orgOutreach', {
      organizationId: args.organizationId,
      cityId,
      emailAddress: org.email,
      status: 'pending',
      sequenceStep: maxStep + 1,
      followUpCount: maxStep,
      createdAt: Date.now(),
    });
  },
});
