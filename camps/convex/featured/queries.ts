import { query } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Get active featured camps for a city (for display on discover/landing pages).
 */
export const getActiveFeaturedCamps = query({
  args: {
    cityId: v.id('cities'),
  },
  handler: async (ctx, args) => {
    const activeListings = await ctx.db
      .query('featuredListings')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .collect();

    const results = [];
    for (const listing of activeListings) {
      // Check if expired (lazy expiry)
      if (listing.expiresAt <= Date.now()) continue;

      const org = await ctx.db.get(listing.organizationId);
      if (!org || !org.isActive) continue;
      if (!org.cityIds.includes(args.cityId)) continue;

      if (listing.campId) {
        const camp = await ctx.db.get(listing.campId);
        if (!camp) continue;

        // Get next upcoming session
        const today = new Date().toISOString().split('T')[0];
        const sessions = await ctx.db
          .query('sessions')
          .withIndex('by_camp', (q) => q.eq('campId', listing.campId!))
          .collect();
        const nextSession = sessions
          .filter((s) => s.status === 'active' && s.startDate >= today)
          .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

        // Resolve camp image
        let imageUrl: string | undefined;
        if (camp.imageStorageIds && camp.imageStorageIds.length > 0) {
          imageUrl = (await ctx.storage.getUrl(camp.imageStorageIds[0] as any)) ?? undefined;
        }
        if (!imageUrl && camp.imageUrls && camp.imageUrls.length > 0) {
          imageUrl = camp.imageUrls[0];
        }

        results.push({
          listingId: listing._id,
          tier: listing.tier,
          campId: camp._id,
          campName: camp.name,
          campSlug: camp.slug,
          campDescription: camp.description,
          orgName: org.name,
          orgSlug: org.slug,
          imageUrl,
          nextSessionDate: nextSession?.startDate,
          nextSessionPrice: nextSession?.price,
          categories: camp.categories,
        });
      } else {
        // Org-level feature — show org with camp count
        const camps = await ctx.db
          .query('camps')
          .withIndex('by_organization', (q) => q.eq('organizationId', listing.organizationId))
          .collect();

        let logoUrl: string | undefined;
        if (org.logoStorageId) {
          logoUrl = (await ctx.storage.getUrl(org.logoStorageId)) ?? undefined;
        }

        results.push({
          listingId: listing._id,
          tier: listing.tier,
          orgName: org.name,
          orgSlug: org.slug,
          imageUrl: logoUrl ?? org.logoUrl,
          campCount: camps.length,
        });
      }
    }

    // Sort spotlight first, then featured
    results.sort((a, b) => (a.tier === 'spotlight' ? -1 : 1) - (b.tier === 'spotlight' ? -1 : 1));
    return results;
  },
});

/**
 * Get featured listing history for an org.
 */
export const getFeaturedListingsForOrg = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('featuredListings')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .collect();
  },
});
