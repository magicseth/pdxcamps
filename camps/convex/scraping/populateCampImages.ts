"use node";

/**
 * Populate Camp Images
 *
 * Downloads images from camp imageUrls and stores them in Convex storage.
 */

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { ActionCtx } from "../_generated/server";

/**
 * Helper function to download and store an image
 */
async function downloadAndStoreImage(
  ctx: ActionCtx,
  url: string
): Promise<{ storageId: Id<"_storage"> | null; publicUrl: string | null; error?: string }> {
  try {
    console.log(`[CampImages] Downloading: ${url}`);

    // Fetch the image
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PDXCampsBot/1.0)",
        Accept: "image/*",
      },
    });

    if (!response.ok) {
      return { storageId: null, publicUrl: null, error: `HTTP ${response.status}` };
    }

    // Get content type
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/") && !contentType.includes("svg")) {
      return { storageId: null, publicUrl: null, error: `Not an image: ${contentType}` };
    }

    // Get the image data as blob
    const blob = await response.blob();

    // Upload to Convex storage
    const storageId = await ctx.storage.store(blob);
    const publicUrl = await ctx.storage.getUrl(storageId);

    console.log(`[CampImages] Stored: ${url} -> ${storageId}`);
    return { storageId, publicUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[CampImages] Failed to store ${url}: ${message}`);
    return { storageId: null, publicUrl: null, error: message };
  }
}

/**
 * Populate images for all camps that have imageUrls but no imageStorageIds
 */
export const populateAllCampImages = action({
  args: {
    limit: v.optional(v.number()), // Max camps to process (default 10)
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    campsProcessed: number;
    imagesStored: number;
    errors: string[];
  }> => {
    const limit = args.limit ?? 10;
    const errors: string[] = [];
    let campsProcessed = 0;
    let imagesStored = 0;

    // Get all camps
    const camps = await ctx.runQuery(api.camps.queries.listAllCamps, {});

    // Filter to camps with imageUrls but empty imageStorageIds
    const campsNeedingImages = camps.filter(
      (camp: any) =>
        camp.imageUrls &&
        camp.imageUrls.length > 0 &&
        (!camp.imageStorageIds || camp.imageStorageIds.length === 0)
    );

    console.log(`[CampImages] Found ${campsNeedingImages.length} camps needing images, processing ${limit}`);

    // Process up to limit camps
    for (const camp of campsNeedingImages.slice(0, limit)) {
      console.log(`[CampImages] Processing: ${camp.name}`);
      campsProcessed++;

      const storageIds: Id<"_storage">[] = [];

      // Download and store each image (max 3 per camp)
      for (const url of (camp.imageUrls || []).slice(0, 3)) {
        const result = await downloadAndStoreImage(ctx, url);
        if (result.storageId) {
          storageIds.push(result.storageId);
          imagesStored++;
        } else if (result.error) {
          errors.push(`${camp.name}: ${result.error}`);
        }
      }

      // Update camp with storage IDs
      if (storageIds.length > 0) {
        await ctx.runMutation(api.camps.mutations.updateCampImages, {
          campId: camp._id,
          imageStorageIds: storageIds,
        });
      }
    }

    return {
      success: imagesStored > 0,
      campsProcessed,
      imagesStored,
      errors: errors.slice(0, 20),
    };
  },
});

/**
 * Populate images for a specific organization's camps
 */
export const populateOrgCampImages = action({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    campsProcessed: number;
    imagesStored: number;
    errors: string[];
  }> => {
    const limit = args.limit ?? 20;
    const errors: string[] = [];
    let campsProcessed = 0;
    let imagesStored = 0;

    // Get camps for this organization
    const camps = await ctx.runQuery(api.camps.queries.listCamps, {
      organizationId: args.organizationId,
    });

    // Filter to camps with imageUrls but empty imageStorageIds
    const campsNeedingImages = camps.filter(
      (camp: any) =>
        camp.imageUrls &&
        camp.imageUrls.length > 0 &&
        (!camp.imageStorageIds || camp.imageStorageIds.length === 0)
    );

    console.log(`[CampImages] Found ${campsNeedingImages.length} camps needing images`);

    for (const camp of campsNeedingImages.slice(0, limit)) {
      console.log(`[CampImages] Processing: ${camp.name}`);
      campsProcessed++;

      const storageIds: Id<"_storage">[] = [];

      for (const url of (camp.imageUrls || []).slice(0, 3)) {
        const result = await downloadAndStoreImage(ctx, url);
        if (result.storageId) {
          storageIds.push(result.storageId);
          imagesStored++;
        } else if (result.error) {
          errors.push(`${camp.name}: ${result.error}`);
        }
      }

      if (storageIds.length > 0) {
        await ctx.runMutation(api.camps.mutations.updateCampImages, {
          campId: camp._id,
          imageStorageIds: storageIds,
        });
      }
    }

    return {
      success: imagesStored > 0,
      campsProcessed,
      imagesStored,
      errors: errors.slice(0, 20),
    };
  },
});
