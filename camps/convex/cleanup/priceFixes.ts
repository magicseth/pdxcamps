import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';

/**
 * Helper to check if a string is a valid URL
 */
function isValidUrl(str: string | undefined | null): boolean {
  if (!str) return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Find camps and sessions with bad URLs and fix them
 */
export const fixBadUrls = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const camps = await ctx.db.query('camps').collect();
    const sessions = await ctx.db.query('sessions').collect();
    const sources = await ctx.db.query('scrapeSources').collect();

    // Build source lookup
    const sourceById = new Map<string, { url: string; name: string }>();
    for (const source of sources) {
      sourceById.set(source._id, { url: source.url, name: source.name });
    }

    let campsFixed = 0;
    let sessionsFixed = 0;
    const badCamps: Array<{ name: string; badUrl: string; source?: string }> = [];
    const badSessions: Array<{ campName: string; badUrl: string; source?: string }> = [];

    // Fix camps with bad websites
    for (const camp of camps) {
      if (camp.website && !isValidUrl(camp.website)) {
        badCamps.push({
          name: camp.name,
          badUrl: camp.website,
        });

        if (!dryRun) {
          // Clear the bad URL - it will need to be re-scraped
          await ctx.db.patch(camp._id, {
            website: undefined,
          });
        }
        campsFixed++;
      }

      // Also check imageUrls for bad values
      if (camp.imageUrls && camp.imageUrls.some((url: string) => !isValidUrl(url) && !url.startsWith('kg7'))) {
        const badUrls = camp.imageUrls.filter((url: string) => !isValidUrl(url) && !url.startsWith('kg7'));
        if (!dryRun && badUrls.length > 0) {
          const validUrls = camp.imageUrls.filter((url: string) => isValidUrl(url) || url.startsWith('kg7'));
          await ctx.db.patch(camp._id, {
            imageUrls: validUrls,
          });
        }
      }
    }

    // Fix sessions with bad registration URLs
    for (const session of sessions) {
      if (session.externalRegistrationUrl && !isValidUrl(session.externalRegistrationUrl)) {
        const camp = camps.find((c) => c._id === session.campId);
        const source = session.sourceId ? sourceById.get(session.sourceId as string) : undefined;

        badSessions.push({
          campName: camp?.name || 'Unknown',
          badUrl: session.externalRegistrationUrl,
          source: source?.name,
        });

        if (!dryRun) {
          // Use the source URL as a fallback
          const fallbackUrl = source?.url;
          await ctx.db.patch(session._id, {
            externalRegistrationUrl: fallbackUrl,
          });
        }
        sessionsFixed++;
      }
    }

    return {
      dryRun,
      campsFixed,
      sessionsFixed,
      badCamps: badCamps.slice(0, 30),
      badSessions: badSessions.slice(0, 30),
    };
  },
});

/**
 * Fix OMSI registration URLs
 * Change from ?product= to /path/ format
 */
export const fixOmsiUrls = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    // OMSI Science Camps organization ID
    const OMSI_ORG_ID = 'kh75v4zw4w3v6hc2m8y9jjze5h80dc22' as Id<'organizations'>;

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_organization_and_status', (q) => q.eq('organizationId', OMSI_ORG_ID))
      .collect();

    const updates: Array<{
      sessionId: string;
      oldUrl: string;
      newUrl: string;
    }> = [];

    for (const session of sessions) {
      const url = session.externalRegistrationUrl;
      if (!url) continue;

      // Check if URL uses the old ?product= format
      if (url.includes('?product=')) {
        const productName = url.split('?product=')[1];
        const newUrl = `https://secure.omsi.edu/camps-and-classes/${productName}`;

        updates.push({
          sessionId: session._id,
          oldUrl: url,
          newUrl,
        });

        if (!dryRun) {
          await ctx.db.patch(session._id, { externalRegistrationUrl: newUrl });
        }
      }
    }

    return {
      dryRun,
      totalSessions: sessions.length,
      urlsFixed: dryRun ? 0 : updates.length,
      urlsToFix: updates.length,
      sampleUpdates: updates.slice(0, 5),
    };
  },
});

/**
 * Fix session prices for an organization based on a default price
 * Useful for orgs with standardized pricing
 */
export const fixOrgPrices = mutation({
  args: {
    organizationId: v.id('organizations'),
    defaultPriceInCents: v.number(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_organization_and_status', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    const zeroPriceSessions = sessions.filter((s) => !s.price || s.price === 0);

    const updates: Array<{
      sessionId: string;
      oldPrice: number;
      newPrice: number;
    }> = [];

    for (const session of zeroPriceSessions) {
      updates.push({
        sessionId: session._id,
        oldPrice: session.price || 0,
        newPrice: args.defaultPriceInCents,
      });

      if (!dryRun) {
        await ctx.db.patch(session._id, { price: args.defaultPriceInCents });
      }
    }

    return {
      dryRun,
      totalSessions: sessions.length,
      zeroPriceSessions: zeroPriceSessions.length,
      updatesApplied: dryRun ? 0 : updates.length,
    };
  },
});

/**
 * Fix basketball/sports camp prices
 * Nike Basketball Camps typically charge:
 * - Day camps: $559/week
 * - Overnight camps: $995/week
 */
export const fixBasketballCampPrices = mutation({
  args: {
    organizationId: v.id('organizations'),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    // Get all sessions with $0 price for this org
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_organization_and_status', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    const zeroPriceSessions = sessions.filter((s) => !s.price || s.price === 0);

    // Get camps for these sessions
    const campIds = [...new Set(zeroPriceSessions.map((s) => s.campId))];
    const camps = await Promise.all(campIds.map((id) => ctx.db.get(id)));
    const campMap = new Map(camps.filter(Boolean).map((c) => [c!._id, c!]));

    // Pricing based on Nike Basketball Camps
    const BASKETBALL_PRICING = {
      daycamp: 55900, // $559/week
      overnight: 99500, // $995/week
    };

    function determinePricing(campName: string): number {
      const nameLower = campName.toLowerCase();

      // Check for overnight camps
      if (nameLower.includes('overnight') || nameLower.includes('residential')) {
        return BASKETBALL_PRICING.overnight;
      }

      // Default: day camp
      return BASKETBALL_PRICING.daycamp;
    }

    const updates: Array<{
      sessionId: string;
      campName: string;
      oldPrice: number;
      newPrice: number;
    }> = [];

    for (const session of zeroPriceSessions) {
      const camp = campMap.get(session.campId);
      if (!camp) continue;

      const newPrice = determinePricing(camp.name);

      updates.push({
        sessionId: session._id,
        campName: camp.name,
        oldPrice: session.price || 0,
        newPrice,
      });

      if (!dryRun) {
        await ctx.db.patch(session._id, { price: newPrice });
      }
    }

    return {
      dryRun,
      totalSessions: sessions.length,
      zeroPriceSessions: zeroPriceSessions.length,
      updatesApplied: dryRun ? 0 : updates.length,
      sampleUpdates: updates.slice(0, 20),
    };
  },
});

/**
 * Fix Trackers Earth session prices
 * Trackers has standardized pricing based on camp type:
 * - Base camp: $475
 * - Transport: $525
 * - Overnight standard: $995
 * - Overnight expedition: $1495
 * - LIT (Leader in Training): $895
 * - Pre-K: $395
 */
export const fixTrackersPrices = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    // Trackers Earth Portland organization ID
    const TRACKERS_ORG_ID = 'kh7f4thw13306rys338we33kqd80dkrm' as Id<'organizations'>;

    // Get all Trackers sessions with $0 price
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_organization_and_status', (q) => q.eq('organizationId', TRACKERS_ORG_ID))
      .collect();

    const zeroPriceSessions = sessions.filter((s) => !s.price || s.price === 0);

    // Get camps for these sessions to help determine pricing
    const campIds = [...new Set(zeroPriceSessions.map((s) => s.campId))];
    const camps = await Promise.all(campIds.map((id) => ctx.db.get(id)));
    const campMap = new Map(camps.filter(Boolean).map((c) => [c!._id, c!]));

    // Get locations
    const locationIds = [...new Set(zeroPriceSessions.map((s) => s.locationId).filter(Boolean))];
    const locations = await Promise.all(locationIds.map((id) => ctx.db.get(id as Id<'locations'>)));
    const locationMap = new Map(locations.filter(Boolean).map((l) => [l!._id, l!]));

    // Pricing logic matching the Trackers scraper
    const TRACKERS_PRICING = {
      basecamp: 47500,
      transport: 52500,
      overnightStandard: 99500,
      overnightExpedition: 149500,
      lit: 89500,
      preK: 39500,
    };

    function determinePricing(
      campName: string,
      locationName: string,
      ageReqs?: { minGrade?: number; maxGrade?: number },
    ): number {
      const nameLower = campName.toLowerCase();
      const locationLower = locationName.toLowerCase();

      // Check for overnight camps
      if (locationLower.includes('overnight') || nameLower.includes('overnight')) {
        if (nameLower.includes('expedition') || nameLower.includes('extended')) {
          return TRACKERS_PRICING.overnightExpedition;
        }
        return TRACKERS_PRICING.overnightStandard;
      }

      // Check for Leader in Training
      if (nameLower.includes('leader') || nameLower.includes('lit') || nameLower.includes('leadership')) {
        return TRACKERS_PRICING.lit;
      }

      // Check for Pre-K camps
      if (ageReqs && ageReqs.maxGrade !== undefined && ageReqs.maxGrade <= 0) {
        return TRACKERS_PRICING.preK;
      }

      // Check for transport camps
      if (locationLower.includes('sandy') || locationLower.includes('transport') || nameLower.includes('transport')) {
        return TRACKERS_PRICING.transport;
      }

      // Default: standard base camp
      return TRACKERS_PRICING.basecamp;
    }

    const updates: Array<{
      sessionId: string;
      campName: string;
      location: string;
      oldPrice: number;
      newPrice: number;
    }> = [];

    for (const session of zeroPriceSessions) {
      const camp = campMap.get(session.campId);
      const location = session.locationId ? locationMap.get(session.locationId) : null;

      if (!camp) continue;

      const locationName = location?.name || '';
      const newPrice = determinePricing(camp.name, locationName, session.ageRequirements);

      updates.push({
        sessionId: session._id,
        campName: camp.name,
        location: locationName,
        oldPrice: session.price || 0,
        newPrice,
      });

      if (!dryRun) {
        await ctx.db.patch(session._id, { price: newPrice });
      }
    }

    return {
      dryRun,
      totalSessions: sessions.length,
      zeroPriceSessions: zeroPriceSessions.length,
      updatesApplied: dryRun ? 0 : updates.length,
      sampleUpdates: updates.slice(0, 20),
    };
  },
});
