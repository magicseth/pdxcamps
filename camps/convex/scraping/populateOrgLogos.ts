"use node";

/**
 * Populate Organization Logos
 *
 * Fetches logos for organizations that don't have them stored.
 * Uses AI-powered extraction via Stagehand, then falls back to
 * Clearbit/Google favicon APIs, then UI Avatars for placeholders.
 */

import { action, internalAction } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { ActionCtx } from "../_generated/server";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

/**
 * Check if a URL is valid
 */
function isValidUrl(urlString: string): boolean {
  if (!urlString || urlString.includes("<UNKNOWN>") || urlString === "UNKNOWN") {
    return false;
  }
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

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
 * Use AI (Stagehand) to find and extract the main logo from a website
 */
async function fetchLogoWithAI(
  ctx: ActionCtx,
  website: string,
  orgName: string
): Promise<Id<"_storage"> | null> {
  // Validate URL before attempting
  if (!isValidUrl(website)) {
    console.log(`[Logos] Skipping AI extraction for ${orgName}: invalid URL "${website}"`);
    return null;
  }

  let stagehand: Stagehand | null = null;

  try {
    console.log(`[Logos] AI extraction for ${orgName}: ${website}`);

    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      disablePino: true, // Avoid pino-pretty transport errors in Convex runtime
      verbose: 0, // Minimal logging
      model: {
        modelName: "anthropic/claude-sonnet-4-20250514",
        apiKey: process.env.ANTHROPIC_API_KEY!,
      },
    });

    await stagehand.init();
    const page = stagehand.context.pages()[0];

    // Navigate to the website
    await page.goto(website, { waitUntil: "domcontentloaded", timeoutMs: 30000 });
    await page.waitForTimeout(2000);

    // Use AI to find the main logo by extracting structured data
    const instruction = `Find the main logo or brand image for this organization (${orgName}).
      Look for:
      1. A logo in the header/navigation area
      2. An image with "logo" in its class, id, alt text, or src
      3. The primary brand image that represents this organization

      Return the absolute URL of the logo image. Prefer PNG or SVG over ICO.
      If multiple logos exist, choose the highest quality/largest one.`;

    const schema = z.object({
      logoUrl: z.string().optional().describe("The absolute URL of the logo image"),
      confidence: z.enum(["high", "medium", "low"]).describe("How confident you are this is the main logo"),
    });

    const logoData = await stagehand.extract(instruction, schema);

    await stagehand.close();
    stagehand = null;

    if (logoData?.logoUrl && logoData.confidence !== "low") {
      console.log(`[Logos] AI found logo for ${orgName}: ${logoData.logoUrl} (${logoData.confidence} confidence)`);

      // Make URL absolute if needed
      let logoUrl = logoData.logoUrl;
      if (logoUrl.startsWith("/")) {
        const url = new URL(website);
        logoUrl = `${url.origin}${logoUrl}`;
      }

      const result = await downloadAndStoreImage(ctx, logoUrl);
      if (result.storageId) {
        return result.storageId;
      }
    }

    return null;
  } catch (error) {
    console.log(`[Logos] AI extraction failed for ${orgName}:`, error);
    return null;
  } finally {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch {}
    }
  }
}

/**
 * Try to extract favicon URL from website HTML
 */
async function extractFaviconFromHtml(website: string): Promise<string | null> {
  try {
    const response = await fetch(website, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PDXCampsBot/1.0)",
        Accept: "text/html",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const url = new URL(website);

    // Look for link tags with rel containing "icon"
    // Patterns: <link rel="icon" href="..."> or <link rel="shortcut icon" href="...">
    // or <link rel="apple-touch-icon" href="...">
    const iconPatterns = [
      /<link[^>]*rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["'][^>]*href=["']([^"']+)["']/i,
      /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["']/i,
      /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i,
      /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i,
    ];

    for (const pattern of iconPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let faviconUrl = match[1];
        // Make absolute URL
        if (faviconUrl.startsWith("//")) {
          faviconUrl = `https:${faviconUrl}`;
        } else if (faviconUrl.startsWith("/")) {
          faviconUrl = `${url.origin}${faviconUrl}`;
        } else if (!faviconUrl.startsWith("http")) {
          faviconUrl = `${url.origin}/${faviconUrl}`;
        }
        console.log(`[Logos] Found favicon in HTML: ${faviconUrl}`);
        return faviconUrl;
      }
    }

    return null;
  } catch (error) {
    console.log(`[Logos] Failed to extract favicon from HTML:`, error);
    return null;
  }
}

/**
 * Try to fetch a favicon or logo from a website using traditional methods
 */
async function fetchLogoFromWebsite(
  ctx: ActionCtx,
  website: string
): Promise<Id<"_storage"> | null> {
  // Validate URL before attempting
  if (!isValidUrl(website)) {
    console.log(`[Logos] Skipping traditional fetch: invalid URL "${website}"`);
    return null;
  }

  try {
    // Parse the website URL
    const url = new URL(website);
    const origin = url.origin;

    // First try to extract favicon from the actual HTML (most reliable)
    const htmlFavicon = await extractFaviconFromHtml(website);
    if (htmlFavicon) {
      const result = await downloadAndStoreImage(ctx, htmlFavicon);
      if (result.storageId) {
        return result.storageId;
      }
    }

    // Try various favicon/logo APIs and common paths
    const logoUrls = [
      // Clearbit logo API (high-quality company logos)
      `https://logo.clearbit.com/${url.hostname}`,
      // Icon Horse - good favicon aggregator
      `https://icon.horse/icon/${url.hostname}`,
      // DuckDuckGo favicon service
      `https://icons.duckduckgo.com/ip3/${url.hostname}.ico`,
      // Google favicon service (larger size)
      `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=256`,
      // Common high-quality icon paths
      `${origin}/apple-touch-icon.png`,
      `${origin}/apple-touch-icon-180x180.png`,
      `${origin}/apple-touch-icon-152x152.png`,
      `${origin}/favicon-196x196.png`,
      `${origin}/favicon-128.png`,
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
      (org: Doc<"organizations">) => !org.logoStorageId
    );

    console.log(`[Logos] Processing ${Math.min(orgsWithoutLogos.length, limit)} of ${orgsWithoutLogos.length} organizations without logos`);

    for (const org of orgsWithoutLogos.slice(0, limit)) {
      processed++;

      let logoStorageId: Id<"_storage"> | null = null;

      if (org.website) {
        // First, try AI-powered logo extraction (most accurate)
        logoStorageId = await fetchLogoWithAI(ctx, org.website, org.name);

        // If AI fails, fall back to traditional methods
        if (!logoStorageId) {
          logoStorageId = await fetchLogoFromWebsite(ctx, org.website);
        }
      }

      // If all else fails and we're using placeholders, generate one
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

/**
 * Fetch logo for a specific organization if missing
 * Called by the scraping workflow after importing sessions
 */
export const fetchOrgLogoForSource = internalAction({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    // Get the source to find its organization
    const source = await ctx.runQuery(api.scraping.queries.getScrapeSource, {
      sourceId: args.sourceId,
    });

    if (!source || !source.organizationId) {
      return { success: false, message: "Source or organization not found" };
    }

    // Get the organization
    const org = await ctx.runQuery(api.organizations.queries.getOrganization, {
      organizationId: source.organizationId,
    });

    if (!org) {
      return { success: false, message: "Organization not found" };
    }

    // Skip if already has a logo
    if (org.logoStorageId) {
      return { success: true, message: "Logo already exists" };
    }

    console.log(`[Logos] Fetching logo for ${org.name}`);

    let logoStorageId: Id<"_storage"> | null = null;

    if (org.website) {
      // First try AI-powered extraction (most accurate)
      logoStorageId = await fetchLogoWithAI(ctx, org.website, org.name);

      // Fall back to traditional methods
      if (!logoStorageId) {
        logoStorageId = await fetchLogoFromWebsite(ctx, org.website);
      }
    }

    // If all else fails, generate a placeholder
    if (!logoStorageId) {
      const placeholderUrl = getPlaceholderLogoUrl(org.name);
      const result = await downloadAndStoreImage(ctx, placeholderUrl);
      logoStorageId = result.storageId;
    }

    // Update the organization with the logo
    if (logoStorageId) {
      await ctx.runMutation(internal.organizations.mutations.updateOrgLogo, {
        orgId: org._id,
        logoStorageId,
      });
      console.log(`[Logos] Updated ${org.name} with logo`);
      return { success: true, message: `Logo added for ${org.name}` };
    }

    return { success: false, message: `Failed to fetch logo for ${org.name}` };
  },
});

/**
 * Reset and re-fetch all organization logos
 * Fixes website URLs, clears existing logos, then fetches fresh ones
 */
export const resetAndRefetchAllLogos = action({
  args: {
    usePlaceholders: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    processed: number;
    updated: number;
    websitesFixed: number;
    errors: string[];
  }> => {
    const usePlaceholders = args.usePlaceholders ?? false;
    const errors: string[] = [];
    let processed = 0;
    let updated = 0;
    let websitesFixed = 0;

    // Get all organizations
    const organizations = await ctx.runQuery(api.organizations.queries.listAllOrganizations, {});

    console.log(`[Logos] Resetting and re-fetching logos for ${organizations.length} organizations`);

    // Clear all existing logos first
    await ctx.runMutation(internal.organizations.mutations.clearAllOrgLogos, {});
    console.log(`[Logos] Cleared all existing logos`);

    for (const org of organizations) {
      processed++;

      // Fix website URL if needed
      let website = org.website;
      if (website && website !== "<UNKNOWN>" && !website.startsWith("http")) {
        website = `https://${website}`;
        await ctx.runMutation(internal.organizations.mutations.fixOrgWebsite, {
          orgId: org._id,
          website,
        });
        websitesFixed++;
        console.log(`[Logos] Fixed website for ${org.name}: ${website}`);
      }

      // Skip if no valid website
      if (!website || !isValidUrl(website)) {
        if (usePlaceholders) {
          const placeholderUrl = getPlaceholderLogoUrl(org.name);
          const result = await downloadAndStoreImage(ctx, placeholderUrl);
          if (result.storageId) {
            await ctx.runMutation(internal.organizations.mutations.updateOrgLogo, {
              orgId: org._id,
              logoStorageId: result.storageId,
            });
            updated++;
            console.log(`[Logos] ✓ Added placeholder for ${org.name}`);
          }
        }
        continue;
      }

      console.log(`[Logos] Fetching logo for ${org.name} from ${website}`);

      // Try to fetch a real logo
      const logoStorageId = await fetchLogoFromWebsite(ctx, website);

      if (logoStorageId) {
        await ctx.runMutation(internal.organizations.mutations.updateOrgLogo, {
          orgId: org._id,
          logoStorageId,
        });
        updated++;
        console.log(`[Logos] ✓ Updated ${org.name} with real logo`);
      } else if (usePlaceholders) {
        // Fall back to placeholder
        const placeholderUrl = getPlaceholderLogoUrl(org.name);
        const result = await downloadAndStoreImage(ctx, placeholderUrl);
        if (result.storageId) {
          await ctx.runMutation(internal.organizations.mutations.updateOrgLogo, {
            orgId: org._id,
            logoStorageId: result.storageId,
          });
          updated++;
          console.log(`[Logos] ✓ Added placeholder for ${org.name}`);
        }
      } else {
        console.log(`[Logos] ✗ No logo found for ${org.name}`);
      }
    }

    return {
      success: updated > 0,
      processed,
      updated,
      websitesFixed,
      errors: errors.slice(0, 20),
    };
  },
});

/**
 * Refresh logos for all organizations - tries to get real logos, skipping placeholders
 * Use this to replace placeholder logos with real ones
 */
export const refreshOrgLogos = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    processed: number;
    updated: number;
    skipped: number;
    errors: string[];
  }> => {
    const limit = args.limit ?? 100;
    const errors: string[] = [];
    let processed = 0;
    let updated = 0;
    let skipped = 0;

    // Get all organizations with websites
    const organizations = await ctx.runQuery(api.organizations.queries.listAllOrganizations, {});
    const orgsWithWebsites = organizations.filter((org: Doc<"organizations">) => org.website && isValidUrl(org.website));

    console.log(`[Logos] Refreshing logos for ${Math.min(orgsWithWebsites.length, limit)} organizations`);

    for (const org of orgsWithWebsites.slice(0, limit)) {
      processed++;

      if (!org.website) {
        skipped++;
        continue;
      }

      console.log(`[Logos] Trying to fetch real logo for ${org.name} from ${org.website}`);

      // Try to fetch a real logo (no AI, just traditional methods which are more reliable)
      const logoStorageId = await fetchLogoFromWebsite(ctx, org.website);

      if (logoStorageId) {
        // Update with real logo
        await ctx.runMutation(internal.organizations.mutations.updateOrgLogo, {
          orgId: org._id,
          logoStorageId,
        });
        updated++;
        console.log(`[Logos] ✓ Updated ${org.name} with real logo`);
      } else {
        skipped++;
        console.log(`[Logos] ✗ No real logo found for ${org.name}`);
      }
    }

    return {
      success: updated > 0,
      processed,
      updated,
      skipped,
      errors: errors.slice(0, 20),
    };
  },
});
