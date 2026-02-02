"use node";

/**
 * Image Storage Pipeline
 *
 * Downloads images from scraped URLs and stores them in Convex storage.
 * Handles organization logos and camp images.
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
): Promise<{ storageId: Id<"_storage"> | null; error?: string }> {
  try {
    console.log(`[Images] Downloading: ${url}`);

    // Fetch the image
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PDXCampsBot/1.0)",
        Accept: "image/*",
      },
    });

    if (!response.ok) {
      return { storageId: null, error: `HTTP ${response.status}` };
    }

    // Get content type
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/") && !contentType.includes("svg")) {
      return { storageId: null, error: `Not an image: ${contentType}` };
    }

    // Get the image data as blob
    const blob = await response.blob();

    // Upload to Convex storage
    const storageId = await ctx.storage.store(blob);

    console.log(`[Images] Stored: ${url} -> ${storageId}`);
    return { storageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Images] Failed to store ${url}: ${message}`);
    return { storageId: null, error: message };
  }
}

/**
 * Download an image from URL and store it in Convex storage
 */
export const storeImageFromUrl = action({
  args: {
    url: v.string(),
    sourceType: v.union(
      v.literal("organization_logo"),
      v.literal("camp_image")
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ storageId: Id<"_storage"> | null; error?: string }> => {
    return downloadAndStoreImage(ctx, args.url);
  },
});

/**
 * Process images for OMSI - logo only
 */
export const processOmsiImages = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; message: string }> => {
    // OMSI logo
    const logoUrl = "https://omsi.edu/wp-content/uploads/2023/07/OMSI-Logo.svg";

    const result = await downloadAndStoreImage(ctx, logoUrl);

    if (result.storageId) {
      // Find OMSI organization and update
      const sources = await ctx.runQuery(api.scraping.queries.listScrapeSources, {});
      const omsiSource = sources.find((s: { name: string }) =>
        s.name.toLowerCase().includes("omsi")
      );

      if (omsiSource?.organizationId) {
        await ctx.runMutation(api.scraping.mutations.updateOrganizationLogo, {
          organizationId: omsiSource.organizationId,
          logoUrl,
          logoStorageId: result.storageId,
        });
        return { success: true, message: "OMSI logo stored" };
      }
      return { success: true, message: "Logo stored but no organization linked" };
    }

    return {
      success: false,
      message: result.error || "Failed to process OMSI logo",
    };
  },
});

/**
 * Process images for Trackers Earth - logo and theme images
 */
export const processTrackersImages = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    success: boolean;
    logoStored: boolean;
    themeImagesStored: number;
    errors: string[];
  }> => {
    const errors: string[] = [];
    let logoStored = false;
    let themeImagesStored = 0;

    // Trackers logo
    const logoUrl = "https://trackerspdx.com/images/logo-trackers-brand.png";

    const logoResult = await downloadAndStoreImage(ctx, logoUrl);

    if (logoResult.storageId) {
      // Find Trackers organization and update
      const sources = await ctx.runQuery(api.scraping.queries.listScrapeSources, {});
      const trackersSource = sources.find(
        (s: { name: string; url: string }) =>
          s.name.toLowerCase().includes("trackers") &&
          s.url.includes("trackerspdx")
      );

      if (trackersSource?.organizationId) {
        await ctx.runMutation(api.scraping.mutations.updateOrganizationLogo, {
          organizationId: trackersSource.organizationId,
          logoUrl,
          logoStorageId: logoResult.storageId,
        });
        logoStored = true;
      } else {
        logoStored = true; // Still stored, just not linked
      }
    } else if (logoResult.error) {
      errors.push(`Logo: ${logoResult.error}`);
    }

    // Fetch themes API for images
    try {
      const themesResponse = await fetch("https://trackerspdx.com/api/themes", {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; PDXCampsBot/1.0)",
        },
      });

      if (themesResponse.ok) {
        const themesResult = await themesResponse.json();
        const themes = themesResult.data || [];

        // Get unique image URLs
        const imageUrls = new Set<string>();
        for (const theme of themes) {
          if (theme.image) {
            imageUrls.add(theme.image);
          }
        }

        console.log(`[Trackers] Found ${imageUrls.size} unique theme images`);

        // Store up to 30 images (to avoid timeout)
        let count = 0;
        for (const url of imageUrls) {
          if (count >= 30) break;

          const result = await downloadAndStoreImage(ctx, url);

          if (result.storageId) {
            themeImagesStored++;
          } else if (result.error) {
            errors.push(`Theme image: ${result.error}`);
          }
          count++;
        }
      }
    } catch (error) {
      errors.push(
        `Themes API: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }

    return {
      success: logoStored || themeImagesStored > 0,
      logoStored,
      themeImagesStored,
      errors: errors.slice(0, 10), // Limit errors
    };
  },
});

/**
 * Batch store multiple images
 */
export const storeMultipleImages = action({
  args: {
    urls: v.array(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    stored: number;
    failed: number;
    results: Array<{ url: string; storageId: string | null; error?: string }>;
  }> => {
    const results: Array<{
      url: string;
      storageId: string | null;
      error?: string;
    }> = [];
    let stored = 0;
    let failed = 0;

    for (const url of args.urls) {
      const result = await downloadAndStoreImage(ctx, url);
      if (result.storageId) {
        stored++;
        results.push({ url, storageId: result.storageId });
      } else {
        failed++;
        results.push({ url, storageId: null, error: result.error });
      }
    }

    return {
      success: stored > 0,
      stored,
      failed,
      results,
    };
  },
});
