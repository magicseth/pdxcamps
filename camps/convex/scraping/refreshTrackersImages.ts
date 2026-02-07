'use node';

/**
 * Refresh Trackers Camp Images
 *
 * Fetches fresh image URLs from Trackers API and stores them in Convex.
 */

import { action } from '../_generated/server';
import { api } from '../_generated/api';
import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';
import { ActionCtx } from '../_generated/server';

/**
 * Download and store an image
 */
async function downloadAndStoreImage(
  ctx: ActionCtx,
  url: string,
): Promise<{ storageId: Id<'_storage'> | null; error?: string }> {
  try {
    console.log(`[Images] Downloading: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PDXCampsBot/1.0)',
        'Accept': 'image/*',
      },
    });

    if (!response.ok) {
      return { storageId: null, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return { storageId: null, error: `Not an image: ${contentType}` };
    }

    const blob = await response.blob();
    const storageId = await ctx.storage.store(blob);

    console.log(`[Images] Stored: ${storageId}`);
    return { storageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { storageId: null, error: message };
  }
}

/**
 * Get category-based Unsplash images for camps
 * Using free Unsplash images that are reliable
 */
function getCategoryImages(): Map<string, string> {
  const images = new Map<string, string>();

  // High quality outdoor/camp images from Unsplash
  // These are stable URLs that won't change
  const categoryUrls: Record<string, string> = {
    // Archery/Rangers - bow and arrow
    archery: 'https://images.unsplash.com/photo-1565711561500-49678a10a63f?w=800&h=400&fit=crop',
    rangers: 'https://images.unsplash.com/photo-1565711561500-49678a10a63f?w=800&h=400&fit=crop',
    stealth: 'https://images.unsplash.com/photo-1565711561500-49678a10a63f?w=800&h=400&fit=crop',

    // Wilderness/Survival - camping/forest
    wilderness: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=400&fit=crop',
    survival: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=400&fit=crop',
    outdoor: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=400&fit=crop',
    forest: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&h=400&fit=crop',

    // Fantasy/Role-playing - magical forest
    realms: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&h=400&fit=crop',
    dragons: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&h=400&fit=crop',
    wizards: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&h=400&fit=crop',
    elves: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&h=400&fit=crop',
    faeries: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&h=400&fit=crop',
    magic: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&h=400&fit=crop',

    // Crafts - pottery/woodworking
    pottery: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&h=400&fit=crop',
    ceramics: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&h=400&fit=crop',
    clay: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&h=400&fit=crop',
    woodworking: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&h=400&fit=crop',
    carving: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&h=400&fit=crop',
    crafts: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&h=400&fit=crop',

    // Blacksmithing - forge/fire
    blacksmith: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&h=400&fit=crop',
    forge: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&h=400&fit=crop',
    anvil: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&h=400&fit=crop',

    // Water activities - kayak/canoe
    canoe: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=400&fit=crop',
    kayak: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=400&fit=crop',
    paddle: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=400&fit=crop',
    fishing: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=400&fit=crop',
    mariners: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=400&fit=crop',

    // Farm/Animals
    ranch: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800&h=400&fit=crop',
    wilders: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800&h=400&fit=crop',
    animals: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800&h=400&fit=crop',
    farm: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800&h=400&fit=crop',

    // Adventure/Hiking
    adventure: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&h=400&fit=crop',
    hike: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&h=400&fit=crop',
    climb: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&h=400&fit=crop',
    expedition: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&h=400&fit=crop',

    // Bike
    bike: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop',
    ride: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop',

    // Ninja/Martial arts
    ninja: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=800&h=400&fit=crop',
    martial: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=800&h=400&fit=crop',

    // Spy/Secret agent
    spy: 'https://images.unsplash.com/photo-1509822929063-6b6cfc9b42f2?w=800&h=400&fit=crop',
    agent: 'https://images.unsplash.com/photo-1509822929063-6b6cfc9b42f2?w=800&h=400&fit=crop',

    // Default camp image
    default: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&h=400&fit=crop',
  };

  for (const [key, url] of Object.entries(categoryUrls)) {
    images.set(key, url);
  }

  return images;
}

/**
 * Match a camp name to a category image
 */
function findMatchingImage(campName: string, categoryImages: Map<string, string>): string | null {
  const campLower = campName.toLowerCase();

  // Try to match keywords in camp name to category images
  for (const [keyword, imageUrl] of categoryImages) {
    if (keyword !== 'default' && campLower.includes(keyword)) {
      return imageUrl;
    }
  }

  // Return default camp image
  return categoryImages.get('default') || null;
}

/**
 * Refresh all Trackers camp images
 */
export const refreshTrackersImages = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    campsUpdated: number;
    imagesStored: number;
    errors: string[];
  }> => {
    const limit = args.limit ?? 50;
    const errors: string[] = [];
    let campsUpdated = 0;
    let imagesStored = 0;

    // Get category-based images
    const categoryImages = getCategoryImages();

    console.log(`[Trackers] Using ${categoryImages.size} category images`);

    // Get Trackers organization ID
    const trackersOrgId = 'kh7f4thw13306rys338we33kqd80dkrm' as Id<'organizations'>;

    // Get all Trackers camps
    const camps = await ctx.runQuery(api.camps.queries.listCamps, {
      organizationId: trackersOrgId,
    });

    console.log(`[Trackers] Processing ${Math.min(camps.length, limit)} of ${camps.length} camps`);

    // Process each camp
    for (const camp of camps.slice(0, limit)) {
      // Skip if already has images
      if (camp.imageStorageIds && camp.imageStorageIds.length > 0) {
        continue;
      }

      // Find matching image
      const imageUrl = findMatchingImage(camp.name, categoryImages);

      if (!imageUrl) {
        console.log(`[Trackers] No image match for: ${camp.name}`);
        continue;
      }

      console.log(`[Trackers] Matched ${camp.name} -> ${imageUrl.substring(0, 60)}...`);

      // Download and store image
      const result = await downloadAndStoreImage(ctx, imageUrl);

      if (result.storageId) {
        // Update camp with new image
        await ctx.runMutation(api.camps.mutations.updateCampImages, {
          campId: camp._id,
          imageStorageIds: [result.storageId],
        });
        campsUpdated++;
        imagesStored++;
      } else if (result.error) {
        errors.push(`${camp.name}: ${result.error}`);
      }
    }

    return {
      success: campsUpdated > 0,
      campsUpdated,
      imagesStored,
      errors: errors.slice(0, 20),
    };
  },
});

/**
 * Fetch and store a generic set of camp images for OMSI
 */
export const populateOmsiImages = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    success: boolean;
    campsUpdated: number;
    imagesStored: number;
    errors: string[];
  }> => {
    const errors: string[] = [];
    let campsUpdated = 0;
    let imagesStored = 0;

    // Use science/STEM themed Unsplash images
    const omsiImages = [
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=400&fit=crop', // Science lab
      'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&h=400&fit=crop', // Science experiment
    ];

    // Try to fetch an OMSI image
    let omsiImageStorageId: Id<'_storage'> | null = null;

    for (const url of omsiImages) {
      const result = await downloadAndStoreImage(ctx, url);
      if (result.storageId) {
        omsiImageStorageId = result.storageId;
        imagesStored++;
        break;
      }
    }

    if (!omsiImageStorageId) {
      return {
        success: false,
        campsUpdated: 0,
        imagesStored: 0,
        errors: ['Could not fetch any OMSI images'],
      };
    }

    // Get OMSI organization ID
    const omsiOrgId = 'kh75v4zw4w3v6hc2m8y9jjze5h80dc22' as Id<'organizations'>;

    // Get all OMSI camps
    const camps = await ctx.runQuery(api.camps.queries.listCamps, {
      organizationId: omsiOrgId,
    });

    console.log(`[OMSI] Applying image to ${camps.length} camps`);

    // Apply the same image to all OMSI camps that don't have one
    for (const camp of camps) {
      if (camp.imageStorageIds && camp.imageStorageIds.length > 0) {
        continue;
      }

      try {
        await ctx.runMutation(api.camps.mutations.updateCampImages, {
          campId: camp._id,
          imageStorageIds: [omsiImageStorageId],
        });
        campsUpdated++;
      } catch (error) {
        errors.push(`${camp.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: campsUpdated > 0,
      campsUpdated,
      imagesStored,
      errors: errors.slice(0, 20),
    };
  },
});
