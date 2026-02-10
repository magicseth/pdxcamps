/**
 * Directory queue processing — fetches directory URLs locally and extracts camp links.
 * Falls back to Stagehand/Browserbase for sites that block simple fetch.
 */

import { DirectoryQueueItem } from './types';
import { client, writeLog, logQueueStatus, createStagehand } from './shared';
import { api } from '../../convex/_generated/api';

/**
 * Process pending directory queue items by fetching locally
 */
export async function processDirectoryQueue(verbose: boolean = false) {
  const log = (msg: string) => {
    writeLog(msg);
    if (verbose) console.log(msg);
  };

  log('📂 Checking directory queue...');

  // Get pending items
  const pending = await client.query(api.scraping.directoryDaemon.getPendingDirectories, { limit: 3 });

  if (!pending || pending.length === 0) {
    log('   No pending directory items');
    return;
  }

  log(`   Found ${pending.length} pending directory items`);

  for (const item of pending as DirectoryQueueItem[]) {
    await logQueueStatus('   ');
    log(`\n   Processing: ${item.url}`);

    try {
      // Claim the item
      const claimed = await client.mutation(api.scraping.directoryDaemon.claimQueueItem, {
        id: item._id as any,
      });

      if (!claimed) {
        log(`   Already claimed by another worker`);
        continue;
      }

      // Fetch the URL locally (from this machine, not Convex servers)
      log(`   Fetching locally...`);
      const result = await fetchDirectoryLocally(item.url, item.linkPattern, item.baseUrlFilter, log);

      if (!result.success) {
        // Report failure
        await client.mutation(api.scraping.directoryDaemon.completeQueueItem, {
          id: item._id as any,
          success: false,
          error: result.error,
        });
        log(`   ❌ Failed: ${result.error}`);
        continue;
      }

      log(`   Found ${result.urls.length} camp URLs`);

      // Report success with extracted URLs
      const completion = await client.mutation(api.scraping.directoryDaemon.completeQueueItem, {
        id: item._id as any,
        success: true,
        linksFound: result.urls.length,
        extractedUrls: result.urls,
      });

      log(`   ✅ Created ${completion.created} orgs, ${completion.existed} already existed`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log(`   ❌ Error: ${errorMsg}`);

      try {
        await client.mutation(api.scraping.directoryDaemon.completeQueueItem, {
          id: item._id as any,
          success: false,
          error: errorMsg,
        });
      } catch {
        // Ignore error reporting errors
      }
    }
  }
}

/**
 * Fetch a directory URL locally and extract camp links
 * Falls back to Stagehand/Browserbase if simple fetch fails with 403
 */
async function fetchDirectoryLocally(
  url: string,
  linkPattern?: string,
  baseUrlFilter?: string,
  log: (msg: string) => void = console.log,
): Promise<{ success: boolean; urls: string[]; error?: string }> {
  // Try simple fetch first
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (response.ok) {
      const html = await response.text();
      return extractLinksFromHtml(html, url, linkPattern, baseUrlFilter, log);
    }

    // If 403, try Stagehand fallback
    if (response.status === 403) {
      log(`   Simple fetch got 403, trying Stagehand/Browserbase...`);
      return await fetchWithStagehand(url, linkPattern, baseUrlFilter, log);
    }

    return { success: false, urls: [], error: `HTTP ${response.status}: ${response.statusText}` };
  } catch (error) {
    // Network error - try Stagehand
    log(`   Fetch error, trying Stagehand: ${error instanceof Error ? error.message : error}`);
    return await fetchWithStagehand(url, linkPattern, baseUrlFilter, log);
  }
}

/**
 * Extract links from HTML content
 */
function extractLinksFromHtml(
  html: string,
  sourceUrl: string,
  linkPattern?: string,
  baseUrlFilter?: string,
  log: (msg: string) => void = console.log,
): { success: boolean; urls: string[]; error?: string } {
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)</gi;
  const urls: string[] = [];
  const seenDomains = new Set<string>();

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
      const absoluteUrl = new URL(linkUrl, sourceUrl);
      linkUrl = absoluteUrl.href;
    } catch {
      continue;
    }

    // Get domain
    let domain: string;
    try {
      domain = new URL(linkUrl).hostname.replace(/^www\./, '');
    } catch {
      continue;
    }

    // Skip the source domain itself
    const sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, '');
    if (domain === sourceHost) continue;

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
      /\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif|svg|css|js)$/i,
      /facebook\.com|twitter\.com|instagram\.com|linkedin\.com|youtube\.com/i,
      /login|signin|signup|account|cart|checkout|privacy|terms$/i,
    ];

    if (skipPatterns.some((p) => p.test(linkUrl))) continue;

    // Dedupe by domain - only keep one URL per domain
    if (seenDomains.has(domain)) continue;
    seenDomains.add(domain);

    urls.push(linkUrl);
  }

  log(`   Extracted ${urls.length} unique camp URLs`);
  return { success: true, urls };
}

/**
 * Fetch directory using Stagehand/Browserbase (real browser)
 */
async function fetchWithStagehand(
  url: string,
  linkPattern?: string,
  baseUrlFilter?: string,
  log: (msg: string) => void = console.log,
): Promise<{ success: boolean; urls: string[]; error?: string }> {
  let stagehand: any = null;

  try {
    log(`   Initializing Stagehand...`);

    stagehand = await createStagehand('haiku');
    const page = stagehand.context.pages()[0];

    log(`   Loading page in browser...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Get the page HTML using evaluate
    const html = await page.evaluate(() => document.documentElement.outerHTML);

    await stagehand.close();
    stagehand = null;

    // Extract links from the rendered HTML
    return extractLinksFromHtml(html, url, linkPattern, baseUrlFilter, log);
  } catch (error) {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch {}
    }
    return {
      success: false,
      urls: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
