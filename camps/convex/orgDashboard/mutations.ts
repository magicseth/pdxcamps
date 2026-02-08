import { mutation, internalMutation } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';

/**
 * Claim an organization - starts email verification flow.
 * No auth required (orgs may not be platform users).
 */
export const claimOrganization = mutation({
  args: {
    organizationId: v.id('organizations'),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error('Organization not found');

    // Check if already claimed and verified
    const existingVerified = await ctx.db
      .query('orgClaims')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .collect();
    if (existingVerified.some((c) => c.status === 'verified')) {
      throw new Error('This organization has already been claimed');
    }

    // Check for existing pending claim by same email
    const existingPending = existingVerified.find(
      (c) => c.email === args.email.toLowerCase() && c.status === 'pending',
    );
    if (existingPending) {
      return { claimId: existingPending._id, alreadyPending: true };
    }

    // Generate claim token
    const token = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');

    const claimId = await ctx.db.insert('orgClaims', {
      organizationId: args.organizationId,
      email: args.email.toLowerCase(),
      claimToken: token,
      status: 'pending',
      createdAt: Date.now(),
    });

    // Schedule verification email
    await ctx.scheduler.runAfter(0, internal.orgDashboard.actions.sendClaimVerificationEmail, {
      claimId,
      email: args.email.toLowerCase(),
      orgName: org.name,
      token,
    });

    return { claimId, alreadyPending: false };
  },
});

/**
 * Verify an org claim using the token from the email link.
 */
export const verifyOrgClaim = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db
      .query('orgClaims')
      .withIndex('by_token', (q) => q.eq('claimToken', args.token))
      .first();

    if (!claim) throw new Error('Invalid verification token');
    if (claim.status === 'verified') return { success: true, alreadyVerified: true, organizationId: claim.organizationId };

    await ctx.db.patch(claim._id, {
      status: 'verified',
      verifiedAt: Date.now(),
    });

    // Update the organization
    await ctx.db.patch(claim.organizationId, {
      isVerified: true,
    });

    return { success: true, organizationId: claim.organizationId };
  },
});

/**
 * Update org profile (requires verified claim).
 */
export const updateOrgProfile = mutation({
  args: {
    organizationId: v.id('organizations'),
    email: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the caller has a verified claim
    const claims = await ctx.db
      .query('orgClaims')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .collect();
    const verified = claims.find(
      (c) => c.email === args.email.toLowerCase() && c.status === 'verified',
    );
    if (!verified) throw new Error('You must verify your claim before editing');

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.website !== undefined) patch.website = args.website;
    if (args.phone !== undefined) patch.phone = args.phone;

    await ctx.db.patch(args.organizationId, patch);
    return { success: true };
  },
});
