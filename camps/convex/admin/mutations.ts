import { mutation, action } from '../_generated/server';
import { api } from '../_generated/api';
import { v } from 'convex/values';
import { checkIsAdmin } from '../lib/adminAuth';

/**
 * Update a location's address and coordinates
 */
export const updateLocation = mutation({
  args: {
    locationId: v.id('locations'),
    name: v.optional(v.string()),
    street: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zip: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const isAdminUser = await checkIsAdmin(ctx);
    if (!isAdminUser) {
      throw new Error('Not authorized');
    }

    const location = await ctx.db.get(args.locationId);
    if (!location) {
      throw new Error('Location not found');
    }

    // Build update object
    const updates: {
      name?: string;
      address?: typeof location.address;
      latitude?: number;
      longitude?: number;
    } = {};

    if (args.name !== undefined) {
      updates.name = args.name;
    }

    // Update address if any address fields provided
    if (args.street !== undefined || args.city !== undefined || args.state !== undefined || args.zip !== undefined) {
      updates.address = {
        street: args.street ?? location.address.street,
        city: args.city ?? location.address.city,
        state: args.state ?? location.address.state,
        zip: args.zip ?? location.address.zip,
      };
    }

    if (args.latitude !== undefined) {
      updates.latitude = args.latitude;
    }

    if (args.longitude !== undefined) {
      updates.longitude = args.longitude;
    }

    await ctx.db.patch(args.locationId, updates);

    return { success: true };
  },
});

/**
 * Geocode a location by its ID
 * Updates the location with geocoded coordinates
 */
export const geocodeLocation = action({
  args: {
    locationId: v.id('locations'),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    latitude?: number;
    longitude?: number;
    formattedAddress?: string;
    error?: string;
  }> => {
    // Get the location
    const location = await ctx.runQuery(api.admin.queries.getLocationById, {
      locationId: args.locationId,
    });

    if (!location) {
      return { success: false, error: 'Location not found' };
    }

    // Build geocode query from available data
    let query = '';
    if (location.address.street && location.address.street !== 'TBD') {
      query = `${location.address.street}, ${location.address.city}, ${location.address.state} ${location.address.zip}`;
    } else {
      // Fall back to location name
      query = location.name;
    }

    if (!query) {
      return { success: false, error: 'No address data to geocode' };
    }

    // Call geocode action
    const result = await ctx.runAction(api.lib.geocoding.geocodeQuery, {
      query,
      nearCity: 'Portland, OR',
    });

    if (!result) {
      return { success: false, error: 'Geocoding failed - no results found' };
    }

    // Update the location with new coordinates and any address components
    await ctx.runMutation(api.admin.mutations.updateLocation, {
      locationId: args.locationId,
      latitude: result.latitude,
      longitude: result.longitude,
      // Only update address components if we got better data
      street:
        result.street && (!location.address.street || location.address.street === 'TBD') ? result.street : undefined,
      city: result.city && !location.address.city ? result.city : undefined,
      state: result.state && !location.address.state ? result.state : undefined,
      zip: result.zip && !location.address.zip ? result.zip : undefined,
    });

    return {
      success: true,
      latitude: result.latitude,
      longitude: result.longitude,
      formattedAddress: result.formattedAddress,
    };
  },
});

/**
 * Bulk geocode all locations with placeholder data
 */
export const bulkGeocodeLocations = action({
  args: {
    limit: v.optional(v.number()), // Limit to avoid API rate limits
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
  }> => {
    const limit = args.limit ?? 10; // Default to 10 to be safe with API limits

    // Get locations needing fixes
    const data = await ctx.runQuery(api.admin.queries.getLocationsNeedingFixes, {});

    if (!data) {
      return {
        success: false,
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: ['Not authorized or no data'],
      };
    }

    const locationsToProcess = data.locations.slice(0, limit);
    const errors: string[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const location of locationsToProcess) {
      try {
        const result = await ctx.runAction(api.admin.mutations.geocodeLocation, {
          locationId: location._id,
        });

        if (result.success) {
          succeeded++;
        } else {
          failed++;
          errors.push(`${location.name}: ${result.error}`);
        }

        // Small delay to avoid hitting API rate limits
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        failed++;
        errors.push(`${location.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: true,
      processed: locationsToProcess.length,
      succeeded,
      failed,
      errors,
    };
  },
});
