"use node";

/**
 * Directory Seeding Daemon - Actions
 * Node.js actions for processing directory URLs
 */

import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";

// ============================================
// ACTIONS - Processing
// ============================================

/**
 * Process the next pending directory in the queue
 * Called by local daemon or cron
 */
export const processDirectoryQueue = action({
  args: {},
  handler: async (ctx): Promise<{ processed: number; errors: number }> => {
    // Get pending items
    const pending = await ctx.runQuery(api.scraping.directoryDaemon.getPendingDirectories, {
      limit: 3,
    });

    if (pending.length === 0) {
      return { processed: 0, errors: 0 };
    }

    let processed = 0;
    let errors = 0;

    for (const item of pending) {
      try {
        // Mark as processing
        await ctx.runMutation(internal.scraping.directoryDaemon.updateQueueItem, {
          id: item._id,
          status: "processing",
        });

        // Get city info
        const city = await ctx.runQuery(api.cities.queries.getCityById, {
          cityId: item.cityId,
        });

        if (!city) {
          throw new Error("City not found");
        }

        // Scrape the directory
        const scrapeResult = await scrapeDirectory(item.url, item.linkPattern ?? undefined, item.baseUrlFilter ?? undefined);

        if (!scrapeResult.success) {
          throw new Error(scrapeResult.error || "Failed to scrape directory");
        }

        // Organize and dedupe the links
        const organizations = organizeLinks(scrapeResult.links);

        // Seed each organization
        let orgsCreated = 0;
        let orgsExisted = 0;

        for (const org of organizations) {
          try {
            // Check if org exists
            const existingOrgs = await ctx.runQuery(api.organizations.queries.listOrganizations, {
              cityId: item.cityId,
            });

            const exists = existingOrgs?.some((o) => {
              if (!o.website) return false;
              try {
                const orgDomain = new URL(o.website).hostname.replace(/^www\./, "");
                return orgDomain === org.domain;
              } catch {
                return false;
              }
            });

            if (exists) {
              orgsExisted++;
              continue;
            }

            // Create organization
            const orgId = await ctx.runMutation(api.organizations.mutations.createOrganization, {
              name: org.suggestedName,
              website: org.bestUrl,
              cityIds: [item.cityId],
            });

            // Create scrape source
            await ctx.runMutation(api.scraping.sources.createScrapeSourceSimple, {
              name: org.suggestedName,
              url: org.bestUrl,
              organizationId: orgId,
            });

            // Queue scraper development
            try {
              await ctx.runMutation(api.scraping.development.requestScraperDevelopment, {
                sourceName: org.suggestedName,
                sourceUrl: org.bestUrl,
                cityId: item.cityId,
                notes: `Auto-discovered from directory: ${item.url}`,
                requestedBy: "directory-daemon",
              });
            } catch {
              // Dev request might already exist
            }

            orgsCreated++;
          } catch (err) {
            console.error(`Failed to create org ${org.domain}:`, err);
          }
        }

        // Mark as completed
        await ctx.runMutation(internal.scraping.directoryDaemon.updateQueueItem, {
          id: item._id,
          status: "completed",
          linksFound: scrapeResult.links.length,
          orgsCreated,
          orgsExisted,
        });

        processed++;
      } catch (err) {
        errors++;
        await ctx.runMutation(internal.scraping.directoryDaemon.updateQueueItem, {
          id: item._id,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return { processed, errors };
  },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

interface ExtractedLink {
  url: string;
  text: string;
  domain: string;
}

interface OrganizedOrg {
  domain: string;
  suggestedName: string;
  bestUrl: string;
}

async function scrapeDirectory(
  url: string,
  linkPattern?: string,
  baseUrlFilter?: string
): Promise<{ success: boolean; links: ExtractedLink[]; error?: string }> {
  try {
    const response = await fetch(url, {
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
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract all links
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)</gi;
    const links: ExtractedLink[] = [];
    const seenUrls = new Set<string>();

    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      let linkUrl = match[1];
      const text = match[2].trim();

      // Skip empty, anchors, javascript, mailto, tel
      if (
        !linkUrl ||
        linkUrl.startsWith("#") ||
        linkUrl.startsWith("javascript:") ||
        linkUrl.startsWith("mailto:") ||
        linkUrl.startsWith("tel:")
      ) {
        continue;
      }

      // Make absolute
      try {
        const absoluteUrl = new URL(linkUrl, url);
        linkUrl = absoluteUrl.href;
      } catch {
        continue;
      }

      if (seenUrls.has(linkUrl)) continue;
      seenUrls.add(linkUrl);

      let domain: string;
      try {
        domain = new URL(linkUrl).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }

      // Apply filters
      if (baseUrlFilter) {
        const filterDomain = baseUrlFilter.replace(/^www\./, "");
        if (!domain.includes(filterDomain)) continue;
      }

      if (linkPattern) {
        try {
          const pattern = new RegExp(linkPattern, "i");
          if (!pattern.test(linkUrl) && !pattern.test(text)) continue;
        } catch {
          // Invalid regex, skip
        }
      }

      // Skip common non-camp links
      const skipPatterns = [
        /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|jpg|jpeg|png|gif|svg|css|js)$/i,
        /facebook\.com|twitter\.com|instagram\.com|linkedin\.com|youtube\.com/i,
        /login|signin|signup|account|cart|checkout|privacy|terms|contact|about$/i,
      ];

      if (skipPatterns.some((p) => p.test(linkUrl))) continue;

      links.push({ url: linkUrl, text, domain });
    }

    return { success: true, links };
  } catch (error) {
    return {
      success: false,
      links: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function organizeLinks(links: ExtractedLink[]): OrganizedOrg[] {
  // Group by domain
  const byDomain = new Map<string, ExtractedLink[]>();
  for (const link of links) {
    const existing = byDomain.get(link.domain) || [];
    existing.push(link);
    byDomain.set(link.domain, existing);
  }

  const campPatterns = [
    /\/camps?\/?$/i,
    /\/summer-?camps?\/?$/i,
    /\/programs?\/?$/i,
    /\/education\/?$/i,
    /\/kids?\/?$/i,
  ];

  const organizations: OrganizedOrg[] = [];

  for (const [domain, domainLinks] of byDomain.entries()) {
    // Score and sort links
    const scored = domainLinks.map((link) => {
      let score = 0;
      for (const pattern of campPatterns) {
        if (pattern.test(link.url)) {
          score += 10;
          break;
        }
      }
      score -= link.url.length / 100;
      if (link.text && link.text.length > 3) score += 2;
      return { ...link, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const bestUrl = scored[0].url;

    // Generate name from domain
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

    organizations.push({ domain, suggestedName, bestUrl });
  }

  return organizations;
}
