'use node';

/**
 * Image Storage Pipeline
 *
 * Downloads images from scraped URLs and stores them in Convex storage.
 * Handles organization logos and camp images.
 */

import { action } from '../_generated/server';
import { api } from '../_generated/api';
import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';
import { ActionCtx } from '../_generated/server';
import { Stagehand } from '@browserbasehq/stagehand';

/**
 * Helper function to download and store an image
 */
async function downloadAndStoreImage(
  ctx: ActionCtx,
  url: string,
): Promise<{ storageId: Id<'_storage'> | null; error?: string }> {
  try {
    console.log(`[Images] Downloading: ${url}`);

    // Fetch the image
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PDXCampsBot/1.0)',
        'Accept': 'image/*',
      },
    });

    if (!response.ok) {
      return { storageId: null, error: `HTTP ${response.status}` };
    }

    // Get content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/') && !contentType.includes('svg')) {
      return { storageId: null, error: `Not an image: ${contentType}` };
    }

    // Get the image data as blob
    const blob = await response.blob();

    // Upload to Convex storage
    const storageId = await ctx.storage.store(blob);

    console.log(`[Images] Stored: ${url} -> ${storageId}`);
    return { storageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
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
    sourceType: v.union(v.literal('organization_logo'), v.literal('camp_image')),
  },
  handler: async (ctx, args): Promise<{ storageId: Id<'_storage'> | null; error?: string }> => {
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
    const logoUrl = 'https://omsi.edu/wp-content/uploads/2023/07/OMSI-Logo.svg';

    const result = await downloadAndStoreImage(ctx, logoUrl);

    if (result.storageId) {
      // Find OMSI organization and update
      const sources = await ctx.runQuery(api.scraping.queries.listScrapeSources, {});
      const omsiSource = sources.find((s: { name: string }) => s.name.toLowerCase().includes('omsi'));

      if (omsiSource?.organizationId) {
        await ctx.runMutation(api.scraping.mutations.updateOrganizationLogo, {
          organizationId: omsiSource.organizationId,
          logoUrl,
          logoStorageId: result.storageId,
        });
        return { success: true, message: 'OMSI logo stored' };
      }
      return { success: true, message: 'Logo stored but no organization linked' };
    }

    return {
      success: false,
      message: result.error || 'Failed to process OMSI logo',
    };
  },
});

/**
 * Process images for Trackers Earth - logo and theme images
 */
export const processTrackersImages = action({
  args: {},
  handler: async (
    ctx,
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
    const logoUrl = 'https://trackerspdx.com/images/logo-trackers-brand.png';

    const logoResult = await downloadAndStoreImage(ctx, logoUrl);

    if (logoResult.storageId) {
      // Find Trackers organization and update
      const sources = await ctx.runQuery(api.scraping.queries.listScrapeSources, {});
      const trackersSource = sources.find(
        (s: { name: string; url: string }) =>
          s.name.toLowerCase().includes('trackers') && s.url.includes('trackerspdx'),
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
      const themesResponse = await fetch('https://trackerspdx.com/api/themes', {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; PDXCampsBot/1.0)',
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
      errors.push(`Themes API: ${error instanceof Error ? error.message : 'Unknown'}`);
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
 * Store all organization logos in Convex storage
 * Downloads from external URLs and updates orgs to use Convex URLs
 */
export const storeAllLogos = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    success: boolean;
    results: Array<{ name: string; stored: boolean; error?: string }>;
  }> => {
    const results: Array<{ name: string; stored: boolean; error?: string }> = [];

    // Logo URLs for each organization
    const logos: Array<{ name: string; organizationId: string; url: string }> = [
      {
        name: 'OMSI',
        organizationId: 'kh75v4zw4w3v6hc2m8y9jjze5h80dc22',
        url: 'https://omsi.edu/wp-content/uploads/2023/05/OMSI_FullLogo_RGB.png',
      },
      {
        name: 'Trackers Earth',
        organizationId: 'kh7f4thw13306rys338we33kqd80dkrm',
        url: 'https://trackerspdx.com/images/logo-trackers-brand.png',
      },
    ];

    for (const logo of logos) {
      try {
        console.log(`[Logos] Processing ${logo.name}...`);

        // Download and store the image
        const storeResult = await downloadAndStoreImage(ctx, logo.url);

        if (!storeResult.storageId) {
          results.push({ name: logo.name, stored: false, error: storeResult.error });
          continue;
        }

        // Get the Convex storage URL
        const convexUrl = await ctx.storage.getUrl(storeResult.storageId);

        if (!convexUrl) {
          results.push({ name: logo.name, stored: false, error: 'Failed to get storage URL' });
          continue;
        }

        // Update the organization with the Convex URL
        await ctx.runMutation(api.scraping.mutations.updateOrganizationLogo, {
          organizationId: logo.organizationId as Id<'organizations'>,
          logoUrl: convexUrl,
          logoStorageId: storeResult.storageId,
        });

        console.log(`[Logos] ${logo.name} stored: ${convexUrl}`);
        results.push({ name: logo.name, stored: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.push({ name: logo.name, stored: false, error: message });
      }
    }

    return {
      success: results.some((r) => r.stored),
      results,
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
    args,
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

/**
 * Extract real images from Trackers Earth camp pages using Stagehand.
 * Visits each camp's detail page, waits for JS rendering, extracts
 * rendered image URLs, downloads and stores them in Convex.
 */
export const extractTrackersImagesWithBrowser = action({
  args: {
    limit: v.optional(v.number()),
    forceRefresh: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    pagesVisited: number;
    imagesStored: number;
    campsUpdated: number;
    errors: string[];
  }> => {
    const limit = args.limit ?? 10;
    const forceRefresh = args.forceRefresh ?? false;
    const errors: string[] = [];
    let pagesVisited = 0;
    let imagesStored = 0;
    let campsUpdated = 0;

    const TRACKERS_ORG_ID = 'kh7f4thw13306rys338we33kqd80dkrm' as Id<'organizations'>;

    // Get Trackers camps
    const allCamps = await ctx.runQuery(api.camps.queries.listAllCamps, {});
    const trackersCamps = allCamps.filter((c: { organizationId: string; imageStorageIds: string[] }) => {
      if (c.organizationId !== TRACKERS_ORG_ID) return false;
      if (!forceRefresh && c.imageStorageIds && c.imageStorageIds.length > 0) return false;
      return true;
    });

    if (trackersCamps.length === 0) {
      return { success: true, pagesVisited: 0, imagesStored: 0, campsUpdated: 0, errors: ['No camps need images'] };
    }

    // Build map: campId → detail page URL from camp.website field
    const campUrlMap = new Map<string, string>();
    for (const camp of trackersCamps) {
      if (camp.website) {
        campUrlMap.set(camp._id, camp.website);
      }
    }

    // Also check sessions for externalRegistrationUrl
    if (campUrlMap.size < trackersCamps.length) {
      // Find a city ID from one of the camps via sessions
      const firstCamp = trackersCamps[0];
      const campSessions = await ctx.runQuery(api.sessions.queries.listSessionsByCamp, {
        campId: firstCamp._id as Id<'camps'>,
      });
      if (campSessions.length > 0) {
        const cityId = campSessions[0].cityId;
        // Get all sessions for this city to map camp → URL
        const allSessions = await ctx.runQuery(api.sessions.queries.listUpcomingSessions, {
          cityId,
          limit: 500,
        });
        for (const session of allSessions) {
          if (session.externalRegistrationUrl && !campUrlMap.has(session.campId)) {
            campUrlMap.set(session.campId, session.externalRegistrationUrl);
          }
        }
      }
    }

    // Filter to camps that have a detail page URL
    const campsWithUrls = trackersCamps.filter((c: { _id: string }) => campUrlMap.has(c._id));

    // Deduplicate by URL — group camps by their detail page URL
    const urlToCamps = new Map<string, Array<{ _id: string; name: string }>>();
    for (const camp of campsWithUrls) {
      const url = campUrlMap.get(camp._id)!;
      if (!urlToCamps.has(url)) {
        urlToCamps.set(url, []);
      }
      urlToCamps.get(url)!.push({ _id: camp._id, name: camp.name });
    }

    // Take only `limit` unique URLs to visit
    const uniqueUrls = Array.from(urlToCamps.entries()).slice(0, limit);

    console.log(
      `[TrackersImages] Processing ${uniqueUrls.length} unique pages for ${campsWithUrls.length} camps with Stagehand`,
    );

    // Initialize Stagehand
    let stagehand: Stagehand | null = null;
    try {
      stagehand = new Stagehand({
        env: 'BROWSERBASE',
        apiKey: process.env.BROWSERBASE_API_KEY,
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        model: {
          modelName: 'anthropic/claude-sonnet-4-20250514',
          apiKey: process.env.MODEL_API_KEY!,
        },
        disablePino: true,
        verbose: 0,
      });

      await stagehand.init();
      const page = stagehand.context.pages()[0];

      for (const [url, camps] of uniqueUrls) {
        console.log(`[TrackersImages] Visiting: ${url} for ${camps.length} camp(s): ${camps[0].name}`);

        try {
          await page.goto(url, { waitUntil: 'networkidle' as any, timeoutMs: 20000 });
          await page.waitForTimeout(3000); // Wait for JS-rendered images

          // Extract all image URLs from the rendered page
          const imageData = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img'));
            return imgs.map((img) => ({
              src: img.src || img.getAttribute('data-src') || '',
              alt: img.alt || '',
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0,
            }));
          });

          // Also check for background images in hero sections
          const bgImages = await page.evaluate(() => {
            const elements = document.querySelectorAll(
              '[style*="background-image"], .hero, .banner, .camp-image, .theme-image, [class*="hero"], [class*="banner"], [class*="image"]',
            );
            const urls: string[] = [];
            elements.forEach((el) => {
              const style = window.getComputedStyle(el);
              const bg = style.backgroundImage;
              if (bg && bg !== 'none') {
                const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
                if (match) urls.push(match[1]);
              }
            });
            return urls;
          });

          pagesVisited++;

          // Filter to relevant camp images (not logos, icons, gifs, etc.)
          const relevantImages = imageData.filter((img) => {
            if (!img.src || img.src.includes('data:')) return false;
            if (img.src.includes('logo')) return false;
            if (img.src.includes('countdownmail')) return false;
            if (img.src.includes('favicon')) return false;
            if (img.src.endsWith('.gif')) return false;
            if (img.src.endsWith('.svg')) return false;
            // Prefer larger images (likely camp photos)
            if (img.width > 0 && img.width < 100) return false;
            return true;
          });

          // Combine with background images
          const allImageUrls = [
            ...relevantImages.map((img) => img.src),
            ...bgImages.filter((u) => !u.includes('logo') && !u.endsWith('.gif')),
          ];

          // Deduplicate
          const dedupedImageUrls = [...new Set(allImageUrls)];

          console.log(`[TrackersImages] Found ${dedupedImageUrls.length} relevant images for ${camps[0].name}`);

          if (dedupedImageUrls.length === 0) {
            errors.push(`${camps[0].name}: No images found`);
            continue;
          }

          // Download the best image (first large one)
          let stored = false;
          for (const imageUrl of dedupedImageUrls.slice(0, 3)) {
            try {
              const result = await downloadAndStoreImage(ctx, imageUrl);
              if (result.storageId) {
                // Apply to all camps that share this URL
                for (const camp of camps) {
                  await ctx.runMutation(api.camps.mutations.updateCampImages, {
                    campId: camp._id as Id<'camps'>,
                    imageStorageIds: [result.storageId],
                  });
                  campsUpdated++;
                }
                imagesStored++;
                stored = true;
                console.log(`[TrackersImages] Stored image for ${camps.length} camp(s): ${imageUrl}`);
                break;
              }
            } catch (e) {
              console.log(`[TrackersImages] Failed to download ${imageUrl}: ${e}`);
            }
          }

          if (!stored) {
            errors.push(`${camps[0].name}: All image downloads failed`);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`${camps[0].name}: ${msg}`);
          console.log(`[TrackersImages] Error for ${camps[0].name}: ${msg}`);
        }
      }
    } finally {
      if (stagehand) {
        try {
          await stagehand.close();
        } catch {
          // Ignore close errors
        }
      }
    }

    return {
      success: imagesStored > 0,
      pagesVisited,
      imagesStored,
      campsUpdated,
      errors: errors.slice(0, 20),
    };
  },
});
