import { query } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Get dashboard stats for an organization.
 */
export const getOrgDashboardStats = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) return null;

    // Get all camps for this org
    const camps = await ctx.db
      .query('camps')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    // Get all active sessions
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_organization_and_status', (q) => q.eq('organizationId', args.organizationId).eq('status', 'active'))
      .collect();
    const activeSessions = sessions;

    // Count saves (interested registrations) across all sessions
    let totalSaves = 0;
    let recentSaves = 0;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const session of activeSessions) {
      const regs = await ctx.db
        .query('registrations')
        .withIndex('by_session_and_status', (q) => q.eq('sessionId', session._id).eq('status', 'interested'))
        .collect();
      totalSaves += regs.length;
      recentSaves += regs.filter((r) => r._creationTime > sevenDaysAgo).length;
    }

    // Future sessions only
    const today = new Date().toISOString().split('T')[0];
    const upcomingSessions = activeSessions.filter((s) => s.startDate >= today);

    // Available spots
    const totalCapacity = upcomingSessions.reduce((sum, s) => sum + s.capacity, 0);
    const totalEnrolled = upcomingSessions.reduce((sum, s) => sum + s.enrolledCount, 0);

    return {
      orgName: org.name,
      campCount: camps.length,
      activeCampCount: camps.filter((c) => c.isActive !== false).length,
      totalSessions: activeSessions.length,
      upcomingSessions: upcomingSessions.length,
      totalSaves,
      recentSaves,
      totalCapacity,
      totalEnrolled,
      availableSpots: totalCapacity - totalEnrolled,
      fillRate: totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0,
    };
  },
});

/**
 * Get camps with session details for an organization.
 */
export const getOrgCamps = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const camps = await ctx.db
      .query('camps')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    const today = new Date().toISOString().split('T')[0];

    return Promise.all(
      camps.map(async (camp) => {
        const sessions = await ctx.db
          .query('sessions')
          .withIndex('by_camp', (q) => q.eq('campId', camp._id))
          .collect();

        const activeSessions = sessions.filter((s) => s.status === 'active' && s.startDate >= today);
        const totalSaves = await Promise.all(
          activeSessions.map(async (s) => {
            const regs = await ctx.db
              .query('registrations')
              .withIndex('by_session_and_status', (q) => q.eq('sessionId', s._id).eq('status', 'interested'))
              .collect();
            return regs.length;
          }),
        ).then((counts) => counts.reduce((a, b) => a + b, 0));

        return {
          _id: camp._id,
          name: camp.name,
          slug: camp.slug,
          description: camp.description,
          categories: camp.categories,
          ageRequirements: camp.ageRequirements,
          upcomingSessionCount: activeSessions.length,
          totalSaves,
          priceRange: activeSessions.length > 0
            ? {
                min: Math.min(...activeSessions.map((s) => s.price)),
                max: Math.max(...activeSessions.map((s) => s.price)),
              }
            : null,
        };
      }),
    );
  },
});

/**
 * Get verified orgs claimed by a specific email.
 */
export const getMyClaimedOrgs = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const claims = await ctx.db
      .query('orgClaims')
      .withIndex('by_email', (q) => q.eq('email', args.email.toLowerCase()))
      .collect();

    const verifiedClaims = claims.filter((c) => c.status === 'verified');

    return Promise.all(
      verifiedClaims.map(async (claim) => {
        const org = await ctx.db.get(claim.organizationId);
        return org
          ? {
              _id: org._id,
              name: org.name,
              slug: org.slug,
              website: org.website,
              isActive: org.isActive,
              claimVerifiedAt: claim.verifiedAt,
            }
          : null;
      }),
    ).then((orgs) => orgs.filter(Boolean));
  },
});

/**
 * Check if an email has a verified claim for an org.
 */
export const checkOrgAccess = query({
  args: {
    organizationId: v.id('organizations'),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const claims = await ctx.db
      .query('orgClaims')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    return claims.some(
      (c) => c.email === args.email.toLowerCase() && c.status === 'verified',
    );
  },
});
