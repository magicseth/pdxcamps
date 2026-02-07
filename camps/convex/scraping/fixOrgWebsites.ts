'use node';

/**
 * Fix organization websites and logos
 */

import { action } from '../_generated/server';
import { internal, api } from '../_generated/api';
import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';
import { ActionCtx } from '../_generated/server';

// Known organization websites
const ORG_WEBSITES: Record<string, string> = {
  "Northwest Children's Theater and School": 'https://www.nwcts.org',
  'Backbeat Music Academy': 'https://backbeatpdx.com',
  'Mittleman Jewish Community Center': 'https://www.oregonjcc.org',
  'Tualatin Hills Park & Recreation District': 'https://www.thprd.org',
  "Steve & Kate's Camp": 'https://www.steveandkate.com',
  'Nike Sports Camps': 'https://www.ussportscamps.com/nike-sports-camps',
  "Oregon Children's Theatre": 'https://www.octc.org',
  'Portland Parks & Recreation': 'https://www.portland.gov/parks',
  'Trackers Earth Portland': 'https://trackerspdx.com',
  'OMSI Science Camps': 'https://omsi.edu',
};

/**
 * Download and store an image from a URL
 */
async function downloadAndStoreImage(
  ctx: ActionCtx,
  url: string,
): Promise<{ storageId: Id<'_storage'> | null; error?: string }> {
  try {
    console.log(`[Logos] Downloading: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PDXCampsBot/1.0)',
        'Accept': 'image/*',
      },
    });

    if (!response.ok) {
      return { storageId: null, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) {
      return { storageId: null, error: `Not an image: ${contentType}` };
    }

    const blob = await response.blob();

    // Skip tiny images (likely broken favicons)
    if (blob.size < 500) {
      return { storageId: null, error: `Image too small: ${blob.size} bytes` };
    }

    const storageId = await ctx.storage.store(blob);

    console.log(`[Logos] Stored: ${storageId} (${blob.size} bytes)`);
    return { storageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { storageId: null, error: message };
  }
}

/**
 * Try to fetch a high-quality logo from a website
 */
async function fetchLogoFromWebsite(ctx: ActionCtx, website: string, orgName: string): Promise<Id<'_storage'> | null> {
  try {
    const url = new URL(website);
    const origin = url.origin;

    // Try various logo sources in order of quality
    const logoUrls = [
      // Clearbit logo API (usually high quality)
      `https://logo.clearbit.com/${url.hostname}`,
      // Higher resolution Google favicon
      `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=256`,
      // Apple touch icon (usually larger)
      `${origin}/apple-touch-icon.png`,
      `${origin}/apple-touch-icon-precomposed.png`,
      // Favicon variations
      `${origin}/favicon-32x32.png`,
      `${origin}/favicon.png`,
      `${origin}/favicon.ico`,
    ];

    for (const logoUrl of logoUrls) {
      const result = await downloadAndStoreImage(ctx, logoUrl);
      if (result.storageId) {
        return result.storageId;
      }
    }

    return null;
  } catch (error) {
    console.log(`[Logos] Failed to fetch logo from ${website}:`, error);
    return null;
  }
}

/**
 * Fix organization websites and re-fetch logos
 */
export const fixOrgWebsitesAndLogos = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    success: boolean;
    updated: number;
    errors: string[];
  }> => {
    const errors: string[] = [];
    let updated = 0;

    // Get all organizations
    const organizations = await ctx.runQuery(api.organizations.queries.listAllOrganizations, {});

    for (const org of organizations) {
      const correctWebsite = ORG_WEBSITES[org.name];

      if (!correctWebsite) {
        continue;
      }

      // Check if website needs updating
      if (org.website === correctWebsite && org.logoStorageId) {
        console.log(`[Fix] ${org.name} already has correct website and logo`);
        continue;
      }

      console.log(`[Fix] Processing ${org.name}...`);

      // Fetch a new logo from the correct website
      const logoStorageId = await fetchLogoFromWebsite(ctx, correctWebsite, org.name);

      if (logoStorageId) {
        // Update the organization with correct website and new logo
        await ctx.runMutation(internal.organizations.mutations.updateOrgWebsiteAndLogo, {
          orgId: org._id,
          website: correctWebsite,
          logoStorageId,
        });
        updated++;
        console.log(`[Fix] Updated ${org.name} with website and logo`);
      } else {
        // Just update the website
        await ctx.runMutation(internal.organizations.mutations.updateOrgWebsite, {
          orgId: org._id,
          website: correctWebsite,
        });
        errors.push(`${org.name}: Could not fetch logo`);
        console.log(`[Fix] Updated ${org.name} website only (no logo found)`);
      }
    }

    return {
      success: updated > 0,
      updated,
      errors,
    };
  },
});
