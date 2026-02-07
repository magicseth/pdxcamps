import { mutation, action } from '../_generated/server';
import { api } from '../_generated/api';
import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';

/**
 * Delete locations with TBD/empty addresses and no sessions using them
 */
export const deleteUnusedBadLocations = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const locations = await ctx.db.query('locations').collect();
    const sessions = await ctx.db.query('sessions').collect();

    // Build set of location IDs that are in use
    const usedLocationIds = new Set(sessions.map((s) => s.locationId).filter(Boolean));

    let deleted = 0;
    const deletedLocations: Array<{ id: string; name: string }> = [];

    for (const location of locations) {
      // Check if location has bad address
      const hasBadAddress =
        !location.address?.street ||
        location.address.street === 'TBD' ||
        location.address.street === '' ||
        location.address.street.includes('TBD');

      // Check if location has default Portland coords
      const hasDefaultCoords =
        Math.abs(location.latitude - 45.5152) < 0.001 && Math.abs(location.longitude - -122.6784) < 0.001;

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
    const locations = await ctx.db.query('locations').collect();

    const needsGeocode: Array<{
      id: string;
      name: string;
      address: string;
    }> = [];

    for (const location of locations) {
      // Has default Portland coords
      const hasDefaultCoords =
        Math.abs(location.latitude - 45.5152) < 0.001 && Math.abs(location.longitude - -122.6784) < 0.001;

      // Has a real address (not TBD)
      const hasRealAddress =
        location.address?.street &&
        location.address.street !== 'TBD' &&
        location.address.street !== '' &&
        !location.address.street.includes('TBD');

      if (hasDefaultCoords && hasRealAddress) {
        const addr = location.address!;
        const fullAddress = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');

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
  handler: async (
    ctx,
    args,
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
  }> => {
    const limit = args.limit ?? 50;

    // Get locations needing geocoding
    const result: { count: number; locations: Array<{ id: string; name: string; address: string }> } =
      await ctx.runMutation(api.cleanup.locations.findLocationsNeedingGeocode, {});
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
          await ctx.runMutation(api.cleanup.locations.updateLocationCoords, {
            locationId: loc.id as Id<'locations'>,
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
    const locations = await ctx.db.query('locations').collect();

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
      'OMSI': { street: '1945 SE Water Ave', city: 'Portland', zip: '97214' },
      'Oregon Zoo': { street: '4001 SW Canyon Rd', city: 'Portland', zip: '97221' },
      'Camp Hancock': { street: 'Field Station, Clarno', city: 'Fossil', zip: '97830' },
      'Camp Gray': { street: '81260 Quiet Pl', city: 'Arch Cape', zip: '97102' },
      'Tamarack Elementary': { street: '11425 SE 31st Ave', city: 'Milwaukie', zip: '97222' },
      'Eagle Cap Wilderness': { street: 'Eagle Cap Wilderness', city: 'Enterprise', zip: '97828' },
      'Three Sisters Wilderness': { street: 'Three Sisters Wilderness', city: 'Bend', zip: '97701' },

      // Portland theaters
      'Portland Center Stage': { street: '128 NW 11th Ave', city: 'Portland', zip: '97209' },
      'The Judy': { street: '1000 SW Broadway', city: 'Portland', zip: '97205' },

      // Libraries
      'Capital Hill Library': { street: '10723 SW Capitol Hwy', city: 'Portland', zip: '97219' },

      // Portland Parks community centers
      'Charles Jordan Community Center': { street: '9009 N Foss Ave', city: 'Portland', zip: '97203' },
      'East Portland Community Center': { street: '740 SE 106th Ave', city: 'Portland', zip: '97216' },
      'Matt Dishman Community Center': { street: '77 NE Knott St', city: 'Portland', zip: '97212' },
      'Montavilla Community Center': { street: '8219 NE Glisan St', city: 'Portland', zip: '97220' },
      'Mt. Scott Community Center': { street: '5530 SE 72nd Ave', city: 'Portland', zip: '97206' },
      'Peninsula Park Community Center': { street: '700 N Rosa Parks Way', city: 'Portland', zip: '97217' },
      'Southwest Community Center': { street: '6820 SW 45th Ave', city: 'Portland', zip: '97219' },
      'St. Johns Community Center': { street: '8427 N Central St', city: 'Portland', zip: '97203' },
      'Woodstock Community Center': { street: '5905 SE 43rd Ave', city: 'Portland', zip: '97206' },
      'Multnomah Arts Center': { street: '7688 SW Capitol Hwy', city: 'Portland', zip: '97219' },

      // Parkour Visions parks (Portland area)
      'Westmoreland Park': { street: '7530 SE 22nd Ave', city: 'Portland', zip: '97202' },
      'Mt. Tabor Park': { street: 'SE 60th Ave & Salmon St', city: 'Portland', zip: '97215' },
      'Grant Park': { street: '2561 NE 33rd Ave', city: 'Portland', zip: '97212' },
      'Elk Rock Island': { street: '12225 SE 19th Ave', city: 'Portland', zip: '97222' },

      // Trackers Earth areas (using central points)
      'SE Portland': { street: '3530 SE Hawthorne Blvd', city: 'Portland', zip: '97214' },
      'NE Portland': { street: '4030 NE Broadway', city: 'Portland', zip: '97232' },
      'West- Cedar Hills': { street: '3205 SW Cedar Hills Blvd', city: 'Beaverton', zip: '97005' },
      'Oregon Overnight': { street: 'Mt Hood National Forest', city: 'Government Camp', zip: '97028' },
      'Sandy, OR': { street: '39150 Pioneer Blvd', city: 'Sandy', zip: '97055' },

      // Tinker Camp
      '6635 N. Baltimore': { street: '6635 N Baltimore Ave', city: 'Portland', zip: '97203' },
      '6635 N Baltimore': { street: '6635 N Baltimore Ave', city: 'Portland', zip: '97203' },

      // JCC
      'Schnitzer Family Campus': { street: '6651 SW Capitol Hwy', city: 'Portland', zip: '97219' },
      'Mittleman Jewish Community Center': { street: '6651 SW Capitol Hwy', city: 'Portland', zip: '97219' },

      // Shooting Star Adventures
      'Oxbow Regional Park': { street: '3010 SE Oxbow Pkwy', city: 'Gresham', zip: '97080' },

      // Portland Youth Philharmonic
      'On the Main Stage': { street: '111 SW Broadway', city: 'Portland', zip: '97205' },

      // Portland Rock Gym
      'Northeast - 21 NE 12th Ave': { street: '21 NE 12th Ave', city: 'Portland', zip: '97232' },

      // One River School
      'One River School Lake Oswego': { street: '333 S State St', city: 'Lake Oswego', zip: '97034' },

      // University of Portland
      'University of Portland': { street: '5000 N Willamette Blvd', city: 'Portland', zip: '97203' },
      'Franz Riverfront Campus': { street: '5000 N Willamette Blvd', city: 'Portland', zip: '97203' },

      // Kids Like Languages / School of Rock
      'St. Agatha Catholic School': { street: '7960 SE 15th Ave', city: 'Portland', zip: '97202' },

      // Portland area default
      'Portland, OR': { street: 'Pioneer Courthouse Square', city: 'Portland', zip: '97204' },

      // Pedalheads locations
      'Pedalheads': { street: 'Pioneer Courthouse Square', city: 'Portland', zip: '97204' },

      // Seattle locations (Parkour Visions - mark as out of area)
      'Lincoln Park': { street: '7895 Fauntleroy Way SW', city: 'Seattle', zip: '98136' },
      'Villa Academy': { street: '5001 NE 50th St', city: 'Seattle', zip: '98105' },
      'SEA West Seattle': { street: '7895 Fauntleroy Way SW', city: 'Seattle', zip: '98136' },
      'SEA UW': { street: '5001 NE 50th St', city: 'Seattle', zip: '98105' },
      'Paramount Park': { street: '15300 8th Ave NE', city: 'Shoreline', zip: '98155' },
      'SEA Shoreline': { street: '15300 8th Ave NE', city: 'Shoreline', zip: '98155' },
      'Tukwila Community Center': { street: '12424 42nd Ave S', city: 'Tukwila', zip: '98168' },
      'SEA South': { street: '12424 42nd Ave S', city: 'Tukwila', zip: '98168' },
      'Luther Burbank': { street: '2040 84th Ave SE', city: 'Mercer Island', zip: '98040' },
      'SEA Bellevue': { street: '2040 84th Ave SE', city: 'Mercer Island', zip: '98040' },

      // Misc remaining
      'Portland Parks & Recreation': { street: '1120 SW 5th Ave', city: 'Portland', zip: '97204' },
      '<UNKNOWN>': { street: 'Portland Metro Area', city: 'Portland', zip: '97204' },
    };

    for (const location of locations) {
      // Skip if already has a real address
      if (
        location.address?.street &&
        location.address.street !== 'TBD' &&
        location.address.street !== '' &&
        !location.address.street.includes('TBD')
      ) {
        continue;
      }

      let street = '';
      let city = 'Portland';
      let zip = '';

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
            zip = match[2] || '';
            break;
          }
        }
      }

      // Try to extract city from name
      if (street) {
        const cityMatch = location.name.match(
          /(Portland|Beaverton|Gresham|Lake Oswego|Tigard|Hillsboro|Milwaukie|Oregon City|Sandy|McMinnville)/i,
        );
        if (cityMatch) {
          city = cityMatch[1];
        }

        if (!dryRun) {
          await ctx.db.patch(location._id, {
            address: {
              street,
              city,
              state: 'OR',
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
    const locations = await ctx.db.query('locations').collect();
    const sessions = await ctx.db.query('sessions').collect();
    const sources = await ctx.db.query('scrapeSources').collect();

    // Find locations with TBD addresses that are in use
    const badLocations = locations.filter((loc) => {
      const hasBadAddress =
        !loc.address?.street ||
        loc.address.street === 'TBD' ||
        loc.address.street === '' ||
        loc.address.street.includes('TBD');
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
    const sourceStats = new Map<
      string,
      { name: string; url: string; badLocationCount: number; locationNames: string[] }
    >();

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
    locationId: v.id('locations'),
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

// ============================================
// LOCATION DEDUPLICATION
// ============================================

/**
 * Find duplicate locations (same name, same organization)
 */
export const findDuplicateLocations = mutation({
  args: {
    organizationId: v.optional(v.id('organizations')),
  },
  handler: async (ctx, args) => {
    // Get locations, optionally filtered by organization
    let locations;
    const orgId = args.organizationId;
    if (orgId) {
      locations = await ctx.db
        .query('locations')
        .withIndex('by_organization', (q) => q.eq('organizationId', orgId))
        .collect();
    } else {
      locations = await ctx.db.query('locations').collect();
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
              .query('sessions')
              .withIndex('by_location', (q) => q.eq('locationId', loc._id))
              .collect();
            const addressStr = loc.address
              ? `${loc.address.street}, ${loc.address.city}, ${loc.address.state} ${loc.address.zip}`
              : 'No address';
            return {
              id: loc._id,
              name: loc.name,
              address: addressStr,
              hasCoords: loc.latitude !== undefined && loc.longitude !== undefined,
              sessionCount: sessions.length,
            };
          }),
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
    const locations = await ctx.db.query('locations').take(batchSize);

    // Group by normalized name + organization
    const byKey = new Map<string, typeof locations>();
    for (const location of locations) {
      const normalizedName = location.name.toLowerCase().trim();
      const key = `${location.organizationId ?? 'none'}|${normalizedName}`;
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
          .query('sessions')
          .withIndex('by_location', (q) => q.eq('locationId', deleteLocation._id))
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
      message: deletedCount > 0 ? 'Run again to process more duplicates' : 'No duplicates found in this batch',
    };
  },
});
