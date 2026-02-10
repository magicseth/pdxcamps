/**
 * Market discovery worker - searches Google for camp organizations in new markets
 */

import { DiscoveryTask, DiscoveredUrl } from './types';
import {
  client,
  writeLog,
  logQueueStatus,
  createStagehand,
  KNOWN_DIRECTORIES,
  shouldSkipDiscoveryUrl,
  extractDomainFromUrl,
} from './shared';
import { api } from '../../convex/_generated/api';

let shutdownRequested = false;

export function setShutdownFlag(value: boolean) {
  shutdownRequested = value;
}

/**
 * Process pending market discovery tasks
 */
export async function processMarketDiscoveryQueue(verbose: boolean = false) {
  // For discovery, always log to console since it's a long-running visual task
  const log = (msg: string) => {
    writeLog(msg);
    console.log(msg);
  };

  // Get pending tasks
  const tasks = await client.query(api.scraping.marketDiscovery.getPendingDiscoveryTasks, { limit: 1 });

  if (!tasks || tasks.length === 0) {
    if (verbose) log('🌍 No pending market discovery tasks');
    return;
  }

  const task = tasks[0] as DiscoveryTask;
  log(`🌍 Processing market discovery: ${task.regionName}`);
  await logQueueStatus('   ');

  // Claim the task
  const claimed = await client.mutation(api.scraping.marketDiscovery.claimDiscoveryTask, {
    taskId: task._id as any,
    sessionId: `daemon-${Date.now()}`,
  });

  if (!claimed) {
    log(`   Already claimed by another worker`);
    return;
  }

  let stagehand: any = null;
  const discoveredUrls: DiscoveredUrl[] = [];
  const seenDomains = new Set<string>();
  let searchesCompleted = 0;
  let directoriesFound = 0;

  try {
    // Initialize Stagehand
    log(`   🔧 Initializing Stagehand...`);
    stagehand = await createStagehand('sonnet');
    const page = stagehand.context.pages()[0];

    // Search Google for each query
    const totalSearches = task.searchQueries.length;
    for (const query of task.searchQueries) {
      if (shutdownRequested) break;

      log(`   🔍 [${searchesCompleted + 1}/${totalSearches}] Searching: "${query}"`);

      try {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Debug: Check page title to detect captcha/consent
        const pageTitle = await page.title();
        if (
          pageTitle.toLowerCase().includes('captcha') ||
          pageTitle.toLowerCase().includes('consent') ||
          pageTitle.toLowerCase().includes('before you continue')
        ) {
          log(`      ⚠️ Detected blocking page: "${pageTitle}"`);
          // Try to handle consent
          try {
            const acceptButton = await page.$(
              'button[id*="accept"], button[aria-label*="Accept"], button:has-text("Accept all")',
            );
            if (acceptButton) {
              await acceptButton.click();
              await page.waitForTimeout(2000);
              log(`      ✓ Clicked consent button`);
            }
          } catch {}
        }

        // Extract search results using Stagehand
        const results = await stagehand.extract({
          instruction: `Extract all organic search results from this Google search page.
For each result, extract:
- The URL (href of the main link)
- The title text
Skip ads, "People also ask", and other non-result elements.
Focus on actual website links that could be summer camp organizations.`,
          schema: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    url: { type: 'string' },
                    title: { type: 'string' },
                  },
                },
              },
            },
          },
        });

        let extracted = results as { results?: Array<{ url: string; title: string }> };

        // If AI extraction returned nothing, try DOM extraction as fallback
        if (!extracted.results || extracted.results.length === 0) {
          log(`      ⚠️ AI extraction returned 0, trying DOM fallback...`);
          const domResults = await page.evaluate(() => {
            const results: Array<{ url: string; title: string }> = [];
            // Google search results are in divs with class 'g' or data-hveid
            const searchResults = document.querySelectorAll('div.g, div[data-hveid]');
            searchResults.forEach((div: Element) => {
              const linkEl = div.querySelector('a[href^="http"]');
              const titleEl = div.querySelector('h3');
              if (linkEl && titleEl) {
                const url = linkEl.getAttribute('href');
                const title = titleEl.textContent;
                if (url && title && !url.includes('google.com')) {
                  results.push({ url, title });
                }
              }
            });
            return results;
          });
          if (domResults.length > 0) {
            extracted = { results: domResults };
            log(`      ✓ DOM fallback found ${domResults.length} results`);
          } else {
            // Last resort: check what's actually on the page
            const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '');
            log(`      ⚠️ Page content preview: ${bodyText.replace(/\n/g, ' ').slice(0, 200)}...`);
          }
        }

        if (extracted.results) {
          for (const result of extracted.results) {
            if (!result.url || shouldSkipDiscoveryUrl(result.url)) continue;

            const domain = extractDomainFromUrl(result.url);
            if (!domain || seenDomains.has(domain)) continue;

            seenDomains.add(domain);
            discoveredUrls.push({
              url: result.url,
              source: 'google',
              title: result.title,
              domain,
            });

            // Check if it's a known directory
            const isDirectory = KNOWN_DIRECTORIES.some((d) => domain.includes(d));
            if (isDirectory) {
              directoriesFound++;
              log(`         📂 Directory: ${domain}`);
            } else {
              log(`         + ${domain}`);
            }
          }
        }

        searchesCompleted++;

        // Update progress
        await client.mutation(api.scraping.marketDiscovery.updateDiscoveryProgress, {
          taskId: task._id as any,
          searchesCompleted,
          urlsDiscovered: discoveredUrls.length,
          directoriesFound,
        });

        const newResults = extracted.results?.length || 0;
        log(
          `      ✓ Found ${newResults} results | Total: ${discoveredUrls.length} unique URLs, ${directoriesFound} directories`,
        );

        // Rate limit between searches
        await page.waitForTimeout(2000);
      } catch (searchError) {
        const errorMsg = searchError instanceof Error ? searchError.message : String(searchError);
        log(`      ⚠️ Search error: ${errorMsg.slice(0, 100)}`);
      }
    }

    // Phase 2: Search for combinations of discovered camp names to find more directories
    const discoveredCampNames = discoveredUrls
      .filter((u) => !KNOWN_DIRECTORIES.some((d) => u.domain.includes(d)))
      .slice(0, 10)
      .map((u) => u.title || u.domain.split('.')[0]);

    if (discoveredCampNames.length >= 3 && !shutdownRequested) {
      log(`   🔍 Phase 2: Searching for camp name combinations...`);

      // Create 2-3 combo searches using discovered camp names
      const comboSearches = [
        `"${discoveredCampNames[0]}" "${discoveredCampNames[1]}" "${discoveredCampNames[2]}" ${task.regionName}`,
        discoveredCampNames.length > 5
          ? `"${discoveredCampNames[3]}" "${discoveredCampNames[4]}" summer camps ${task.regionName}`
          : null,
      ].filter(Boolean) as string[];

      for (const comboQuery of comboSearches) {
        if (shutdownRequested) break;
        log(`      🔍 Combo search: ${comboQuery.slice(0, 60)}...`);

        try {
          await page.goto(`https://www.google.com/search?q=${encodeURIComponent(comboQuery)}&num=20`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await page.waitForTimeout(3000);

          const comboResults = await page.evaluate(() => {
            const results: Array<{ url: string; title: string }> = [];
            document.querySelectorAll('div.g, div[data-hveid]').forEach((div: Element) => {
              const linkEl = div.querySelector('a[href^="http"]');
              const titleEl = div.querySelector('h3');
              if (linkEl && titleEl) {
                const url = linkEl.getAttribute('href');
                const title = titleEl.textContent;
                if (url && title && !url.includes('google.com')) {
                  results.push({ url, title });
                }
              }
            });
            return results;
          });

          let newFromCombo = 0;
          for (const result of comboResults) {
            if (!result.url || shouldSkipDiscoveryUrl(result.url)) continue;
            const domain = extractDomainFromUrl(result.url);
            if (!domain || seenDomains.has(domain)) continue;

            seenDomains.add(domain);
            discoveredUrls.push({ url: result.url, source: 'google-combo', title: result.title, domain });
            newFromCombo++;
            log(`         + ${domain}`);
          }
          log(`      ✓ Found ${newFromCombo} new URLs from combo search`);
          await page.waitForTimeout(2000);
        } catch (e) {
          log(`      ⚠️ Combo search error: ${e instanceof Error ? e.message.slice(0, 50) : 'unknown'}`);
        }
      }
    }

    // Phase 3: Crawl discovered directories to extract all camp links
    const directoryUrls = discoveredUrls
      .filter((u) => {
        const domainLower = u.domain.toLowerCase();
        // Known directories + sites that look like camp listing pages
        return (
          KNOWN_DIRECTORIES.some((d) => domainLower.includes(d)) ||
          u.url.includes('/camps') ||
          u.url.includes('/summer') ||
          u.title?.toLowerCase().includes('best') ||
          u.title?.toLowerCase().includes('guide') ||
          u.title?.toLowerCase().includes('list')
        );
      })
      .slice(0, 5); // Limit to 5 directories to avoid timeout

    if (directoryUrls.length > 0 && !shutdownRequested) {
      log(`   📂 Phase 3: Crawling ${directoryUrls.length} directories for more camps...`);

      for (const dir of directoryUrls) {
        if (shutdownRequested) break;
        log(`      📂 Crawling: ${dir.domain}`);

        try {
          await page.goto(dir.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(3000);

          // Extract all external links that look like camp websites
          const campLinks = await page.evaluate(() => {
            const links: Array<{ url: string; title: string }> = [];
            const seenUrls = new Set<string>();

            document.querySelectorAll('a[href^="http"]').forEach((a: Element) => {
              const href = a.getAttribute('href');
              if (!href || seenUrls.has(href)) return;

              // Skip internal links and common non-camp sites
              const url = new URL(href);
              const domain = url.hostname.replace(/^www\./, '');
              if (domain === window.location.hostname) return;
              if (/facebook|twitter|instagram|linkedin|youtube|google|yelp|tripadvisor/i.test(domain)) return;

              seenUrls.add(href);
              const title = (a as HTMLAnchorElement).textContent?.trim() || '';
              if (title.length > 2) {
                links.push({ url: href, title });
              }
            });

            return links;
          });

          let newFromDir = 0;
          for (const link of campLinks) {
            const domain = extractDomainFromUrl(link.url);
            if (!domain || seenDomains.has(domain)) continue;
            if (shouldSkipDiscoveryUrl(link.url)) continue;

            seenDomains.add(domain);
            discoveredUrls.push({ url: link.url, source: `directory:${dir.domain}`, title: link.title, domain });
            newFromDir++;
          }
          log(`      ✓ Found ${newFromDir} new camps from ${dir.domain}`);
          await page.waitForTimeout(2000);
        } catch (e) {
          log(`      ⚠️ Directory crawl error: ${e instanceof Error ? e.message.slice(0, 50) : 'unknown'}`);
        }
      }
    }

    // Close Stagehand
    await stagehand.close();
    stagehand = null;

    log(
      `   ✅ Discovery complete: ${discoveredUrls.length} URLs from ${searchesCompleted}/${totalSearches} searches + directory crawl`,
    );

    // Process results and create organizations
    if (discoveredUrls.length > 0) {
      log(`   📥 Creating organizations from discovered URLs...`);

      const result = await client.action(api.scraping.marketDiscoveryAction.processDiscoveryResults, {
        taskId: task._id as any,
        discoveredUrls,
      });

      log(
        `   ✅ Created ${result.orgsCreated} orgs, ${result.orgsExisted} existed, ${result.sourcesCreated} scraper requests queued`,
      );
    } else {
      // No URLs found - mark as completed with zeros
      await client.mutation(api.scraping.marketDiscovery.completeDiscoveryTask, {
        taskId: task._id as any,
        orgsCreated: 0,
        orgsExisted: 0,
        sourcesCreated: 0,
      });
      log(`   ⚠️ No camp URLs discovered`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`   ❌ Discovery failed: ${errorMsg}`);

    await client.mutation(api.scraping.marketDiscovery.failDiscoveryTask, {
      taskId: task._id as any,
      error: errorMsg,
    });

    if (stagehand) {
      try {
        await stagehand.close();
      } catch {}
    }
  }
}
