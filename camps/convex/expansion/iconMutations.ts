/**
 * Internal mutations for icon generation
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Store generated icon options
 */
export const storeIconOptions = internalMutation({
  args: {
    marketKey: v.string(),
    imageUrls: v.array(v.string()),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("expansionMarkets")
      .withIndex("by_market_key", (q) => q.eq("marketKey", args.marketKey))
      .unique();

    if (!market) {
      throw new Error(`Market not found: ${args.marketKey}`);
    }

    await ctx.db.patch(market._id, {
      iconOptions: args.imageUrls,
      iconPrompt: args.prompt,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Save the selected icon to the market record AND the linked city
 */
export const saveSelectedIcon = internalMutation({
  args: {
    marketKey: v.string(),
    storageId: v.id("_storage"),
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("expansionMarkets")
      .withIndex("by_market_key", (q) => q.eq("marketKey", args.marketKey))
      .unique();

    if (!market) {
      throw new Error(`Market not found: ${args.marketKey}`);
    }

    // Update the expansion market record
    await ctx.db.patch(market._id, {
      selectedIconStorageId: args.storageId,
      selectedIconSourceUrl: args.sourceUrl,
      updatedAt: Date.now(),
    });

    // Also update the linked city if one exists
    if (market.cityId) {
      await ctx.db.patch(market.cityId, {
        iconStorageId: args.storageId,
      });
    }
  },
});
