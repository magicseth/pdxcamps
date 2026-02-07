"use node";

/**
 * Market Seeding
 *
 * Seed a new market (city) with a list of camp organization URLs.
 * Creates organizations, scrape sources, and queues scraper development.
 */

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Extract organization name from URL
 * e.g., "https://www.omsi.edu/camps" -> "OMSI"
 * e.g., "https://oregonzoo.org/education/camps" -> "Oregon Zoo"
 */
function extractOrgNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let domain = parsed.hostname;

    // Remove www prefix
    domain = domain.replace(/^www\./, "");

    // Remove common TLDs and suffixes
    domain = domain.replace(/\.(com|org|edu|net|gov|co|io)$/, "");

    // Handle subdomains (e.g., secure.omsi.edu -> omsi)
    const parts = domain.split(".");
    if (parts.length > 1) {
      // Take the main domain part, not subdomains
      domain = parts[parts.length - 1] || parts[0];
    }

    // Convert to title case and handle common patterns
    let name = domain
      // Split on common separators
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    // Handle all-caps acronyms
    if (domain.toUpperCase() === domain && domain.length <= 5) {
      name = domain.toUpperCase();
    }

    return name || "Unknown Organization";
  } catch {
    return "Unknown Organization";
  }
}

/**
 * Seed a new market with camp URLs
 *
 * For each URL:
 * 1. Creates an organization (or finds existing by URL domain)
 * 2. Creates a scrape source
 * 3. Queues a scraper development request
 */
export const seedMarket = action({
  args: {
    citySlug: v.string(),
    camps: v.array(
      v.object({
        url: v.string(),
        name: v.optional(v.string()), // Optional override for org name
        notes: v.optional(v.string()), // Notes for scraper development
      })
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    cityId: string | null;
    results: Array<{
      url: string;
      name: string;
      organizationId: string | null;
      sourceId: string | null;
      developmentRequestId: string | null;
      status: "created" | "exists" | "error";
      error?: string;
    }>;
    summary: {
      total: number;
      created: number;
      existing: number;
      errors: number;
    };
  }> => {
    // Get the city
    const city = await ctx.runQuery(api.cities.queries.getCityBySlug, {
      slug: args.citySlug,
    });

    if (!city) {
      return {
        success: false,
        cityId: null,
        results: [],
        summary: { total: 0, created: 0, existing: 0, errors: 0 },
      };
    }

    const results: Array<{
      url: string;
      name: string;
      organizationId: string | null;
      sourceId: string | null;
      developmentRequestId: string | null;
      status: "created" | "exists" | "error";
      error?: string;
    }> = [];

    let created = 0;
    let existing = 0;
    let errors = 0;

    for (const camp of args.camps) {
      const name = camp.name || extractOrgNameFromUrl(camp.url);

      try {
        // Check if organization already exists (by URL domain)
        const domain = new URL(camp.url).hostname.replace(/^www\./, "");
        const existingOrgs = await ctx.runQuery(
          api.organizations.queries.listOrganizations,
          { cityId: city._id }
        );

        let organizationId: Id<"organizations"> | null = null;
        let orgExists = false;

        // Check for existing org by website domain
        for (const org of existingOrgs || []) {
          if (org.website) {
            try {
              const orgDomain = new URL(org.website).hostname.replace(
                /^www\./,
                ""
              );
              if (orgDomain === domain) {
                organizationId = org._id;
                orgExists = true;
                break;
              }
            } catch {
              // Invalid URL, skip
            }
          }
        }

        // Create organization if it doesn't exist
        if (!organizationId) {
          organizationId = await ctx.runMutation(
            api.organizations.mutations.createOrganization,
            {
              name,
              website: camp.url,
              cityIds: [city._id],
            }
          );
        }

        // Check if scrape source already exists for this URL
        const existingSources = await ctx.runQuery(
          api.scraping.queries.listScrapeSources,
          {}
        );
        let sourceId: Id<"scrapeSources"> | null = null;
        let sourceExists = false;

        for (const source of existingSources || []) {
          if (source.url === camp.url) {
            sourceId = source._id;
            sourceExists = true;
            break;
          }
        }

        // Create scrape source if it doesn't exist
        if (!sourceId) {
          sourceId = await ctx.runMutation(
            api.scraping.sources.createScrapeSourceSimple,
            {
              name,
              url: camp.url,
              organizationId: organizationId!,
            }
          );
        }

        // Queue scraper development request (always queue even if source exists)
        let developmentRequestId: string | null = null;
        if (!sourceExists) {
          try {
            developmentRequestId = await ctx.runMutation(
              api.scraping.development.requestScraperDevelopment,
              {
                sourceName: name,
                sourceUrl: camp.url,
                cityId: city._id,
                sourceId: sourceId!,
                notes: camp.notes,
                requestedBy: "market-seeding",
              }
            );
          } catch (e) {
            // Request might already exist, that's ok
            console.log(`Dev request may already exist for ${camp.url}`);
          }
        }

        if (orgExists && sourceExists) {
          existing++;
          results.push({
            url: camp.url,
            name,
            organizationId,
            sourceId,
            developmentRequestId,
            status: "exists",
          });
        } else {
          created++;
          results.push({
            url: camp.url,
            name,
            organizationId,
            sourceId,
            developmentRequestId,
            status: "created",
          });
        }
      } catch (error) {
        errors++;
        results.push({
          url: camp.url,
          name,
          organizationId: null,
          sourceId: null,
          developmentRequestId: null,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      success: errors === 0,
      cityId: city._id,
      results,
      summary: {
        total: args.camps.length,
        created,
        existing,
        errors,
      },
    };
  },
});

/**
 * Get seeding status for a city
 * Shows how many orgs, sources, and pending scrapers
 */
export const getMarketStatus = action({
  args: {
    citySlug: v.string(),
  },
  handler: async (ctx, args): Promise<{
    city: { id: string; name: string; slug: string };
    organizations: number;
    scrapeSources: number;
    scraperDevelopment: {
      total: number;
      pending: number;
      in_progress: number;
      testing: number;
      needs_feedback: number;
      completed: number;
      failed: number;
    };
  } | null> => {
    const city = await ctx.runQuery(api.cities.queries.getCityBySlug, {
      slug: args.citySlug,
    });

    if (!city) {
      return null;
    }

    // Get organizations in this city
    const orgs = await ctx.runQuery(api.organizations.queries.listOrganizations, {
      cityId: city._id,
    });
    const orgList = orgs || [];

    // Get all scrape sources
    const sources = await ctx.runQuery(api.scraping.queries.listScrapeSources, {});
    const sourceList = sources || [];

    // Filter sources to this city's orgs
    const orgIds = new Set(orgList.map((o: { _id: string }) => o._id));
    const citySources = sourceList.filter(
      (s: { organizationId?: string }) => s.organizationId && orgIds.has(s.organizationId)
    );

    // Get development requests
    const devRequests = await ctx.runQuery(
      api.scraping.development.listRequests,
      { limit: 100 }
    );
    const devRequestList = devRequests || [];

    // Filter to this city's sources
    const sourceIds = new Set(citySources.map((s: { _id: string }) => s._id));
    const cityDevRequests = devRequestList.filter(
      (r: { sourceId?: string }) => r.sourceId && sourceIds.has(r.sourceId)
    );

    // Count by status
    const statusCounts = {
      pending: 0,
      in_progress: 0,
      testing: 0,
      needs_feedback: 0,
      completed: 0,
      failed: 0,
    };

    for (const req of cityDevRequests) {
      const status = (req as { status: string }).status as keyof typeof statusCounts;
      if (status in statusCounts) {
        statusCounts[status]++;
      }
    }

    return {
      city: {
        id: city._id,
        name: city.name,
        slug: city.slug,
      },
      organizations: orgList.length,
      scrapeSources: citySources.length,
      scraperDevelopment: {
        total: cityDevRequests.length,
        ...statusCounts,
      },
    };
  },
});

/**
 * Scrape a directory page to extract camp URLs
 *
 * This action visits a directory/listing page and extracts links that
 * appear to be camp organization pages. Can then feed results into seedMarket.
 */
export const scrapeDirectoryForCampUrls = action({
  args: {
    directoryUrl: v.string(),
    linkPattern: v.optional(v.string()), // Regex pattern to filter links
    baseUrlFilter: v.optional(v.string()), // Only include links from this domain
  },
  handler: async (
    _ctx,
    args
  ): Promise<{
    success: boolean;
    directoryUrl: string;
    links: Array<{
      url: string;
      text: string;
      domain: string;
    }>;
    error?: string;
  }> => {
    try {
      // Fetch the directory page with more browser-like headers
      const response = await fetch(args.directoryUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"macOS"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        },
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error: ${response.status} ${response.statusText}`
        );
      }

      const html = await response.text();

      // Extract all links from the page
      const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)</gi;
      const links: Array<{ url: string; text: string; domain: string }> = [];
      const seenUrls = new Set<string>();

      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        let url = match[1];
        const text = match[2].trim();

        // Skip empty links, anchors, javascript, mailto, tel
        if (
          !url ||
          url.startsWith("#") ||
          url.startsWith("javascript:") ||
          url.startsWith("mailto:") ||
          url.startsWith("tel:")
        ) {
          continue;
        }

        // Make absolute URL if relative
        try {
          const absoluteUrl = new URL(url, args.directoryUrl);
          url = absoluteUrl.href;
        } catch {
          continue; // Invalid URL
        }

        // Skip duplicates
        if (seenUrls.has(url)) {
          continue;
        }
        seenUrls.add(url);

        // Extract domain
        let domain: string;
        try {
          domain = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          continue;
        }

        // Apply base URL filter if provided
        if (args.baseUrlFilter) {
          const filterDomain = args.baseUrlFilter.replace(/^www\./, "");
          if (!domain.includes(filterDomain)) {
            continue;
          }
        }

        // Apply link pattern if provided
        if (args.linkPattern) {
          try {
            const pattern = new RegExp(args.linkPattern, "i");
            if (!pattern.test(url) && !pattern.test(text)) {
              continue;
            }
          } catch {
            // Invalid regex, skip filtering
          }
        }

        // Skip common non-camp links
        const skipPatterns = [
          /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|jpg|jpeg|png|gif|svg|css|js)$/i,
          /facebook\.com|twitter\.com|instagram\.com|linkedin\.com|youtube\.com/i,
          /login|signin|signup|account|cart|checkout|privacy|terms|contact|about$/i,
        ];

        const shouldSkip = skipPatterns.some((p) => p.test(url));
        if (shouldSkip) {
          continue;
        }

        links.push({ url, text, domain });
      }

      // Sort by domain to group related links
      links.sort((a, b) => a.domain.localeCompare(b.domain));

      return {
        success: true,
        directoryUrl: args.directoryUrl,
        links,
      };
    } catch (error) {
      return {
        success: false,
        directoryUrl: args.directoryUrl,
        links: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Deduplicate and organize extracted camp URLs
 *
 * Takes raw links from scrapeDirectoryForCampUrls and groups them by
 * organization domain, picking the best URL for each org.
 */
export const organizeExtractedUrls = action({
  args: {
    links: v.array(
      v.object({
        url: v.string(),
        text: v.string(),
        domain: v.string(),
      })
    ),
  },
  handler: async (
    _ctx,
    args
  ): Promise<{
    organizations: Array<{
      domain: string;
      suggestedName: string;
      bestUrl: string;
      alternateUrls: string[];
    }>;
  }> => {
    // Group links by domain
    const byDomain = new Map<
      string,
      Array<{ url: string; text: string }>
    >();

    for (const link of args.links) {
      const existing = byDomain.get(link.domain) || [];
      existing.push({ url: link.url, text: link.text });
      byDomain.set(link.domain, existing);
    }

    // For each domain, pick the best URL (preferring /camps, /summer-camps, etc.)
    const organizations: Array<{
      domain: string;
      suggestedName: string;
      bestUrl: string;
      alternateUrls: string[];
    }> = [];

    const campPatterns = [
      /\/camps?\/?$/i,
      /\/summer-?camps?\/?$/i,
      /\/programs?\/?$/i,
      /\/classes?\/?$/i,
      /\/education\/?$/i,
      /\/kids?\/?$/i,
      /\/youth\/?$/i,
    ];

    for (const [domain, links] of byDomain.entries()) {
      // Sort links by preference (camp-related URLs first)
      const scored = links.map((link) => {
        let score = 0;
        for (const pattern of campPatterns) {
          if (pattern.test(link.url)) {
            score += 10;
            break;
          }
        }
        // Shorter URLs are often better entry points
        score -= link.url.length / 100;
        // URLs with descriptive text are better
        if (link.text && link.text.length > 3) {
          score += 2;
        }
        return { ...link, score };
      });

      scored.sort((a, b) => b.score - a.score);

      const bestUrl = scored[0].url;
      const alternateUrls = scored.slice(1).map((l) => l.url);

      // Generate suggested name from domain
      let suggestedName = domain
        .replace(/\.(com|org|edu|net|gov|co|io)$/i, "")
        .split(/[.-]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      // Use link text if more descriptive
      const bestText = scored[0].text;
      if (bestText && bestText.length > 3 && bestText.length < 50) {
        suggestedName = bestText;
      }

      organizations.push({
        domain,
        suggestedName,
        bestUrl,
        alternateUrls,
      });
    }

    // Sort by domain name
    organizations.sort((a, b) => a.domain.localeCompare(b.domain));

    return { organizations };
  },
});
