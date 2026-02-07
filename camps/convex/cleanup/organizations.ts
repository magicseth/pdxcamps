import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { Doc } from '../_generated/dataModel';

/**
 * Find duplicate organizations (same name, different IDs)
 */
export const findDuplicateOrganizations = mutation({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query('organizations').collect();

    // Group by name
    const byName = new Map<string, Doc<'organizations'>[]>();
    for (const org of orgs) {
      const existing = byName.get(org.name) || [];
      existing.push(org);
      byName.set(org.name, existing);
    }

    // Find duplicates
    const duplicates: Array<{
      name: string;
      count: number;
      orgs: Array<{
        id: string;
        website: string | undefined;
        hasLogo: boolean;
        sessionCount: number;
      }>;
    }> = [];

    for (const [name, orgList] of byName) {
      if (orgList.length > 1) {
        // Count sessions for each org
        const orgsWithCounts = await Promise.all(
          orgList.map(async (org) => {
            const sessions = await ctx.db
              .query('sessions')
              .withIndex('by_organization_and_status', (q) => q.eq('organizationId', org._id))
              .collect();
            return {
              id: org._id,
              website: org.website,
              hasLogo: !!org.logoStorageId,
              sessionCount: sessions.length,
            };
          }),
        );

        duplicates.push({
          name,
          count: orgList.length,
          orgs: orgsWithCounts,
        });
      }
    }

    return {
      duplicateCount: duplicates.length,
      duplicates,
    };
  },
});

/**
 * Merge duplicate organizations
 * Keeps the org with the most sessions and merges others into it
 */
export const mergeDuplicateOrganizations = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const orgs = await ctx.db.query('organizations').collect();

    // Group by name
    const byName = new Map<string, Doc<'organizations'>[]>();
    for (const org of orgs) {
      const existing = byName.get(org.name) || [];
      existing.push(org);
      byName.set(org.name, existing);
    }

    const merges: Array<{
      name: string;
      keepId: string;
      deleteIds: string[];
      sessionsReassigned: number;
      campsReassigned: number;
    }> = [];

    for (const [name, orgList] of byName) {
      if (orgList.length > 1) {
        // Count sessions for each org to determine which to keep
        const orgsWithCounts = await Promise.all(
          orgList.map(async (org) => {
            const sessions = await ctx.db
              .query('sessions')
              .withIndex('by_organization_and_status', (q) => q.eq('organizationId', org._id))
              .collect();
            const camps = await ctx.db
              .query('camps')
              .withIndex('by_organization', (q) => q.eq('organizationId', org._id))
              .collect();
            return {
              org,
              sessionCount: sessions.length,
              campCount: camps.length,
              hasLogo: !!org.logoStorageId,
              hasWebsite: !!org.website && org.website !== '<UNKNOWN>',
            };
          }),
        );

        // Sort to determine which to keep (prefer: most sessions, has logo, has website)
        orgsWithCounts.sort((a, b) => {
          if (b.sessionCount !== a.sessionCount) return b.sessionCount - a.sessionCount;
          if (b.hasLogo !== a.hasLogo) return b.hasLogo ? 1 : -1;
          if (b.hasWebsite !== a.hasWebsite) return b.hasWebsite ? 1 : -1;
          return 0;
        });

        const keepOrg = orgsWithCounts[0];
        const deleteOrgs = orgsWithCounts.slice(1);

        let sessionsReassigned = 0;
        let campsReassigned = 0;

        for (const { org: deleteOrg } of deleteOrgs) {
          // Reassign sessions
          const sessions = await ctx.db
            .query('sessions')
            .withIndex('by_organization_and_status', (q) => q.eq('organizationId', deleteOrg._id))
            .collect();

          for (const session of sessions) {
            if (!dryRun) {
              await ctx.db.patch(session._id, { organizationId: keepOrg.org._id });
            }
            sessionsReassigned++;
          }

          // Reassign camps
          const camps = await ctx.db
            .query('camps')
            .withIndex('by_organization', (q) => q.eq('organizationId', deleteOrg._id))
            .collect();

          for (const camp of camps) {
            if (!dryRun) {
              await ctx.db.patch(camp._id, { organizationId: keepOrg.org._id });
            }
            campsReassigned++;
          }

          // Reassign locations
          const locations = await ctx.db
            .query('locations')
            .withIndex('by_organization', (q) => q.eq('organizationId', deleteOrg._id))
            .collect();

          for (const location of locations) {
            if (!dryRun) {
              await ctx.db.patch(location._id, { organizationId: keepOrg.org._id });
            }
          }

          // Update scrape sources
          const sources = await ctx.db
            .query('scrapeSources')
            .withIndex('by_organization', (q) => q.eq('organizationId', deleteOrg._id))
            .collect();

          for (const source of sources) {
            if (!dryRun) {
              await ctx.db.patch(source._id, { organizationId: keepOrg.org._id });
            }
          }

          // Copy logo/website if keep org doesn't have one
          if (!keepOrg.hasLogo && deleteOrg.logoStorageId && !dryRun) {
            await ctx.db.patch(keepOrg.org._id, { logoStorageId: deleteOrg.logoStorageId });
          }
          if (!keepOrg.hasWebsite && deleteOrg.website && deleteOrg.website !== '<UNKNOWN>' && !dryRun) {
            await ctx.db.patch(keepOrg.org._id, { website: deleteOrg.website });
          }

          // Delete the duplicate org
          if (!dryRun) {
            await ctx.db.delete(deleteOrg._id);
          }
        }

        merges.push({
          name,
          keepId: keepOrg.org._id,
          deleteIds: deleteOrgs.map((o) => o.org._id),
          sessionsReassigned,
          campsReassigned,
        });
      }
    }

    return {
      dryRun,
      mergeCount: merges.length,
      merges,
    };
  },
});

/**
 * Reassign all camps, sessions, and locations from one org to another
 * Used to fix incorrect organization assignments
 */
export const reassignOrganization = mutation({
  args: {
    fromOrgId: v.id('organizations'),
    toOrgId: v.id('organizations'),
    sourceId: v.optional(v.id('scrapeSources')), // Only reassign items from this source
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    // Verify both orgs exist
    const fromOrg = await ctx.db.get(args.fromOrgId);
    const toOrg = await ctx.db.get(args.toOrgId);
    if (!fromOrg) throw new Error('Source organization not found');
    if (!toOrg) throw new Error('Target organization not found');

    const result = {
      dryRun,
      fromOrg: fromOrg.name,
      toOrg: toOrg.name,
      sessionsReassigned: 0,
      campsReassigned: 0,
      locationsReassigned: 0,
    };

    // Find sessions to reassign
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_organization_and_status', (q) => q.eq('organizationId', args.fromOrgId))
      .collect();

    for (const session of sessions) {
      // If sourceId filter is set, only reassign sessions from that source
      if (args.sourceId && session.sourceId !== args.sourceId) continue;

      if (!dryRun) {
        await ctx.db.patch(session._id, { organizationId: args.toOrgId });
      }
      result.sessionsReassigned++;
    }

    // Find camps to reassign
    const camps = await ctx.db
      .query('camps')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.fromOrgId))
      .collect();

    for (const camp of camps) {
      // If sourceId filter is set, check if camp's sessions are from that source
      if (args.sourceId) {
        const campSessions = await ctx.db
          .query('sessions')
          .withIndex('by_camp', (q) => q.eq('campId', camp._id))
          .first();
        if (!campSessions || campSessions.sourceId !== args.sourceId) continue;
      }

      if (!dryRun) {
        await ctx.db.patch(camp._id, { organizationId: args.toOrgId });
      }
      result.campsReassigned++;
    }

    // Find locations to reassign
    const locations = await ctx.db
      .query('locations')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.fromOrgId))
      .collect();

    for (const location of locations) {
      if (!dryRun) {
        await ctx.db.patch(location._id, { organizationId: args.toOrgId });
      }
      result.locationsReassigned++;
    }

    return result;
  },
});

/**
 * Clean up orphaned records (camps/sessions without valid org)
 */
export const cleanupOrphans = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const deleted = {
      sessions: 0,
      camps: 0,
      locations: 0,
    };

    // Get all org IDs
    const orgs = await ctx.db.query('organizations').collect();
    const orgIds = new Set(orgs.map((o) => o._id));

    // Find orphaned sessions
    const sessions = await ctx.db.query('sessions').collect();
    for (const session of sessions) {
      if (!orgIds.has(session.organizationId)) {
        if (!dryRun) {
          await ctx.db.delete(session._id);
        }
        deleted.sessions++;
      }
    }

    // Find orphaned camps
    const camps = await ctx.db.query('camps').collect();
    for (const camp of camps) {
      if (!orgIds.has(camp.organizationId)) {
        if (!dryRun) {
          await ctx.db.delete(camp._id);
        }
        deleted.camps++;
      }
    }

    // Find orphaned locations
    const locations = await ctx.db.query('locations').collect();
    for (const location of locations) {
      if (location.organizationId && !orgIds.has(location.organizationId)) {
        if (!dryRun) {
          await ctx.db.delete(location._id);
        }
        deleted.locations++;
      }
    }

    return {
      dryRun,
      deleted,
    };
  },
});
