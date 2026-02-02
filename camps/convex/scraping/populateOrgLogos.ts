"use node";

/**
 * Populate Organization Logos
 *
 * Fetches logos for organizations that don't have them stored.
 * Uses Unsplash for fallback placeholder logos if website scraping fails.
 */

import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { ActionCtx } from "../_generated/server";

/**
 * Download and store an image from a URL
 */
async function downloadAndStoreImage(
  ctx: ActionCtx,
  url: string
): Promise<{ storageId: Id<"_storage"> | null; error?: string }> {
  try {
    console.log(`[Logos] Downloading: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PDXCampsBot/1.0)",
        Accept: "image/*",
      },
    });

    if (!response.ok) {
      return { storageId: null, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) {
      return { storageId: null, error: `Not an image: ${contentType}` };
    }

    const blob = await response.blob();
    const storageId = await ctx.storage.store(blob);

    console.log(`[Logos] Stored: ${storageId}`);
    return { storageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { storageId: null, error: message };
  }
}

/**
 * Try to fetch a favicon or logo from a website
 */
async function fetchLogoFromWebsite(
  ctx: ActionCtx,
  website: string
): Promise<Id<"_storage"> | null> {
  try {
    // Parse the website URL
    const url = new URL(website);
    const origin = url.origin;

    // Try common logo/favicon locations
    const logoUrls = [
      // Clearbit logo API (usually works well)
      `https://logo.clearbit.com/${url.hostname}`,
      // Google favicon service
      `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`,
      // Common favicon paths
      `${origin}/favicon.ico`,
      `${origin}/favicon.png`,
      `${origin}/apple-touch-icon.png`,
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
 * Get a placeholder logo based on organization name
 */
function getPlaceholderLogoUrl(orgName: string): string {
  // Use UI Avatars to generate a placeholder
  const initials = orgName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  // Generate a consistent color from the name
  const colors = [
    "3B82F6", // blue
    "10B981", // green
    "8B5CF6", // purple
    "F59E0B", // amber
    "EF4444", // red
    "06B6D4", // cyan
    "EC4899", // pink
    "84CC16", // lime
  ];

  // Simple hash to pick a color
  const hash = orgName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = colors[hash % colors.length];

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=128&background=${color}&color=ffffff&bold=true`;
}


/**
 * Populate logos for all organizations that don't have them
 */
export const populateOrgLogos = action({
  args: {
    limit: v.optional(v.number()),
    usePlaceholders: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    processed: number;
    stored: number;
    errors: string[];
  }> => {
    const limit = args.limit ?? 50;
    const usePlaceholders = args.usePlaceholders ?? true;
    const errors: string[] = [];
    let processed = 0;
    let stored = 0;

    // Get all active organizations
    const organizations = await ctx.runQuery(api.organizations.queries.listAllOrganizations, {});

    // Filter to orgs without logos
    const orgsWithoutLogos = organizations.filter(
      (org) => !org.logoStorageId
    );

    console.log(`[Logos] Processing ${Math.min(orgsWithoutLogos.length, limit)} of ${orgsWithoutLogos.length} organizations without logos`);

    for (const org of orgsWithoutLogos.slice(0, limit)) {
      processed++;

      let logoStorageId: Id<"_storage"> | null = null;

      // First, try to fetch from the organization's website
      if (org.website) {
        logoStorageId = await fetchLogoFromWebsite(ctx, org.website);
      }

      // If that fails and we're using placeholders, generate one
      if (!logoStorageId && usePlaceholders) {
        const placeholderUrl = getPlaceholderLogoUrl(org.name);
        const result = await downloadAndStoreImage(ctx, placeholderUrl);
        if (result.storageId) {
          logoStorageId = result.storageId;
        } else if (result.error) {
          errors.push(`${org.name}: ${result.error}`);
        }
      }

      // Update the organization with the logo
      if (logoStorageId) {
        await ctx.runMutation(internal.organizations.mutations.updateOrgLogo, {
          orgId: org._id,
          logoStorageId,
        });
        stored++;
        console.log(`[Logos] Updated ${org.name} with logo`);
      }
    }

    return {
      success: stored > 0,
      processed,
      stored,
      errors: errors.slice(0, 20),
    };
  },
});
