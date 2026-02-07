import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { addressValidator } from '../lib/validators';

/**
 * Create a new location
 */
export const createLocation = mutation({
  args: {
    organizationId: v.optional(v.id('organizations')),
    name: v.string(),
    address: addressValidator,
    cityId: v.id('cities'),
    neighborhoodId: v.optional(v.id('neighborhoods')),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify city exists
    const city = await ctx.db.get(args.cityId);
    if (!city) {
      throw new Error('City not found');
    }

    // Verify neighborhood exists if provided
    if (args.neighborhoodId) {
      const neighborhood = await ctx.db.get(args.neighborhoodId);
      if (!neighborhood) {
        throw new Error('Neighborhood not found');
      }
      if (neighborhood.cityId !== args.cityId) {
        throw new Error('Neighborhood does not belong to the specified city');
      }
    }

    // Verify organization exists if provided
    if (args.organizationId) {
      const organization = await ctx.db.get(args.organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }
    }

    const locationId = await ctx.db.insert('locations', {
      organizationId: args.organizationId,
      name: args.name,
      address: args.address,
      cityId: args.cityId,
      neighborhoodId: args.neighborhoodId,
      latitude: args.latitude,
      longitude: args.longitude,
      parkingNotes: undefined,
      accessibilityNotes: undefined,
      isActive: true,
    });

    return locationId;
  },
});

/**
 * Update an existing location
 */
export const updateLocation = mutation({
  args: {
    locationId: v.id('locations'),
    name: v.optional(v.string()),
    address: v.optional(addressValidator),
    neighborhoodId: v.optional(v.id('neighborhoods')),
    parkingNotes: v.optional(v.string()),
    accessibilityNotes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { locationId, ...updates } = args;

    const location = await ctx.db.get(locationId);
    if (!location) {
      throw new Error('Location not found');
    }

    // Verify neighborhood exists and belongs to the location's city if provided
    if (updates.neighborhoodId) {
      const neighborhood = await ctx.db.get(updates.neighborhoodId);
      if (!neighborhood) {
        throw new Error('Neighborhood not found');
      }
      if (neighborhood.cityId !== location.cityId) {
        throw new Error("Neighborhood does not belong to the location's city");
      }
    }

    // Build update object with only defined fields
    const updateFields: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      updateFields.name = updates.name;
    }
    if (updates.address !== undefined) {
      updateFields.address = updates.address;
    }
    if (updates.neighborhoodId !== undefined) {
      updateFields.neighborhoodId = updates.neighborhoodId;
    }
    if (updates.parkingNotes !== undefined) {
      updateFields.parkingNotes = updates.parkingNotes;
    }
    if (updates.accessibilityNotes !== undefined) {
      updateFields.accessibilityNotes = updates.accessibilityNotes;
    }
    if (updates.isActive !== undefined) {
      updateFields.isActive = updates.isActive;
    }

    await ctx.db.patch(locationId, updateFields);

    return locationId;
  },
});
