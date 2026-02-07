'use node';

/**
 * Market Discovery Action
 *
 * Executes market discovery using Stagehand to search Google
 * and extract camp organization URLs from search results and directories.
 *
 * NOTE: This action is designed to be called from the local daemon,
 * not directly from the Convex server, because it uses Stagehand
 * which requires a browser environment.
 */

import { action } from '../_generated/server';
import { api } from '../_generated/api';
import { v } from 'convex/values';

// Known camp directory domains to prioritize for deep crawl
const KNOWN_DIRECTORIES = [
  'activityhero.com',
  'sawyer.com',
  'campsearch.com',
  'mysummercamps.com',
  'acacamps.org',
  'campnavigator.com',
  'kidscamps.com',
  'summercampdirectories.com',
];

// URL patterns that indicate a camp-related page
const CAMP_SIGNAL_KEYWORDS = [
  'summer camp',
  'day camp',
  'kids camp',
  'registration',
  'enroll',
  'sign up',
  'ages',
  'grades',
  'children',
  'youth',
  'program',
];

// URLs to skip (not camp organizations)
const SKIP_PATTERNS = [
  /facebook\.com/i,
  /twitter\.com/i,
  /instagram\.com/i,
  /linkedin\.com/i,
  /youtube\.com/i,
  /wikipedia\.org/i,
  /yelp\.com/i,
  /tripadvisor/i,
  /google\.(com|maps)/i,
  /pinterest\.com/i,
  /reddit\.com/i,
  /indeed\.com/i,
  /glassdoor\.com/i,
  /\.(pdf|doc|docx|xls|xlsx)$/i,
];

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Check if URL should be skipped
 */
function shouldSkipUrl(url: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Check if domain is a known directory
 */
function isKnownDirectory(domain: string): boolean {
  return KNOWN_DIRECTORIES.some((d) => domain.includes(d));
}

/**
 * Score a URL for camp-relatedness
 */
function scoreCampUrl(url: string, title: string): number {
  let score = 0;
  const combined = (url + ' ' + title).toLowerCase();

  for (const keyword of CAMP_SIGNAL_KEYWORDS) {
    if (combined.includes(keyword)) {
      score += 10;
    }
  }

  // Prefer .org and .edu
  if (url.includes('.org') || url.includes('.edu')) {
    score += 5;
  }

  // Prefer URLs with current or next year
  const currentYear = new Date().getFullYear();
  if (combined.includes(String(currentYear)) || combined.includes(String(currentYear + 1))) {
    score += 5;
  }

  return score;
}

/**
 * Execute market discovery for a task
 *
 * This is a placeholder action that documents what the daemon should do.
 * The actual implementation runs in the daemon using Stagehand locally.
 */
export const executeMarketDiscovery = action({
  args: {
    taskId: v.id('marketDiscoveryTasks'),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    message: string;
    urlsFound?: number;
    orgsCreated?: number;
  }> => {
    // Get the task
    const task = await ctx.runQuery(api.scraping.marketDiscovery.getDiscoveryTaskStatus, {
      taskId: args.taskId,
    });

    if (!task) {
      return { success: false, message: 'Task not found' };
    }

    // This action serves as a fallback - the daemon should handle most discovery
    // But we can do basic URL processing here if needed

    // For now, just return that the daemon should handle this
    return {
      success: false,
      message:
        'Market discovery should be run from the local daemon with Stagehand. Use: npx tsx scripts/scraper-daemon.ts --discovery',
    };
  },
});

/**
 * Process search results and create organizations
 *
 * Called by the daemon after it finishes web searching
 */
export const processDiscoveryResults = action({
  args: {
    taskId: v.id('marketDiscoveryTasks'),
    discoveredUrls: v.array(
      v.object({
        url: v.string(),
        source: v.string(),
        title: v.optional(v.string()),
        domain: v.string(),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    orgsCreated: number;
    orgsExisted: number;
    sourcesCreated: number;
  }> => {
    // Deduplicate by domain
    const byDomain = new Map<string, { url: string; title?: string; domain: string; score: number }>();

    for (const item of args.discoveredUrls) {
      const domain = item.domain;

      // Skip if we should ignore this URL
      if (shouldSkipUrl(item.url)) {
        continue;
      }

      const score = scoreCampUrl(item.url, item.title || '');
      const existing = byDomain.get(domain);

      if (!existing || score > existing.score) {
        byDomain.set(domain, {
          url: item.url,
          title: item.title,
          domain,
          score,
        });
      }
    }

    // Filter to only camp-related URLs (score > 0 or known directories)
    const filteredUrls = Array.from(byDomain.values()).filter(
      (item) => item.score > 0 || isKnownDirectory(item.domain),
    );

    // Create orgs and sources
    const result = await ctx.runMutation(api.scraping.marketDiscovery.createOrgsFromDiscoveredUrls, {
      taskId: args.taskId,
      urls: filteredUrls.map(({ url, title, domain }) => ({
        url,
        title,
        domain,
      })),
    });

    // Complete the task
    await ctx.runMutation(api.scraping.marketDiscovery.completeDiscoveryTask, {
      taskId: args.taskId,
      orgsCreated: result.created,
      orgsExisted: result.existed,
      sourcesCreated: result.sourcesCreated,
      discoveredUrls: args.discoveredUrls,
    });

    return {
      success: true,
      orgsCreated: result.created,
      orgsExisted: result.existed,
      sourcesCreated: result.sourcesCreated,
    };
  },
});

// Export utilities for use in daemon
export {
  KNOWN_DIRECTORIES,
  CAMP_SIGNAL_KEYWORDS,
  SKIP_PATTERNS,
  extractDomain,
  shouldSkipUrl,
  isKnownDirectory,
  scoreCampUrl,
};
