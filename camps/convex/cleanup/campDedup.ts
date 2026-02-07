import { internalMutation } from "../_generated/server";
import { normalizeName } from "../scraping/deduplication";
import { Doc, Id } from "../_generated/dataModel";

/**
 * One-time migration: merge duplicate camp records.
 *
 * Groups camps by organizationId + normalizeName(camp.name),
 * keeps the one with the most sessions, re-points sessions
 * from duplicates to the keeper, copies images, and deletes duplicates.
 */
export const mergeDuplicateCamps = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allCamps = await ctx.db.query("camps").collect();

    // Group by orgId + normalized name
    const groups = new Map<string, Doc<"camps">[]>();
    for (const camp of allCamps) {
      const key = `${camp.organizationId}:${normalizeName(camp.name)}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(camp);
    }

    let mergedGroups = 0;
    let deletedCamps = 0;
    let rePointedSessions = 0;

    for (const [key, camps] of groups) {
      if (camps.length < 2) continue;

      // Count sessions per camp to find the keeper
      const campSessionCounts: { camp: Doc<"camps">; count: number }[] = [];
      for (const camp of camps) {
        const sessions = await ctx.db
          .query("sessions")
          .withIndex("by_camp", (q) => q.eq("campId", camp._id))
          .collect();
        campSessionCounts.push({ camp, count: sessions.length });
      }

      // Sort: most sessions first, then by creation time (oldest first as tiebreaker)
      campSessionCounts.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.camp._creationTime - b.camp._creationTime;
      });

      const keeper = campSessionCounts[0].camp;
      const duplicates = campSessionCounts.slice(1);

      for (const { camp: dup } of duplicates) {
        // Re-point all sessions from duplicate to keeper
        const dupSessions = await ctx.db
          .query("sessions")
          .withIndex("by_camp", (q) => q.eq("campId", dup._id))
          .collect();

        for (const session of dupSessions) {
          await ctx.db.patch(session._id, {
            campId: keeper._id,
            campName: keeper.name,
          });
          rePointedSessions++;
        }

        // Copy imageStorageIds from duplicate if keeper is missing them
        if (
          dup.imageStorageIds.length > 0 &&
          keeper.imageStorageIds.length === 0
        ) {
          await ctx.db.patch(keeper._id, {
            imageStorageIds: dup.imageStorageIds,
          });
        }

        // Copy imageUrls from duplicate if keeper is missing them
        if (
          dup.imageUrls &&
          dup.imageUrls.length > 0 &&
          (!keeper.imageUrls || keeper.imageUrls.length === 0)
        ) {
          await ctx.db.patch(keeper._id, {
            imageUrls: dup.imageUrls,
          });
        }

        // Delete the duplicate camp
        await ctx.db.delete(dup._id);
        deletedCamps++;
      }

      mergedGroups++;
      console.log(
        `[CampDedup] Merged "${key}": kept "${keeper.name}" (${campSessionCounts[0].count} sessions), deleted ${duplicates.length} duplicates`
      );
    }

    console.log(
      `[CampDedup] Done: ${mergedGroups} groups merged, ${deletedCamps} camps deleted, ${rePointedSessions} sessions re-pointed`
    );

    return { mergedGroups, deletedCamps, rePointedSessions };
  },
});
