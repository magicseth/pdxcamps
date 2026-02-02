import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Remove fake seeded data from the database
 * Keeps: cities, neighborhoods (these are real data)
 * Removes: fake organizations, camps, locations, sessions that were seeded
 */
export const removeFakeSeededData = mutation({
  args: {},
  handler: async (ctx) => {
    const deleted = {
      sessions: 0,
      camps: 0,
      locations: 0,
      organizations: 0,
    };

    // List of fake organization slugs from seed.ts
    const fakeOrgSlugs = ["portland-parks", "portland-parks-recreation", "portland-art-museum"];
    // Note: We keep "omsi" if it has real scraped data

    // Find and delete fake organizations and their related data
    const organizations = await ctx.db.query("organizations").collect();

    for (const org of organizations) {
      // Skip organizations with real scrape sources
      const hasScrapeSource = await ctx.db
        .query("scrapeSources")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .first();

      // If it's a fake org without scrape sources, delete it and its data
      if (fakeOrgSlugs.includes(org.slug) && !hasScrapeSource) {
        // Delete sessions
        const sessions = await ctx.db
          .query("sessions")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", org._id)
          )
          .collect();
        for (const session of sessions) {
          await ctx.db.delete(session._id);
          deleted.sessions++;
        }

        // Delete camps
        const camps = await ctx.db
          .query("camps")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect();
        for (const camp of camps) {
          await ctx.db.delete(camp._id);
          deleted.camps++;
        }

        // Delete locations
        const locations = await ctx.db
          .query("locations")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect();
        for (const location of locations) {
          await ctx.db.delete(location._id);
          deleted.locations++;
        }

        // Delete organization
        await ctx.db.delete(org._id);
        deleted.organizations++;
      }
    }

    // Also check for sessions/camps/locations without a valid organization
    const allSessions = await ctx.db.query("sessions").collect();
    for (const session of allSessions) {
      const org = await ctx.db.get(session.organizationId);
      if (!org) {
        await ctx.db.delete(session._id);
        deleted.sessions++;
      }
    }

    const allCamps = await ctx.db.query("camps").collect();
    for (const camp of allCamps) {
      const org = await ctx.db.get(camp.organizationId);
      if (!org) {
        await ctx.db.delete(camp._id);
        deleted.camps++;
      }
    }

    const allLocations = await ctx.db.query("locations").collect();
    for (const location of allLocations) {
      if (location.organizationId) {
        const org = await ctx.db.get(location.organizationId);
        if (!org) {
          await ctx.db.delete(location._id);
          deleted.locations++;
        }
      }
    }

    return {
      message: "Fake seeded data removed",
      deleted,
    };
  },
});

/**
 * List all organizations to see what exists
 */
export const listOrganizations = mutation({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    return orgs.map((org) => ({
      id: org._id,
      name: org.name,
      slug: org.slug,
      isActive: org.isActive,
    }));
  },
});

/**
 * List remaining camps
 */
export const listCamps = mutation({
  args: {},
  handler: async (ctx) => {
    const camps = await ctx.db.query("camps").collect();
    return camps.map((c) => ({
      id: c._id,
      name: c.name,
      slug: c.slug,
      organizationId: c.organizationId,
    }));
  },
});

/**
 * Delete all camps, sessions, locations (full reset except cities/neighborhoods/scrapeSources)
 */
export const resetCampData = mutation({
  args: {},
  handler: async (ctx) => {
    const deleted = { sessions: 0, camps: 0, locations: 0, organizations: 0 };

    // Delete all sessions
    const sessions = await ctx.db.query("sessions").collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
      deleted.sessions++;
    }

    // Delete all camps
    const camps = await ctx.db.query("camps").collect();
    for (const c of camps) {
      await ctx.db.delete(c._id);
      deleted.camps++;
    }

    // Delete all locations
    const locations = await ctx.db.query("locations").collect();
    for (const l of locations) {
      await ctx.db.delete(l._id);
      deleted.locations++;
    }

    // Delete all organizations
    const orgs = await ctx.db.query("organizations").collect();
    for (const o of orgs) {
      await ctx.db.delete(o._id);
      deleted.organizations++;
    }

    return { message: "All camp data reset", deleted };
  },
});

/**
 * Fix organization logo URL
 */
export const fixOrganizationLogo = mutation({
  args: {
    organizationId: v.id("organizations"),
    logoUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }
    await ctx.db.patch(args.organizationId, {
      logoUrl: args.logoUrl,
    });
    return { success: true, name: org.name };
  },
});

/**
 * Count all records in main tables
 */
export const countRecords = mutation({
  args: {},
  handler: async (ctx) => {
    const [cities, neighborhoods, organizations, camps, locations, sessions] =
      await Promise.all([
        ctx.db.query("cities").collect(),
        ctx.db.query("neighborhoods").collect(),
        ctx.db.query("organizations").collect(),
        ctx.db.query("camps").collect(),
        ctx.db.query("locations").collect(),
        ctx.db.query("sessions").collect(),
      ]);

    return {
      cities: cities.length,
      neighborhoods: neighborhoods.length,
      organizations: organizations.length,
      camps: camps.length,
      locations: locations.length,
      sessions: sessions.length,
    };
  },
});
