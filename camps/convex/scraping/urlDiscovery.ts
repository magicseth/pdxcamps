"use node";

/**
 * URL Discovery & Fallback
 *
 * Helps find camp content when URLs change or 404.
 * Implements multiple strategies:
 * 1. Try original URL
 * 2. Walk up directory path
 * 3. Try common camp paths
 * 4. Check sitemap
 */

import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";

interface UrlCheckResult {
  url: string | null;
  method:
    | "direct"
    | "parent_fallback"
    | "common_path"
    | "sitemap"
    | "failed";
  status?: number;
  hasCampContent?: boolean;
}

/**
 * Resolve a URL for a scrape source, trying fallback strategies if needed
 */
export const resolveUrl = action({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args): Promise<UrlCheckResult> => {
    const source = await ctx.runQuery(api.scraping.queries.getScrapeSource, {
      sourceId: args.sourceId,
    });

    if (!source) {
      return { url: null, method: "failed" };
    }

    // Strategy 1: Try original URL
    const directResult = await tryFetch(source.url);
    if (directResult.ok && hasCampContent(directResult.html || "")) {
      // Update URL history
      await ctx.runMutation(internal.scraping.importMutations.recordUrlCheck, {
        sourceId: args.sourceId,
        url: source.url,
        status: "valid",
      });
      return { url: source.url, method: "direct", status: directResult.status };
    }

    // Record failure
    await ctx.runMutation(internal.scraping.importMutations.recordUrlCheck, {
      sourceId: args.sourceId,
      url: source.url,
      status: directResult.status === 404 ? "404" : "error",
    });

    // Strategy 2: Walk up directory path
    const parentUrls = getParentUrls(source.url);
    for (const parentUrl of parentUrls) {
      const result = await tryFetch(parentUrl);
      if (result.ok && hasCampContent(result.html || "")) {
          await ctx.runMutation(internal.scraping.importMutations.suggestUrlUpdate, {
          sourceId: args.sourceId,
          suggestedUrl: parentUrl,
        });
        return { url: parentUrl, method: "parent_fallback", status: result.status };
      }
    }

    // Strategy 3: Try common camp paths
    const commonPaths = getCommonCampPaths(source.url);
    for (const commonPath of commonPaths) {
      const result = await tryFetch(commonPath);
      if (result.ok && hasCampContent(result.html || "")) {
          await ctx.runMutation(internal.scraping.importMutations.suggestUrlUpdate, {
          sourceId: args.sourceId,
          suggestedUrl: commonPath,
        });
        return { url: commonPath, method: "common_path", status: result.status };
      }
    }

    // Strategy 4: Check sitemap
    try {
      const domain = new URL(source.url).origin;
      const sitemapUrls = await fetchSitemap(domain);
      const campUrl = sitemapUrls.find(
        (u) => /camp|summer|program|class|register/i.test(u)
      );
      if (campUrl) {
        const result = await tryFetch(campUrl);
        if (result.ok && hasCampContent(result.html || "")) {
              await ctx.runMutation(internal.scraping.importMutations.suggestUrlUpdate, {
            sourceId: args.sourceId,
            suggestedUrl: campUrl,
          });
          return { url: campUrl, method: "sitemap", status: result.status };
        }
      }
    } catch {
      // Sitemap fetch failed, continue
    }

    return { url: null, method: "failed" };
  },
});

/**
 * Check if a URL is valid and returns camp content
 */
export const checkUrl = action({
  args: {
    url: v.string(),
  },
  handler: async (_ctx, args): Promise<{
    valid: boolean;
    hasCampContent: boolean;
    status: number;
    contentSignals: string[];
  }> => {
    const result = await tryFetch(args.url);

    if (!result.ok) {
      return {
        valid: false,
        hasCampContent: false,
        status: result.status,
        contentSignals: [],
      };
    }

    const html = result.html || "";
    const signals = getCampContentSignals(html);

    return {
      valid: true,
      hasCampContent: signals.length >= 2,
      status: result.status,
      contentSignals: signals,
    };
  },
});


// ============ HELPER FUNCTIONS ============

async function tryFetch(
  url: string
): Promise<{ ok: boolean; status: number; html?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PDXCamps/1.0; +https://pdxcamps.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const html = await response.text();
    return { ok: true, status: response.status, html };
  } catch (error) {
    return { ok: false, status: 0 };
  }
}

function getParentUrls(url: string): string[] {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const urls: string[] = [];

    // Walk up the path
    while (parts.length > 0) {
      parts.pop();
      if (parts.length > 0) {
        urls.push(`${parsed.origin}/${parts.join("/")}`);
      }
    }

    return urls;
  } catch {
    return [];
  }
}

function getCommonCampPaths(url: string): string[] {
  try {
    const parsed = new URL(url);
    const origin = parsed.origin;

    return [
      `${origin}/camps`,
      `${origin}/summer-camps`,
      `${origin}/summer`,
      `${origin}/programs`,
      `${origin}/classes`,
      `${origin}/registration`,
      `${origin}/register`,
      `${origin}/youth`,
      `${origin}/kids`,
    ];
  } catch {
    return [];
  }
}

async function fetchSitemap(domain: string): Promise<string[]> {
  const sitemapUrls: string[] = [];

  try {
    // Try standard sitemap location
    const response = await fetch(`${domain}/sitemap.xml`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PDXCamps/1.0)",
      },
    });

    if (!response.ok) return [];

    const xml = await response.text();

    // Simple URL extraction from sitemap
    const urlMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
    for (const match of urlMatches) {
      sitemapUrls.push(match[1]);
    }
  } catch {
    // Sitemap fetch failed
  }

  return sitemapUrls;
}

function hasCampContent(html: string): boolean {
  return getCampContentSignals(html).length >= 2;
}

function getCampContentSignals(html: string): string[] {
  const signals: string[] = [];
  const htmlLower = html.toLowerCase();

  if (/summer\s*camp/i.test(html)) {
    signals.push("summer camp");
  }
  if (/registration|register|enroll|sign\s*up/i.test(html)) {
    signals.push("registration");
  }
  if (/ages?\s*\d+/i.test(html)) {
    signals.push("age range");
  }
  if (/grades?\s*[k\d]/i.test(html)) {
    signals.push("grade range");
  }
  if (/\$\d+/.test(html)) {
    signals.push("pricing");
  }
  if (/week\s*of|june|july|august/i.test(html)) {
    signals.push("dates");
  }
  if (/9\s*(?:am|:00)|drop.?off|pick.?up/i.test(html)) {
    signals.push("times");
  }

  return signals;
}
