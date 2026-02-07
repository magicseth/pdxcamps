import { action, internalMutation, internalQuery } from '../_generated/server';
import { internal } from '../_generated/api';
import { normalizeName } from '../scraping/deduplication';
import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';

/**
 * Find one duplicate group to merge.
 * Returns the keeper camp ID and list of duplicate camp IDs, or null if no duplicates remain.
 */
export const findOneDuplicateGroup = internalQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    keeperId: Id<'camps'>;
    duplicateIds: Id<'camps'>[];
    normalizedName: string;
  } | null> => {
    const camps = await ctx.db
      .query('camps')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    // Group by normalized name
    const groups = new Map<string, Id<'camps'>[]>();
    for (const camp of camps) {
      const key = normalizeName(camp.name);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(camp._id);
    }

    // Find first group with duplicates
    for (const [key, campIds] of groups) {
      if (campIds.length < 2) continue;
      // Keep the first one (oldest by creation time since query returns in order), rest are duplicates
      return {
        keeperId: campIds[0],
        duplicateIds: campIds.slice(1),
        normalizedName: key,
      };
    }

    return null;
  },
});

/**
 * Merge a single duplicate camp into the keeper.
 * Re-points sessions, copies images, deletes the duplicate.
 */
export const mergeOneDuplicate = internalMutation({
  args: {
    keeperId: v.id('camps'),
    duplicateId: v.id('camps'),
  },
  handler: async (ctx, args): Promise<{ rePointed: number }> => {
    const keeper = await ctx.db.get(args.keeperId);
    const dup = await ctx.db.get(args.duplicateId);
    if (!keeper || !dup) return { rePointed: 0 };

    // Re-point sessions
    const dupSessions = await ctx.db
      .query('sessions')
      .withIndex('by_camp', (q) => q.eq('campId', args.duplicateId))
      .collect();

    for (const session of dupSessions) {
      await ctx.db.patch(session._id, {
        campId: args.keeperId,
        campName: keeper.name,
      });
    }

    // Copy images if keeper is missing them
    if (dup.imageStorageIds.length > 0 && keeper.imageStorageIds.length === 0) {
      await ctx.db.patch(args.keeperId, { imageStorageIds: dup.imageStorageIds });
    }
    if (dup.imageUrls?.length && (!keeper.imageUrls || keeper.imageUrls.length === 0)) {
      await ctx.db.patch(args.keeperId, { imageUrls: dup.imageUrls });
    }

    await ctx.db.delete(args.duplicateId);
    return { rePointed: dupSessions.length };
  },
});

/** Helper query: get unique org IDs that have camps */
export const listOrgsWithCamps = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<'organizations'>[]> => {
    const camps = await ctx.db.query('camps').collect();
    const orgIds = new Set(camps.map((c) => c.organizationId));
    return [...orgIds];
  },
});

/**
 * Run camp dedup across all organizations.
 * Processes one duplicate at a time to stay within Convex limits.
 */
export const mergeDuplicateCamps = action({
  args: {},
  handler: async (ctx): Promise<{ totalDeleted: number; totalRePointed: number; orgsProcessed: number }> => {
    const orgs: Id<'organizations'>[] = await ctx.runQuery(internal.cleanup.campDedup.listOrgsWithCamps);

    let totalDeleted = 0;
    let totalRePointed = 0;

    for (const orgId of orgs) {
      // Keep finding and merging duplicate groups for this org
      while (true) {
        const group = await ctx.runQuery(internal.cleanup.campDedup.findOneDuplicateGroup, { organizationId: orgId });
        if (!group) break;

        // Merge each duplicate one at a time
        for (const dupId of group.duplicateIds) {
          const result = await ctx.runMutation(internal.cleanup.campDedup.mergeOneDuplicate, {
            keeperId: group.keeperId,
            duplicateId: dupId,
          });
          totalRePointed += result.rePointed;
          totalDeleted++;
        }

        console.log(`[CampDedup] Merged "${group.normalizedName}": deleted ${group.duplicateIds.length} duplicates`);
      }
    }

    console.log(
      `[CampDedup] Done: ${totalDeleted} camps deleted, ${totalRePointed} sessions re-pointed across ${orgs.length} orgs`,
    );

    return { totalDeleted, totalRePointed, orgsProcessed: orgs.length };
  },
});
