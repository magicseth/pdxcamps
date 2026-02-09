'use node';

/**
 * Directory Actions — "use node" actions for crawling directories
 *
 * Crawls directory URLs, extracts organization links,
 * creates organizations with discoveredFromDirectoryId, and updates directory stats.
 */

import { action } from '../_generated/server';
import { api } from '../_generated/api';
import { v } from 'convex/values';

/**
 * Crawl a single directory: fetch HTML, extract links, create orgs + sources + dev requests
 */
export const crawlDirectory = action({
  args: {
    directoryId: v.id('directories'),
  },
  handler: async (ctx, args) => {
    // Get directory record with its organizations
    const dirWithOrgs = await ctx.runQuery(api.scraping.directories.getDirectoryWithOrgs, {
      directoryId: args.directoryId,
    });

    if (!dirWithOrgs) {
      throw new Error('Directory not found');
    }

    // Mark as crawling
    await ctx.runMutation(api.scraping.directories.updateDirectoryStatus, {
      directoryId: args.directoryId,
      status: 'crawling',
    });

    try {
      // Fetch and extract links
      const result = await scrapeDirectory(
        dirWithOrgs.url,
        dirWithOrgs.linkPattern ?? undefined,
        dirWithOrgs.baseUrlFilter ?? undefined,
      );

      if (!result.success) {
        await ctx.runMutation(api.scraping.directories.updateDirectoryStatus, {
          directoryId: args.directoryId,
          status: 'failed',
          crawlError: result.error || 'Failed to scrape directory',
          lastCrawledAt: Date.now(),
        });
        return { success: false, error: result.error };
      }

      // Organize links into organizations
      const organizations = organizeLinks(result.links);

      // Load existing org domains for this city to avoid duplicates
      const existingOrgs = await ctx.runQuery(api.organizations.queries.listOrganizations, {
        cityId: dirWithOrgs.cityId,
      });

      const existingDomains = new Set<string>();
      for (const org of existingOrgs || []) {
        if (!org.website) continue;
        try {
          const domain = new URL(org.website).hostname.replace(/^www\./, '');
          existingDomains.add(domain);
        } catch {
          // skip
        }
      }

      let orgsCreated = 0;
      let orgsExisted = 0;

      for (const org of organizations) {
        if (existingDomains.has(org.domain)) {
          orgsExisted++;
          continue;
        }

        existingDomains.add(org.domain);

        try {
          // Create organization with directory link
          const orgId = await ctx.runMutation(api.organizations.mutations.createOrganization, {
            name: org.suggestedName,
            website: org.bestUrl,
            cityIds: [dirWithOrgs.cityId],
          });

          // Set discoveredFromDirectoryId on the org
          // We need an internal mutation for this since createOrganization doesn't have this field
          // For now, we'll handle this via a patch
          await ctx.runMutation(api.scraping.directories.linkOrgToDirectory, {
            organizationId: orgId,
            directoryId: args.directoryId,
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
              cityId: dirWithOrgs.cityId,
              notes: `Auto-discovered from directory: ${dirWithOrgs.name} (${dirWithOrgs.url})`,
              requestedBy: 'directory-crawler',
            });
          } catch {
            // Dev request might already exist
          }

          orgsCreated++;
        } catch (err) {
          console.error(`Failed to create org ${org.domain}:`, err);
        }
      }

      // Update directory as crawled
      await ctx.runMutation(api.scraping.directories.updateDirectoryStatus, {
        directoryId: args.directoryId,
        status: 'crawled',
        linksFound: result.links.length,
        orgsExtracted: orgsCreated,
        lastCrawledAt: Date.now(),
      });

      return {
        success: true,
        linksFound: result.links.length,
        orgsCreated,
        orgsExisted,
      };
    } catch (err) {
      await ctx.runMutation(api.scraping.directories.updateDirectoryStatus, {
        directoryId: args.directoryId,
        status: 'failed',
        crawlError: err instanceof Error ? err.message : 'Unknown error',
        lastCrawledAt: Date.now(),
      });
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },
});

// ============ HELPER FUNCTIONS (from directoryDaemonActions.ts) ============

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
  baseUrlFilter?: string,
): Promise<{ success: boolean; links: ExtractedLink[]; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
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
        linkUrl.startsWith('#') ||
        linkUrl.startsWith('javascript:') ||
        linkUrl.startsWith('mailto:') ||
        linkUrl.startsWith('tel:')
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
        domain = new URL(linkUrl).hostname.replace(/^www\./, '');
      } catch {
        continue;
      }

      // Apply filters
      if (baseUrlFilter) {
        const filterDomain = baseUrlFilter.replace(/^www\./, '');
        if (!domain.includes(filterDomain)) continue;
      }

      if (linkPattern) {
        try {
          const pattern = new RegExp(linkPattern, 'i');
          if (!pattern.test(linkUrl) && !pattern.test(text)) continue;
        } catch {
          // Invalid regex, skip filter
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
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function organizeLinks(links: ExtractedLink[]): OrganizedOrg[] {
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

    let suggestedName = domain
      .replace(/\.(com|org|edu|net|gov|co|io)$/i, '')
      .split(/[.-]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const bestText = scored[0].text;
    if (bestText && bestText.length > 3 && bestText.length < 50) {
      suggestedName = bestText;
    }

    organizations.push({ domain, suggestedName, bestUrl });
  }

  return organizations;
}
