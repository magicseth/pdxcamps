'use node';

/**
 * URL Discovery
 *
 * When a source URL is broken (404), this system tries to find the new URL
 * by crawling the organization's main website and looking for camp-related pages.
 */

import { internalAction } from '../_generated/server';
import { api, internal } from '../_generated/api';
import { v } from 'convex/values';

// Keywords that indicate a camp registration page
const CAMP_KEYWORDS = [
  'camp',
  'summer',
  'registration',
  'register',
  'enroll',
  'sign up',
  'programs',
  'classes',
  'youth',
  'kids',
  'children',
];

// Current year and next year for seasonal pages
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1];

interface DiscoveredUrl {
  url: string;
  score: number;
  matchedKeywords: string[];
  linkText: string;
}

/**
 * Extract the base domain from a URL.
 */
function getBaseDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return url;
  }
}

/**
 * Score a URL based on how likely it is to be a camp registration page.
 */
function scoreUrl(url: string, linkText: string): { score: number; keywords: string[] } {
  const combined = `${url} ${linkText}`.toLowerCase();
  const matchedKeywords: string[] = [];
  let score = 0;

  // Check for camp keywords
  for (const keyword of CAMP_KEYWORDS) {
    if (combined.includes(keyword)) {
      matchedKeywords.push(keyword);
      score += 10;
    }
  }

  // Bonus for year in URL (indicates current/upcoming season)
  for (const year of YEARS) {
    if (combined.includes(year.toString())) {
      matchedKeywords.push(year.toString());
      score += 15;
    }
  }

  // Bonus for registration-specific terms
  if (combined.includes('register') || combined.includes('registration')) {
    score += 20;
  }
  if (combined.includes('summer camp')) {
    score += 25;
  }

  // Penalty for clearly wrong pages
  if (combined.includes('staff') || combined.includes('careers') || combined.includes('jobs')) {
    score -= 30;
  }
  if (combined.includes('donate') || combined.includes('volunteer')) {
    score -= 20;
  }
  if (combined.includes('about') || combined.includes('contact') || combined.includes('history')) {
    score -= 15;
  }

  return { score, keywords: matchedKeywords };
}

/**
 * Discover potential camp URLs from an organization's website.
 */
export const discoverCampUrls = internalAction({
  args: {
    sourceId: v.id('scrapeSources'),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    discoveredUrls: DiscoveredUrl[];
    suggestedUrl?: string;
    error?: string;
  }> => {
    // Get the source
    const source = await ctx.runQuery(api.scraping.queries.getScrapeSource, {
      sourceId: args.sourceId,
    });

    if (!source) {
      return { success: false, discoveredUrls: [], error: 'Source not found' };
    }

    // Get the organization's website
    const orgWebsite = source.organization?.website;
    if (!orgWebsite) {
      return {
        success: false,
        discoveredUrls: [],
        error: 'Organization has no website configured',
      };
    }

    const baseDomain = getBaseDomain(orgWebsite);

    try {
      // Fetch the organization's main page
      const response = await fetch(orgWebsite, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PDXCamps/1.0; +https://pdxcamps.com)',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          discoveredUrls: [],
          error: `Failed to fetch org website: ${response.status}`,
        };
      }

      const html = await response.text();

      // Extract all links from the page
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)</gi;
      const discoveredUrls: DiscoveredUrl[] = [];
      const seenUrls = new Set<string>();

      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1];
        const linkText = match[2].trim();

        // Skip empty, anchor, or javascript links
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
          continue;
        }

        // Convert relative URLs to absolute
        if (href.startsWith('/')) {
          href = baseDomain + href;
        } else if (!href.startsWith('http')) {
          href = baseDomain + '/' + href;
        }

        // Skip external links
        if (!href.startsWith(baseDomain)) {
          continue;
        }

        // Skip duplicates
        if (seenUrls.has(href)) {
          continue;
        }
        seenUrls.add(href);

        // Score this URL
        const { score, keywords } = scoreUrl(href, linkText);

        // Only include if it has some relevance
        if (score > 0) {
          discoveredUrls.push({
            url: href,
            score,
            matchedKeywords: keywords,
            linkText,
          });
        }
      }

      // Sort by score descending
      discoveredUrls.sort((a, b) => b.score - a.score);

      // Take top 10
      const topUrls = discoveredUrls.slice(0, 10);

      // Suggest the top URL if it scores high enough
      const suggestedUrl = topUrls.length > 0 && topUrls[0].score >= 30 ? topUrls[0].url : undefined;

      // If we found a good suggestion, save it
      if (suggestedUrl) {
        await ctx.runMutation(internal.scraping.importMutations.suggestUrlUpdate, {
          sourceId: args.sourceId,
          suggestedUrl,
        });
      }

      return {
        success: true,
        discoveredUrls: topUrls,
        suggestedUrl,
      };
    } catch (error) {
      return {
        success: false,
        discoveredUrls: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Run URL discovery for all sources with broken URLs.
 */
export const discoverUrlsForBrokenSources = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    processed: number;
    suggestionsFound: number;
    results: Array<{
      sourceName: string;
      suggestedUrl?: string;
      error?: string;
    }>;
  }> => {
    const limit = args.limit ?? 10;

    // Find sources that were auto-disabled due to 404s
    const brokenSources = await ctx.runQuery(internal.scraping.dataQualityChecks.findBrokenUrlSources);

    const results: Array<{
      sourceName: string;
      suggestedUrl?: string;
      error?: string;
    }> = [];
    let suggestionsFound = 0;

    for (const source of brokenSources.slice(0, limit)) {
      const result = await ctx.runAction(internal.scraping.urlDiscovery.discoverCampUrls, {
        sourceId: source.sourceId,
      });

      results.push({
        sourceName: source.sourceName,
        suggestedUrl: result.suggestedUrl,
        error: result.error,
      });

      if (result.suggestedUrl) {
        suggestionsFound++;
      }
    }

    return {
      processed: results.length,
      suggestionsFound,
      results,
    };
  },
});
