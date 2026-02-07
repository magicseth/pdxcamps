'use node';

/**
 * City asset management actions
 */

import { action } from '../_generated/server';
import { api } from '../_generated/api';
import { v } from 'convex/values';

/**
 * Upload an icon from URL and set it for a city
 */
export const uploadCityIconFromUrl = action({
  args: {
    cityId: v.id('cities'),
    imageUrl: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    storageId?: string;
    error?: string;
  }> => {
    try {
      // Download the image
      const response = await fetch(args.imageUrl);
      if (!response.ok) {
        return { success: false, error: `Failed to download image: ${response.status}` };
      }

      const blob = await response.blob();

      // Store in Convex storage
      const storageId = await ctx.storage.store(blob);

      // Update city record
      await ctx.runMutation(api.cities.mutations.setCityIcon, {
        cityId: args.cityId,
        iconStorageId: storageId,
      });

      return { success: true, storageId: storageId as string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Upload a header image from URL and set it for a city
 */
export const uploadCityHeaderFromUrl = action({
  args: {
    cityId: v.id('cities'),
    imageUrl: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    storageId?: string;
    error?: string;
  }> => {
    try {
      // Download the image
      const response = await fetch(args.imageUrl);
      if (!response.ok) {
        return { success: false, error: `Failed to download image: ${response.status}` };
      }

      const blob = await response.blob();

      // Store in Convex storage
      const storageId = await ctx.storage.store(blob);

      // Update city record
      await ctx.runMutation(api.cities.mutations.setCityHeaderImage, {
        cityId: args.cityId,
        headerImageStorageId: storageId,
      });

      return { success: true, storageId: storageId as string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Copy icon from expansion market to city
 * (For cities created via expansion workflow that have icons generated)
 */
export const copyIconFromExpansionMarket = action({
  args: {
    marketKey: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    // Get expansion market list which includes icon fields
    const markets = await ctx.runQuery(api.expansion.queries.listExpansionMarkets, {});

    const market = markets.find((m) => m.key === args.marketKey);

    if (!market) {
      return { success: false, error: 'Expansion market not found' };
    }

    if (!market.cityId) {
      return { success: false, error: 'Market has no linked city' };
    }

    if (!market.selectedIconStorageId) {
      return { success: false, error: 'Market has no icon selected' };
    }

    // Copy the storage ID to the city
    await ctx.runMutation(api.cities.mutations.setCityIcon, {
      cityId: market.cityId,
      iconStorageId: market.selectedIconStorageId,
    });

    return { success: true };
  },
});
