import { mutation, action, internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";

/**
 * Find duplicate organizations (same name, different IDs)
 */
export const findDuplicateOrganizations = mutation({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();

    // Group by name
    const byName = new Map<string, Doc<"organizations">[]>();
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
              .query("sessions")
              .withIndex("by_organization_and_status", (q) =>
                q.eq("organizationId", org._id)
              )
              .collect();
            return {
              id: org._id,
              website: org.website,
              hasLogo: !!org.logoStorageId,
              sessionCount: sessions.length,
            };
          })
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
    const orgs = await ctx.db.query("organizations").collect();

    // Group by name
    const byName = new Map<string, Doc<"organizations">[]>();
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
              .query("sessions")
              .withIndex("by_organization_and_status", (q) =>
                q.eq("organizationId", org._id)
              )
              .collect();
            const camps = await ctx.db
              .query("camps")
              .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
              .collect();
            return {
              org,
              sessionCount: sessions.length,
              campCount: camps.length,
              hasLogo: !!org.logoStorageId,
              hasWebsite: !!org.website && org.website !== "<UNKNOWN>",
            };
          })
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
            .query("sessions")
            .withIndex("by_organization_and_status", (q) =>
              q.eq("organizationId", deleteOrg._id)
            )
            .collect();

          for (const session of sessions) {
            if (!dryRun) {
              await ctx.db.patch(session._id, { organizationId: keepOrg.org._id });
            }
            sessionsReassigned++;
          }

          // Reassign camps
          const camps = await ctx.db
            .query("camps")
            .withIndex("by_organization", (q) => q.eq("organizationId", deleteOrg._id))
            .collect();

          for (const camp of camps) {
            if (!dryRun) {
              await ctx.db.patch(camp._id, { organizationId: keepOrg.org._id });
            }
            campsReassigned++;
          }

          // Reassign locations
          const locations = await ctx.db
            .query("locations")
            .filter((q) => q.eq(q.field("organizationId"), deleteOrg._id))
            .collect();

          for (const location of locations) {
            if (!dryRun) {
              await ctx.db.patch(location._id, { organizationId: keepOrg.org._id });
            }
          }

          // Update scrape sources
          const sources = await ctx.db
            .query("scrapeSources")
            .withIndex("by_organization", (q) => q.eq("organizationId", deleteOrg._id))
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
          if (!keepOrg.hasWebsite && deleteOrg.website && deleteOrg.website !== "<UNKNOWN>" && !dryRun) {
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
 * Find sessions with bad data
 */
export const findBadSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("sessions").collect();

    const badSessions: Array<{
      id: string;
      campId: string;
      issues: string[];
    }> = [];

    for (const session of sessions) {
      const issues: string[] = [];

      // Check for placeholder dates
      if (session.startDate?.includes("UNKNOWN") || session.startDate?.includes("<")) {
        issues.push(`Bad startDate: ${session.startDate}`);
      }
      if (session.endDate?.includes("UNKNOWN") || session.endDate?.includes("<")) {
        issues.push(`Bad endDate: ${session.endDate}`);
      }

      // Check for invalid dates (not YYYY-MM-DD format)
      if (session.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(session.startDate)) {
        issues.push(`Invalid startDate format: ${session.startDate}`);
      }
      if (session.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(session.endDate)) {
        issues.push(`Invalid endDate format: ${session.endDate}`);
      }

      // Check for dates in the past (before 2025)
      if (session.startDate && session.startDate < "2025-01-01") {
        issues.push(`Past date: ${session.startDate}`);
      }

      // Check for missing required times
      if (session.dropOffTime?.hour === undefined) {
        issues.push("Missing dropOffTime");
      }
      if (session.pickUpTime?.hour === undefined) {
        issues.push("Missing pickUpTime");
      }

      if (issues.length > 0) {
        badSessions.push({
          id: session._id,
          campId: session.campId,
          issues,
        });
      }
    }

    return {
      totalSessions: sessions.length,
      badSessionCount: badSessions.length,
      badSessions: badSessions.slice(0, 50), // Limit output
    };
  },
});

/**
 * Delete sessions with bad data
 */
export const deleteBadSessions = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const sessions = await ctx.db.query("sessions").collect();

    let deleted = 0;
    const deletedIds: string[] = [];

    for (const session of sessions) {
      let shouldDelete = false;

      // Delete sessions with placeholder dates
      if (
        session.startDate?.includes("UNKNOWN") ||
        session.startDate?.includes("<") ||
        session.endDate?.includes("UNKNOWN") ||
        session.endDate?.includes("<")
      ) {
        shouldDelete = true;
      }

      // Delete sessions with invalid date format
      if (
        (session.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(session.startDate)) ||
        (session.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(session.endDate))
      ) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        if (!dryRun) {
          await ctx.db.delete(session._id);
        }
        deleted++;
        deletedIds.push(session._id);
      }
    }

    return {
      dryRun,
      deleted,
      deletedIds: deletedIds.slice(0, 50),
    };
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
    const orgs = await ctx.db.query("organizations").collect();
    const orgIds = new Set(orgs.map((o) => o._id));

    // Find orphaned sessions
    const sessions = await ctx.db.query("sessions").collect();
    for (const session of sessions) {
      if (!orgIds.has(session.organizationId)) {
        if (!dryRun) {
          await ctx.db.delete(session._id);
        }
        deleted.sessions++;
      }
    }

    // Find orphaned camps
    const camps = await ctx.db.query("camps").collect();
    for (const camp of camps) {
      if (!orgIds.has(camp.organizationId)) {
        if (!dryRun) {
          await ctx.db.delete(camp._id);
        }
        deleted.camps++;
      }
    }

    // Find orphaned locations
    const locations = await ctx.db.query("locations").collect();
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

/**
 * Delete sessions with dates before a cutoff (old data)
 */
export const deleteOldSessions = mutation({
  args: {
    cutoffDate: v.optional(v.string()), // YYYY-MM-DD format, defaults to 2025-01-01
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const cutoff = args.cutoffDate ?? "2025-01-01";
    const sessions = await ctx.db.query("sessions").collect();

    let deleted = 0;
    const deletedIds: string[] = [];

    for (const session of sessions) {
      if (session.startDate && session.startDate < cutoff) {
        if (!dryRun) {
          await ctx.db.delete(session._id);
        }
        deleted++;
        deletedIds.push(session._id);
      }
    }

    return {
      dryRun,
      cutoffDate: cutoff,
      deleted,
      deletedIds: deletedIds.slice(0, 50),
    };
  },
});

/**
 * Delete locations with TBD/empty addresses and no sessions using them
 */
export const deleteUnusedBadLocations = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const locations = await ctx.db.query("locations").collect();
    const sessions = await ctx.db.query("sessions").collect();

    // Build set of location IDs that are in use
    const usedLocationIds = new Set(
      sessions.map((s) => s.locationId).filter(Boolean)
    );

    let deleted = 0;
    const deletedLocations: Array<{ id: string; name: string }> = [];

    for (const location of locations) {
      // Check if location has bad address
      const hasBadAddress =
        !location.address?.street ||
        location.address.street === "TBD" ||
        location.address.street === "" ||
        location.address.street.includes("TBD");

      // Check if location has default Portland coords
      const hasDefaultCoords =
        Math.abs(location.latitude - 45.5152) < 0.001 &&
        Math.abs(location.longitude - -122.6784) < 0.001;

      // Only delete if both bad address AND not in use
      if ((hasBadAddress || hasDefaultCoords) && !usedLocationIds.has(location._id)) {
        if (!dryRun) {
          await ctx.db.delete(location._id);
        }
        deleted++;
        deletedLocations.push({ id: location._id, name: location.name });
      }
    }

    return {
      dryRun,
      deleted,
      deletedLocations: deletedLocations.slice(0, 50),
    };
  },
});

/**
 * Find locations that need geocoding (have address but default coords)
 */
export const findLocationsNeedingGeocode = mutation({
  args: {},
  handler: async (ctx) => {
    const locations = await ctx.db.query("locations").collect();

    const needsGeocode: Array<{
      id: string;
      name: string;
      address: string;
    }> = [];

    for (const location of locations) {
      // Has default Portland coords
      const hasDefaultCoords =
        Math.abs(location.latitude - 45.5152) < 0.001 &&
        Math.abs(location.longitude - -122.6784) < 0.001;

      // Has a real address (not TBD)
      const hasRealAddress =
        location.address?.street &&
        location.address.street !== "TBD" &&
        location.address.street !== "" &&
        !location.address.street.includes("TBD");

      if (hasDefaultCoords && hasRealAddress) {
        const addr = location.address!;
        const fullAddress = [
          addr.street,
          addr.city,
          addr.state,
          addr.zip,
        ]
          .filter(Boolean)
          .join(", ");

        needsGeocode.push({
          id: location._id,
          name: location.name,
          address: fullAddress,
        });
      }
    }

    return {
      count: needsGeocode.length,
      locations: needsGeocode.slice(0, 50),
    };
  },
});

/**
 * Batch geocode all locations with addresses but default coords
 */
export const batchGeocodeLocations = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
  }> => {
    const limit = args.limit ?? 50;

    // Get locations needing geocoding
    const result: { count: number; locations: Array<{ id: string; name: string; address: string }> } = await ctx.runMutation(api.dataCleanup.findLocationsNeedingGeocode, {});
    const locations = result.locations.slice(0, limit);

    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const loc of locations) {
      try {
        // Geocode the address
        const geocoded = await ctx.runAction(api.lib.geocoding.geocodeQuery, {
          query: loc.address,
        });

        if (geocoded && geocoded.latitude && geocoded.longitude) {
          // Update the location
          await ctx.runMutation(api.dataCleanup.updateLocationCoords, {
            locationId: loc.id as Id<"locations">,
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
          });
          succeeded++;
        } else {
          failed++;
          errors.push(`No result for: ${loc.name}`);
        }
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${loc.name}: ${msg.slice(0, 100)}`);
      }
    }

    return {
      processed: locations.length,
      succeeded,
      failed,
      errors: errors.slice(0, 10),
    };
  },
});

/**
 * Extract address from location name and update the location
 */
export const fixLocationAddresses = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const locations = await ctx.db.query("locations").collect();

    let fixed = 0;
    const fixedLocations: Array<{ name: string; extractedAddress: string }> = [];

    // Multiple patterns to try
    const patterns = [
      // Parkour pattern: "7530 SE 22nd Ave" or "2561 NE 33rd Ave"
      /(\d+\s+(?:N|S|E|W|NE|NW|SE|SW)\.?\s+\d+(?:st|nd|rd|th)\s+Ave)/i,
      // Address with street and suffix: "1234 SW Something St"
      /(\d+\s+(?:N|S|E|W|NE|NW|SE|SW)\.?\s+[A-Za-z]+(?:\s+[A-Za-z]+)*\s+(?:St|Ave|Blvd|Rd|Dr|Way|Pkwy|Hwy|Ct|Ln|Pl|Cir|Parkway)\.?)/i,
      // With city and state: "1234 SW Something St, Portland, OR 97xxx"
      /(\d+\s+(?:N|S|E|W|NE|NW|SE|SW)?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*\s+(?:St|Ave|Blvd|Rd|Dr|Way|Pkwy|Hwy|Ct|Ln|Pl|Cir)\.?),?\s*(?:Portland|Beaverton|Gresham|Lake Oswego|Tigard|Hillsboro|Milwaukie|Oregon City|Sandy|McMinnville)?,?\s*(?:OR)?\s*(\d{5})?/i,
      // Broadway special case: "1000 SW Broadway"
      /(\d+\s+(?:N|S|E|W|NE|NW|SE|SW)\s+Broadway)/i,
      // Capitol Highway: "6651 SW Capitol Highway"
      /(\d+\s+(?:N|S|E|W|NE|NW|SE|SW)\s+Capitol\s+Highway)/i,
      // Willamette Blvd special case: "5000 N. Willamette Blvd"
      /(\d+\s+(?:N|S|E|W|NE|NW|SE|SW)\.?\s+Willamette\s+Blvd\.?)/i,
      // Baltimore Ave with N. format: "6635 N. Baltimore Ave"
      /(\d+\s+N\.\s+Baltimore\s+Ave)/i,
      // Oxbow Parkway pattern: "3010 SE Oxbow Parkway"
      /(\d+\s+(?:N|S|E|W|NE|NW|SE|SW)\s+Oxbow\s+Parkway)/i,
    ];

    // Known location addresses (hardcoded fixes for common venues)
    const knownAddresses: Record<string, { street: string; city: string; zip: string }> = {
      // OMSI and related
      "OMSI": { street: "1945 SE Water Ave", city: "Portland", zip: "97214" },
      "Oregon Zoo": { street: "4001 SW Canyon Rd", city: "Portland", zip: "97221" },
      "Camp Hancock": { street: "Field Station, Clarno", city: "Fossil", zip: "97830" },
      "Camp Gray": { street: "81260 Quiet Pl", city: "Arch Cape", zip: "97102" },
      "Tamarack Elementary": { street: "11425 SE 31st Ave", city: "Milwaukie", zip: "97222" },
      "Eagle Cap Wilderness": { street: "Eagle Cap Wilderness", city: "Enterprise", zip: "97828" },
      "Three Sisters Wilderness": { street: "Three Sisters Wilderness", city: "Bend", zip: "97701" },

      // Portland theaters
      "Portland Center Stage": { street: "128 NW 11th Ave", city: "Portland", zip: "97209" },
      "The Judy": { street: "1000 SW Broadway", city: "Portland", zip: "97205" },

      // Libraries
      "Capital Hill Library": { street: "10723 SW Capitol Hwy", city: "Portland", zip: "97219" },

      // Portland Parks community centers
      "Charles Jordan Community Center": { street: "9009 N Foss Ave", city: "Portland", zip: "97203" },
      "East Portland Community Center": { street: "740 SE 106th Ave", city: "Portland", zip: "97216" },
      "Matt Dishman Community Center": { street: "77 NE Knott St", city: "Portland", zip: "97212" },
      "Montavilla Community Center": { street: "8219 NE Glisan St", city: "Portland", zip: "97220" },
      "Mt. Scott Community Center": { street: "5530 SE 72nd Ave", city: "Portland", zip: "97206" },
      "Peninsula Park Community Center": { street: "700 N Rosa Parks Way", city: "Portland", zip: "97217" },
      "Southwest Community Center": { street: "6820 SW 45th Ave", city: "Portland", zip: "97219" },
      "St. Johns Community Center": { street: "8427 N Central St", city: "Portland", zip: "97203" },
      "Woodstock Community Center": { street: "5905 SE 43rd Ave", city: "Portland", zip: "97206" },
      "Multnomah Arts Center": { street: "7688 SW Capitol Hwy", city: "Portland", zip: "97219" },

      // Parkour Visions parks (Portland area)
      "Westmoreland Park": { street: "7530 SE 22nd Ave", city: "Portland", zip: "97202" },
      "Mt. Tabor Park": { street: "SE 60th Ave & Salmon St", city: "Portland", zip: "97215" },
      "Grant Park": { street: "2561 NE 33rd Ave", city: "Portland", zip: "97212" },
      "Elk Rock Island": { street: "12225 SE 19th Ave", city: "Portland", zip: "97222" },

      // Trackers Earth areas (using central points)
      "SE Portland": { street: "3530 SE Hawthorne Blvd", city: "Portland", zip: "97214" },
      "NE Portland": { street: "4030 NE Broadway", city: "Portland", zip: "97232" },
      "West- Cedar Hills": { street: "3205 SW Cedar Hills Blvd", city: "Beaverton", zip: "97005" },
      "Oregon Overnight": { street: "Mt Hood National Forest", city: "Government Camp", zip: "97028" },
      "Sandy, OR": { street: "39150 Pioneer Blvd", city: "Sandy", zip: "97055" },

      // Tinker Camp
      "6635 N. Baltimore": { street: "6635 N Baltimore Ave", city: "Portland", zip: "97203" },
      "6635 N Baltimore": { street: "6635 N Baltimore Ave", city: "Portland", zip: "97203" },

      // JCC
      "Schnitzer Family Campus": { street: "6651 SW Capitol Hwy", city: "Portland", zip: "97219" },
      "Mittleman Jewish Community Center": { street: "6651 SW Capitol Hwy", city: "Portland", zip: "97219" },

      // Shooting Star Adventures
      "Oxbow Regional Park": { street: "3010 SE Oxbow Pkwy", city: "Gresham", zip: "97080" },

      // Portland Youth Philharmonic
      "On the Main Stage": { street: "111 SW Broadway", city: "Portland", zip: "97205" },

      // Portland Rock Gym
      "Northeast - 21 NE 12th Ave": { street: "21 NE 12th Ave", city: "Portland", zip: "97232" },

      // One River School
      "One River School Lake Oswego": { street: "333 S State St", city: "Lake Oswego", zip: "97034" },

      // University of Portland
      "University of Portland": { street: "5000 N Willamette Blvd", city: "Portland", zip: "97203" },
      "Franz Riverfront Campus": { street: "5000 N Willamette Blvd", city: "Portland", zip: "97203" },

      // Kids Like Languages / School of Rock
      "St. Agatha Catholic School": { street: "7960 SE 15th Ave", city: "Portland", zip: "97202" },

      // Portland area default
      "Portland, OR": { street: "Pioneer Courthouse Square", city: "Portland", zip: "97204" },

      // Pedalheads locations
      "Pedalheads": { street: "Pioneer Courthouse Square", city: "Portland", zip: "97204" },

      // Seattle locations (Parkour Visions - mark as out of area)
      "Lincoln Park": { street: "7895 Fauntleroy Way SW", city: "Seattle", zip: "98136" },
      "Villa Academy": { street: "5001 NE 50th St", city: "Seattle", zip: "98105" },
      "SEA West Seattle": { street: "7895 Fauntleroy Way SW", city: "Seattle", zip: "98136" },
      "SEA UW": { street: "5001 NE 50th St", city: "Seattle", zip: "98105" },
      "Paramount Park": { street: "15300 8th Ave NE", city: "Shoreline", zip: "98155" },
      "SEA Shoreline": { street: "15300 8th Ave NE", city: "Shoreline", zip: "98155" },
      "Tukwila Community Center": { street: "12424 42nd Ave S", city: "Tukwila", zip: "98168" },
      "SEA South": { street: "12424 42nd Ave S", city: "Tukwila", zip: "98168" },
      "Luther Burbank": { street: "2040 84th Ave SE", city: "Mercer Island", zip: "98040" },
      "SEA Bellevue": { street: "2040 84th Ave SE", city: "Mercer Island", zip: "98040" },

      // Misc remaining
      "Portland Parks & Recreation": { street: "1120 SW 5th Ave", city: "Portland", zip: "97204" },
      "<UNKNOWN>": { street: "Portland Metro Area", city: "Portland", zip: "97204" },
    };

    for (const location of locations) {
      // Skip if already has a real address
      if (
        location.address?.street &&
        location.address.street !== "TBD" &&
        location.address.street !== "" &&
        !location.address.street.includes("TBD")
      ) {
        continue;
      }

      let street = "";
      let city = "Portland";
      let zip = "";

      // Check known addresses first
      for (const [name, addr] of Object.entries(knownAddresses)) {
        if (location.name.includes(name)) {
          street = addr.street;
          city = addr.city;
          zip = addr.zip;
          break;
        }
      }

      // Try patterns if no known address
      if (!street) {
        for (const pattern of patterns) {
          const match = location.name.match(pattern);
          if (match && match[1]) {
            street = match[1].trim();
            zip = match[2] || "";
            break;
          }
        }
      }

      // Try to extract city from name
      if (street) {
        const cityMatch = location.name.match(/(Portland|Beaverton|Gresham|Lake Oswego|Tigard|Hillsboro|Milwaukie|Oregon City|Sandy|McMinnville)/i);
        if (cityMatch) {
          city = cityMatch[1];
        }

        if (!dryRun) {
          await ctx.db.patch(location._id, {
            address: {
              street,
              city,
              state: "OR",
              zip,
            },
          });
        }

        fixed++;
        if (fixedLocations.length < 20) {
          fixedLocations.push({
            name: location.name,
            extractedAddress: `${street}, ${city}, OR ${zip}`.trim(),
          });
        }
      }
    }

    return {
      dryRun,
      fixed,
      fixedLocations,
    };
  },
});

/**
 * Find sources that created locations with TBD addresses
 */
export const findSourcesWithBadLocations = mutation({
  args: {},
  handler: async (ctx) => {
    const locations = await ctx.db.query("locations").collect();
    const sessions = await ctx.db.query("sessions").collect();
    const sources = await ctx.db.query("scrapeSources").collect();

    // Find locations with TBD addresses that are in use
    const badLocations = locations.filter((loc) => {
      const hasBadAddress =
        !loc.address?.street ||
        loc.address.street === "TBD" ||
        loc.address.street === "" ||
        loc.address.street.includes("TBD");
      return hasBadAddress;
    });

    // Map location IDs to source IDs via sessions
    const locationToSources = new Map<string, Set<string>>();
    for (const session of sessions) {
      if (session.locationId && session.sourceId) {
        const existing = locationToSources.get(session.locationId) || new Set();
        existing.add(session.sourceId);
        locationToSources.set(session.locationId, existing);
      }
    }

    // Count bad locations per source
    const sourceStats = new Map<string, { name: string; url: string; badLocationCount: number; locationNames: string[] }>();

    for (const loc of badLocations) {
      const sourceIds = locationToSources.get(loc._id);
      if (sourceIds) {
        for (const sourceId of sourceIds) {
          const source = sources.find((s) => s._id === sourceId);
          if (source) {
            const existing = sourceStats.get(sourceId) || {
              name: source.name,
              url: source.url,
              badLocationCount: 0,
              locationNames: [],
            };
            existing.badLocationCount++;
            if (existing.locationNames.length < 5) {
              existing.locationNames.push(loc.name);
            }
            sourceStats.set(sourceId, existing);
          }
        }
      }
    }

    // Convert to array and sort by count
    const results = Array.from(sourceStats.entries())
      .map(([id, stats]) => ({ sourceId: id, ...stats }))
      .sort((a, b) => b.badLocationCount - a.badLocationCount);

    return {
      totalBadLocations: badLocations.length,
      sourceCount: results.length,
      sources: results.slice(0, 20),
    };
  },
});

/**
 * Update location coordinates
 */
export const updateLocationCoords = mutation({
  args: {
    locationId: v.id("locations"),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.locationId, {
      latitude: args.latitude,
      longitude: args.longitude,
    });
    return { success: true };
  },
});

/**
 * Get a comprehensive data quality report
 */
export const getDataQualityReport = mutation({
  args: {},
  handler: async (ctx) => {
    const [orgs, camps, sessions, locations, sources] = await Promise.all([
      ctx.db.query("organizations").collect(),
      ctx.db.query("camps").collect(),
      ctx.db.query("sessions").collect(),
      ctx.db.query("locations").collect(),
      ctx.db.query("scrapeSources").collect(),
    ]);

    // Org issues
    const orgsWithoutLogo = orgs.filter((o) => !o.logoStorageId).length;
    const orgsWithBadWebsite = orgs.filter(
      (o) => !o.website || o.website === "<UNKNOWN>" || !o.website.startsWith("http")
    ).length;

    // Duplicate orgs
    const orgNames = orgs.map((o) => o.name);
    const duplicateOrgNames = orgNames.filter((name, i) => orgNames.indexOf(name) !== i);
    const uniqueDuplicates = [...new Set(duplicateOrgNames)];

    // Session issues
    const sessionsWithBadDates = sessions.filter(
      (s) =>
        s.startDate?.includes("UNKNOWN") ||
        s.startDate?.includes("<") ||
        s.endDate?.includes("UNKNOWN") ||
        s.endDate?.includes("<") ||
        (s.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(s.startDate))
    ).length;

    const sessionsWithPastDates = sessions.filter(
      (s) => s.startDate && s.startDate < "2025-01-01"
    ).length;

    // Location issues
    const locationsWithTBD = locations.filter(
      (l) => !l.address?.street || l.address.street === "TBD" || l.address.street === ""
    ).length;

    const locationsWithDefaultCoords = locations.filter(
      (l) =>
        Math.abs(l.latitude - 45.5152) < 0.001 && Math.abs(l.longitude - -122.6784) < 0.001
    ).length;

    // Orphan check
    const orgIds = new Set(orgs.map((o) => o._id));
    const orphanedSessions = sessions.filter((s) => !orgIds.has(s.organizationId)).length;
    const orphanedCamps = camps.filter((c) => !orgIds.has(c.organizationId)).length;

    return {
      summary: {
        organizations: orgs.length,
        camps: camps.length,
        sessions: sessions.length,
        locations: locations.length,
        scrapeSources: sources.length,
      },
      issues: {
        duplicateOrganizations: uniqueDuplicates.length,
        duplicateOrgNames: uniqueDuplicates,
        orgsWithoutLogo,
        orgsWithBadWebsite,
        sessionsWithBadDates,
        sessionsWithPastDates,
        locationsWithTBD,
        locationsWithDefaultCoords,
        orphanedSessions,
        orphanedCamps,
      },
    };
  },
});

/**
 * Helper to check if a string is a valid URL
 */
function isValidUrl(str: string | undefined | null): boolean {
  if (!str) return false;
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
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
    const camps = await ctx.db.query("camps").collect();
    const sessions = await ctx.db.query("sessions").collect();
    const sources = await ctx.db.query("scrapeSources").collect();

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
      if (camp.imageUrls && camp.imageUrls.some((url: string) => !isValidUrl(url) && !url.startsWith("kg7"))) {
        const badUrls = camp.imageUrls.filter((url: string) => !isValidUrl(url) && !url.startsWith("kg7"));
        if (!dryRun && badUrls.length > 0) {
          const validUrls = camp.imageUrls.filter((url: string) => isValidUrl(url) || url.startsWith("kg7"));
          await ctx.db.patch(camp._id, {
            imageUrls: validUrls,
          });
        }
      }
    }

    // Fix sessions with bad registration URLs
    for (const session of sessions) {
      if (session.externalRegistrationUrl && !isValidUrl(session.externalRegistrationUrl)) {
        const camp = camps.find(c => c._id === session.campId);
        const source = session.sourceId ? sourceById.get(session.sourceId as string) : undefined;

        badSessions.push({
          campName: camp?.name || "Unknown",
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
 * Trace a session back to its source data for debugging
 */
export const traceSessionSource = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return { error: "Session not found" };
    }

    const camp = session.campId ? await ctx.db.get(session.campId) : null;
    const location = session.locationId ? await ctx.db.get(session.locationId) : null;
    const source = session.sourceId ? await ctx.db.get(session.sourceId) : null;
    const organization = session.organizationId ? await ctx.db.get(session.organizationId) : null;

    // Find recent jobs for this source
    const recentJobs = source
      ? await ctx.db
          .query("scrapeJobs")
          .withIndex("by_source", (q) => q.eq("sourceId", source._id))
          .order("desc")
          .take(5)
      : [];

    // Find raw data from those jobs
    const rawDataSamples: Array<{ jobId: string; preview: string }> = [];
    for (const job of recentJobs) {
      const rawData = await ctx.db
        .query("scrapeRawData")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .first();
      if (rawData) {
        rawDataSamples.push({
          jobId: job._id,
          preview: rawData.rawJson.slice(0, 500),
        });
      }
    }

    return {
      session: {
        id: session._id,
        startDate: session.startDate,
        endDate: session.endDate,
        externalRegistrationUrl: session.externalRegistrationUrl,
        status: session.status,
        createdAt: session._creationTime,
      },
      camp: camp ? {
        id: camp._id,
        name: camp.name,
        website: camp.website,
        imageUrls: camp.imageUrls,
      } : null,
      location: location ? {
        id: location._id,
        name: location.name,
        address: location.address,
      } : null,
      source: source ? {
        id: source._id,
        name: source.name,
        url: source.url,
        scraperModule: source.scraperModule,
      } : null,
      organization: organization ? {
        id: organization._id,
        name: organization.name,
        website: organization.website,
      } : null,
      recentJobs: recentJobs.map(j => ({
        id: j._id,
        status: j.status,
        sessionsFound: j.sessionsFound,
        completedAt: j.completedAt,
      })),
      rawDataSamples,
    };
  },
});

/**
 * Get per-organization data quality report
 * Checks sessions for each org to see data completeness
 */
export const getOrganizationQualityReport = mutation({
  args: {},
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();
    const camps = await ctx.db.query("camps").collect();
    const sessions = await ctx.db.query("sessions").collect();
    const sources = await ctx.db.query("scrapeSources").collect();

    const orgReports: Array<{
      id: string;
      name: string;
      website: string | undefined;
      campCount: number;
      sessionCount: number;
      hasLogo: boolean;
      sourceCount: number;
      quality: {
        withDates: number;
        withPrices: number;
        withAges: number;
        withLocations: number;
        withRegistrationUrl: number;
      };
      issues: string[];
    }> = [];

    for (const org of organizations) {
      const orgCamps = camps.filter((c) => c.organizationId === org._id);
      const campIds = new Set(orgCamps.map((c) => c._id));
      const orgSessions = sessions.filter((s) => campIds.has(s.campId));
      const orgSources = sources.filter((s) => s.organizationId === org._id);

      const quality = {
        withDates: 0,
        withPrices: 0,
        withAges: 0,
        withLocations: 0,
        withRegistrationUrl: 0,
      };

      for (const session of orgSessions) {
        if (session.startDate && session.endDate) quality.withDates++;
        if (session.price && session.price > 0) quality.withPrices++;
        if (
          session.ageRequirements &&
          (session.ageRequirements.minAge ||
            session.ageRequirements.minGrade ||
            session.ageRequirements.maxAge ||
            session.ageRequirements.maxGrade)
        ) {
          quality.withAges++;
        }
        if (session.locationId) quality.withLocations++;
        if (session.externalRegistrationUrl) quality.withRegistrationUrl++;
      }

      const issues: string[] = [];
      if (orgSessions.length > 0) {
        if (quality.withDates < orgSessions.length * 0.8) issues.push("missing_dates");
        if (quality.withPrices < orgSessions.length * 0.5) issues.push("missing_prices");
        if (quality.withAges < orgSessions.length * 0.5) issues.push("missing_ages");
        if (quality.withLocations < orgSessions.length * 0.8) issues.push("missing_locations");
        if (quality.withRegistrationUrl < orgSessions.length * 0.8) issues.push("missing_registration_urls");
      }

      // Check if camps have images
      const campsWithImages = orgCamps.filter(
        (c) =>
          (c.imageUrls && c.imageUrls.length > 0) ||
          (c.imageStorageIds && c.imageStorageIds.length > 0)
      ).length;
      if (campsWithImages < orgCamps.length * 0.5 && orgCamps.length > 0) {
        issues.push("missing_images");
      }

      orgReports.push({
        id: org._id,
        name: org.name,
        website: org.website,
        campCount: orgCamps.length,
        sessionCount: orgSessions.length,
        hasLogo: !!org.logoStorageId,
        sourceCount: orgSources.length,
        quality,
        issues,
      });
    }

    // Sort by session count descending
    orgReports.sort((a, b) => b.sessionCount - a.sessionCount);

    const summary = {
      totalOrgs: organizations.length,
      orgsWithIssues: orgReports.filter((o) => o.issues.length > 0).length,
      orgsWithNoSessions: orgReports.filter((o) => o.sessionCount === 0).length,
    };

    return { summary, organizations: orgReports };
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
/**
 * Fix basketball/sports camp prices
 * Nike Basketball Camps typically charge:
 * - Day camps: $559/week
 * - Overnight camps: $995/week
 */
/**
 * Fix session prices for an organization based on a default price
 * Useful for orgs with standardized pricing
 */
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
    const OMSI_ORG_ID = "kh75v4zw4w3v6hc2m8y9jjze5h80dc22" as Id<"organizations">;

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", OMSI_ORG_ID)
      )
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
      if (url.includes("?product=")) {
        const productName = url.split("?product=")[1];
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

export const fixOrgPrices = mutation({
  args: {
    organizationId: v.id("organizations"),
    defaultPriceInCents: v.number(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId)
      )
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

export const fixBasketballCampPrices = mutation({
  args: {
    organizationId: v.id("organizations"),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    // Get all sessions with $0 price for this org
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId)
      )
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
      if (nameLower.includes("overnight") || nameLower.includes("residential")) {
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

export const fixTrackersPrices = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    // Trackers Earth Portland organization ID
    const TRACKERS_ORG_ID = "kh7f4thw13306rys338we33kqd80dkrm" as Id<"organizations">;

    // Get all Trackers sessions with $0 price
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", TRACKERS_ORG_ID)
      )
      .collect();

    const zeroPriceSessions = sessions.filter((s) => !s.price || s.price === 0);

    // Get camps for these sessions to help determine pricing
    const campIds = [...new Set(zeroPriceSessions.map((s) => s.campId))];
    const camps = await Promise.all(
      campIds.map((id) => ctx.db.get(id))
    );
    const campMap = new Map(camps.filter(Boolean).map((c) => [c!._id, c!]));

    // Get locations
    const locationIds = [...new Set(zeroPriceSessions.map((s) => s.locationId).filter(Boolean))];
    const locations = await Promise.all(
      locationIds.map((id) => ctx.db.get(id as Id<"locations">))
    );
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
      ageReqs?: { minGrade?: number; maxGrade?: number }
    ): number {
      const nameLower = campName.toLowerCase();
      const locationLower = locationName.toLowerCase();

      // Check for overnight camps
      if (locationLower.includes("overnight") || nameLower.includes("overnight")) {
        if (nameLower.includes("expedition") || nameLower.includes("extended")) {
          return TRACKERS_PRICING.overnightExpedition;
        }
        return TRACKERS_PRICING.overnightStandard;
      }

      // Check for Leader in Training
      if (nameLower.includes("leader") || nameLower.includes("lit") || nameLower.includes("leadership")) {
        return TRACKERS_PRICING.lit;
      }

      // Check for Pre-K camps
      if (ageReqs && ageReqs.maxGrade !== undefined && ageReqs.maxGrade <= 0) {
        return TRACKERS_PRICING.preK;
      }

      // Check for transport camps
      if (
        locationLower.includes("sandy") ||
        locationLower.includes("transport") ||
        nameLower.includes("transport")
      ) {
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

      const locationName = location?.name || "";
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

// ============================================
// SESSION DEDUPLICATION
// ============================================

/**
 * Find duplicate sessions (same camp, location, start date, end date)
 */
export const findDuplicateSessions = mutation({
  args: {
    cityId: v.optional(v.id("cities")),
  },
  handler: async (ctx, args) => {
    // Get sessions, optionally filtered by city
    let sessions;
    const cityId = args.cityId;
    if (cityId) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_city_and_status", (q) => q.eq("cityId", cityId))
        .collect();
    } else {
      sessions = await ctx.db.query("sessions").collect();
    }

    // Group by deduplication key: campId + locationId + startDate + endDate
    const byKey = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const key = `${session.campId}|${session.locationId}|${session.startDate}|${session.endDate}`;
      const existing = byKey.get(key) || [];
      existing.push(session);
      byKey.set(key, existing);
    }

    // Find duplicates (groups with more than 1 session)
    const duplicateGroups: Array<{
      key: string;
      count: number;
      sessions: Array<{
        id: string;
        campName: string;
        startDate: string;
        endDate: string;
        price: number;
        status: string;
        completenessScore: number | undefined;
        lastScrapedAt: number | undefined;
        sourceId: string | undefined;
      }>;
    }> = [];

    for (const [key, sessionList] of byKey) {
      if (sessionList.length > 1) {
        duplicateGroups.push({
          key,
          count: sessionList.length,
          sessions: sessionList.map((s) => ({
            id: s._id,
            campName: s.campName || "Unknown",
            startDate: s.startDate,
            endDate: s.endDate,
            price: s.price,
            status: s.status,
            completenessScore: s.completenessScore,
            lastScrapedAt: s.lastScrapedAt,
            sourceId: s.sourceId,
          })),
        });
      }
    }

    // Sort by count descending
    duplicateGroups.sort((a, b) => b.count - a.count);

    const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.count - 1, 0);

    return {
      totalSessions: sessions.length,
      duplicateGroups: duplicateGroups.length,
      totalDuplicatesToRemove: totalDuplicates,
      groups: duplicateGroups.slice(0, 50), // Return first 50 groups
    };
  },
});

/**
 * Score a session for deduplication - higher is better
 */
function scoreSession(session: {
  price: number;
  completenessScore?: number;
  lastScrapedAt?: number;
  status: string;
  externalRegistrationUrl?: string;
  description?: string;
}): number {
  let score = 0;

  // Prefer active sessions
  if (session.status === "active") score += 100;
  else if (session.status === "draft") score += 50;

  // Prefer sessions with prices
  if (session.price > 0) score += 50;

  // Prefer higher completeness
  score += (session.completenessScore || 0);

  // Prefer more recently scraped
  if (session.lastScrapedAt) {
    const ageInDays = (Date.now() - session.lastScrapedAt) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 30 - ageInDays); // Up to 30 points for recent scrapes
  }

  // Prefer sessions with registration URLs
  if (session.externalRegistrationUrl) score += 20;

  // Prefer sessions with descriptions
  if (session.description) score += 10;

  return score;
}

/**
 * Merge duplicate sessions - keeps the best one and deletes others
 * Also reassigns registrations to the kept session
 */
export const mergeDuplicateSessions = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    cityId: v.optional(v.id("cities")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const limit = args.limit ?? 1000;

    // Get sessions
    let sessions;
    const cityId = args.cityId;
    if (cityId) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_city_and_status", (q) => q.eq("cityId", cityId))
        .collect();
    } else {
      sessions = await ctx.db.query("sessions").collect();
    }

    // Group by deduplication key
    const byKey = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const key = `${session.campId}|${session.locationId}|${session.startDate}|${session.endDate}`;
      const existing = byKey.get(key) || [];
      existing.push(session);
      byKey.set(key, existing);
    }

    let mergedCount = 0;
    let deletedCount = 0;
    let registrationsReassigned = 0;
    const mergeResults: Array<{
      keptId: string;
      deletedIds: string[];
      campName: string;
    }> = [];

    for (const [, sessionList] of byKey) {
      if (sessionList.length <= 1) continue;
      if (mergedCount >= limit) break;

      // Score each session and pick the best
      const scored = sessionList.map((s) => ({
        session: s,
        score: scoreSession(s),
      }));
      scored.sort((a, b) => b.score - a.score);

      const keep = scored[0].session;
      const toDelete = scored.slice(1).map((s) => s.session);

      // Reassign registrations from deleted sessions to kept session
      for (const deleteSession of toDelete) {
        const registrations = await ctx.db
          .query("registrations")
          .withIndex("by_session", (q) => q.eq("sessionId", deleteSession._id))
          .collect();

        for (const reg of registrations) {
          // Check if this child already has a registration for the kept session
          const existingReg = await ctx.db
            .query("registrations")
            .withIndex("by_child_and_session", (q) =>
              q.eq("childId", reg.childId).eq("sessionId", keep._id)
            )
            .unique();

          if (!dryRun) {
            if (existingReg) {
              // Already registered for kept session, just delete the duplicate registration
              await ctx.db.delete(reg._id);
            } else {
              // Reassign to kept session
              await ctx.db.patch(reg._id, { sessionId: keep._id });
            }
          }
          registrationsReassigned++;
        }

        // Delete the duplicate session
        if (!dryRun) {
          await ctx.db.delete(deleteSession._id);
        }
        deletedCount++;
      }

      mergeResults.push({
        keptId: keep._id,
        deletedIds: toDelete.map((s) => s._id),
        campName: keep.campName || "Unknown",
      });
      mergedCount++;
    }

    return {
      dryRun,
      totalSessions: sessions.length,
      duplicateGroupsMerged: mergedCount,
      sessionsDeleted: deletedCount,
      registrationsReassigned,
      sampleMerges: mergeResults.slice(0, 20),
    };
  },
});

/**
 * Internal mutation for automated deduplication (called by cron)
 * Runs the merge with dryRun=false and a reasonable limit
 */
export const autoDeduplicateSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all sessions
    const sessions = await ctx.db.query("sessions").collect();

    // Group by deduplication key
    const byKey = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const key = `${session.campId}|${session.locationId}|${session.startDate}|${session.endDate}`;
      const existing = byKey.get(key) || [];
      existing.push(session);
      byKey.set(key, existing);
    }

    let mergedCount = 0;
    let deletedCount = 0;
    let registrationsReassigned = 0;
    const limit = 500; // Process up to 500 duplicate groups per run

    for (const [, sessionList] of byKey) {
      if (sessionList.length <= 1) continue;
      if (mergedCount >= limit) break;

      // Score each session and pick the best
      const scored = sessionList.map((s) => ({
        session: s,
        score: scoreSession(s),
      }));
      scored.sort((a, b) => b.score - a.score);

      const keep = scored[0].session;
      const toDelete = scored.slice(1).map((s) => s.session);

      // Reassign registrations from deleted sessions to kept session
      for (const deleteSession of toDelete) {
        const registrations = await ctx.db
          .query("registrations")
          .withIndex("by_session", (q) => q.eq("sessionId", deleteSession._id))
          .collect();

        for (const reg of registrations) {
          const existingReg = await ctx.db
            .query("registrations")
            .withIndex("by_child_and_session", (q) =>
              q.eq("childId", reg.childId).eq("sessionId", keep._id)
            )
            .unique();

          if (existingReg) {
            await ctx.db.delete(reg._id);
          } else {
            await ctx.db.patch(reg._id, { sessionId: keep._id });
          }
          registrationsReassigned++;
        }

        // Delete the duplicate session
        await ctx.db.delete(deleteSession._id);
        deletedCount++;
      }

      mergedCount++;
    }

    // Log results (these appear in Convex dashboard logs)
    if (deletedCount > 0) {
      console.log(`[Auto-Dedup] Merged ${mergedCount} groups, deleted ${deletedCount} sessions, reassigned ${registrationsReassigned} registrations`);
    }

    return {
      duplicateGroupsMerged: mergedCount,
      sessionsDeleted: deletedCount,
      registrationsReassigned,
    };
  },
});

// ============================================
// LOCATION DEDUPLICATION
// ============================================

/**
 * Find duplicate locations (same name, same organization)
 */
export const findDuplicateLocations = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    // Get locations, optionally filtered by organization
    let locations;
    const orgId = args.organizationId;
    if (orgId) {
      locations = await ctx.db
        .query("locations")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();
    } else {
      locations = await ctx.db.query("locations").collect();
    }

    // Group by normalized name + organization
    const byKey = new Map<string, typeof locations>();
    for (const location of locations) {
      const normalizedName = location.name.toLowerCase().trim();
      const key = `${location.organizationId}|${normalizedName}`;
      const existing = byKey.get(key) || [];
      existing.push(location);
      byKey.set(key, existing);
    }

    // Find duplicates
    const duplicateGroups: Array<{
      name: string;
      organizationId: string | undefined;
      count: number;
      locations: Array<{
        id: string;
        name: string;
        address: string;
        hasCoords: boolean;
        sessionCount: number;
      }>;
    }> = [];

    for (const [, locationList] of byKey) {
      if (locationList.length > 1) {
        // Count sessions for each location
        const locsWithCounts = await Promise.all(
          locationList.map(async (loc) => {
            const sessions = await ctx.db
              .query("sessions")
              .withIndex("by_location", (q) => q.eq("locationId", loc._id))
              .collect();
            const addressStr = loc.address
              ? `${loc.address.street}, ${loc.address.city}, ${loc.address.state} ${loc.address.zip}`
              : "No address";
            return {
              id: loc._id,
              name: loc.name,
              address: addressStr,
              hasCoords: loc.latitude !== undefined && loc.longitude !== undefined,
              sessionCount: sessions.length,
            };
          })
        );

        duplicateGroups.push({
          name: locationList[0].name,
          organizationId: locationList[0].organizationId,
          count: locationList.length,
          locations: locsWithCounts,
        });
      }
    }

    // Sort by count descending
    duplicateGroups.sort((a, b) => b.count - a.count);

    const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.count - 1, 0);

    return {
      totalLocations: locations.length,
      duplicateGroups: duplicateGroups.length,
      totalDuplicatesToRemove: totalDuplicates,
      groups: duplicateGroups.slice(0, 50),
    };
  },
});

/**
 * Score a location for deduplication - higher is better
 */
function scoreLocation(location: {
  address?: { street: string; city: string; state: string; zip: string };
  latitude?: number;
  longitude?: number;
  sessionCount: number;
}): number {
  let score = 0;

  // Prefer locations with more sessions
  score += location.sessionCount * 10;

  // Prefer locations with addresses (not TBD)
  if (location.address && location.address.street && location.address.street !== "TBD") score += 20;

  // Prefer locations with coordinates
  if (location.latitude !== undefined && location.longitude !== undefined) score += 30;

  return score;
}

/**
 * Merge duplicate locations - keeps the first one and reassigns sessions
 * Processes locations in small batches to avoid read limits
 */
export const mergeDuplicateLocations = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const batchSize = args.batchSize ?? 200; // Process 200 locations at a time

    // Get a batch of locations
    const locations = await ctx.db.query("locations").take(batchSize);

    // Group by normalized name + organization
    const byKey = new Map<string, typeof locations>();
    for (const location of locations) {
      const normalizedName = location.name.toLowerCase().trim();
      const key = `${location.organizationId ?? "none"}|${normalizedName}`;
      const existing = byKey.get(key) || [];
      existing.push(location);
      byKey.set(key, existing);
    }

    let mergedCount = 0;
    let deletedCount = 0;
    let sessionsReassigned = 0;

    for (const [, locationList] of byKey) {
      if (locationList.length <= 1) continue;

      // Keep the first one (simplest approach)
      const keep = locationList[0];
      const toDelete = locationList.slice(1);

      // Reassign sessions and delete duplicates
      for (const deleteLocation of toDelete) {
        const sessions = await ctx.db
          .query("sessions")
          .withIndex("by_location", (q) => q.eq("locationId", deleteLocation._id))
          .take(100);

        for (const session of sessions) {
          if (!dryRun) {
            await ctx.db.patch(session._id, { locationId: keep._id });
          }
          sessionsReassigned++;
        }

        if (!dryRun) {
          await ctx.db.delete(deleteLocation._id);
        }
        deletedCount++;
      }
      mergedCount++;
    }

    return {
      dryRun,
      batchSize,
      locationsProcessed: locations.length,
      duplicateGroupsMerged: mergedCount,
      locationsDeleted: deletedCount,
      sessionsReassigned,
      message: deletedCount > 0 ? "Run again to process more duplicates" : "No duplicates found in this batch",
    };
  },
});
