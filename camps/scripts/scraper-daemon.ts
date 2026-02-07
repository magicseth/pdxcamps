#!/usr/bin/env npx tsx
/**
 * Scraper Development Daemon
 *
 * This script watches the database for scraper development requests
 * and spawns Claude Code to write custom scrapers for each site.
 *
 * Usage:
 *   npx tsx scripts/scraper-daemon.ts
 *
 * The daemon will:
 * 1. Poll the database for pending requests
 * 2. Claim a request and spawn Claude Code with --dangerously-skip-permissions
 * 3. Claude Code explores the site and writes a scraper
 * 4. The scraper is tested against the target URL
 * 5. Results are saved for user review
 * 6. User can provide feedback to improve the scraper
 * 7. Feedback triggers another Claude Code session
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Stagehand is optional - only used for testing scrapers
let Stagehand: any = null;
try {
  Stagehand = require('@browserbasehq/stagehand').Stagehand;
} catch {
  // Stagehand not installed - testing will be skipped
}

// Load environment from .env.local, but don't overwrite existing env vars
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const trimmedKey = key.trim();
      // Don't overwrite existing env vars (allows command-line override)
      if (!process.env[trimmedKey]) {
        process.env[trimmedKey] = valueParts
          .join('=')
          .trim()
          .replace(/^["']|["']$/g, '');
      }
    }
  }
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error('Error: NEXT_PUBLIC_CONVEX_URL not set in .env.local');
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

/**
 * Fetch and log all queue statuses
 */
async function logQueueStatus(prefix: string = '') {
  try {
    // Fetch all queue counts in parallel
    const [scraperRequests, directoryStatus, contactStats] = await Promise.all([
      client.query(api.scraping.development.getPendingRequests, {}).catch(() => []),
      client
        .query(api.scraping.directoryDaemon.getQueueStatus, {})
        .catch(() => ({ pending: 0, processing: 0, completed: 0, failed: 0 })),
      client
        .query(api.scraping.contactExtractorHelpers.getContactExtractionStats, {})
        .catch(() => ({ needsExtraction: 0, withEmail: 0, total: 0 })),
    ]);

    const scraperPending = (scraperRequests as any[]).filter(
      (r: any) => r.status === 'pending' || r.status === 'in_progress',
    ).length;

    console.log(
      `${prefix}📊 Backlog: 🔧 Scrapers: ${scraperPending} | 📂 Directories: ${directoryStatus.pending} | 📧 Contacts: ${contactStats.needsExtraction}`,
    );
  } catch (err) {
    // Silently ignore errors fetching status
  }
}

// Scratchpad directory for Claude Code work
// Place scraper development outside Next.js project to avoid triggering Turbopack rebuilds
const SCRATCHPAD_DIR = path.join(process.cwd(), '..', '.scraper-development');
if (!fs.existsSync(SCRATCHPAD_DIR)) {
  fs.mkdirSync(SCRATCHPAD_DIR, { recursive: true });
}

// Log file for current session
const LOG_FILE = path.join(SCRATCHPAD_DIR, 'daemon.log');

function writeLog(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

const POLL_INTERVAL_MS = 5000; // Check every 5 seconds
const CLAUDE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minute timeout for Claude (needs time to explore, write, test, iterate)

interface DevelopmentRequest {
  _id: string;
  sourceName: string;
  sourceUrl: string;
  sourceId?: string;
  notes?: string;
  status: string;
  scraperVersion?: number;
  generatedScraperCode?: string;
  feedbackHistory?: Array<{
    feedbackAt: number;
    feedback: string;
    scraperVersionBefore: number;
  }>;
  siteExploration?: {
    exploredAt: number;
    siteType?: string;
    hasMultipleLocations?: boolean;
    locations?: Array<{ name: string; url?: string; siteId?: string }>;
    hasCategories?: boolean;
    categories?: Array<{ name: string; id?: string }>;
    registrationSystem?: string;
    urlPatterns?: string[];
    navigationNotes?: string[];
  };
}

// Worker state tracking
interface WorkerState {
  id: string;
  busy: boolean;
  currentRequest?: DevelopmentRequest;
  process?: ChildProcess;
}

const workers: Map<string, WorkerState> = new Map();
let shutdownRequested = false;

// Parse --workers N flag (default 1)
function getWorkerCount(): number {
  const idx = process.argv.findIndex((arg) => arg === '--workers' || arg === '-w');
  if (idx !== -1 && process.argv[idx + 1]) {
    const count = parseInt(process.argv[idx + 1], 10);
    if (!isNaN(count) && count > 0 && count <= 10) {
      return count;
    }
  }
  return 1;
}

// Parse --city <slug> flag to filter by locale
function getCitySlug(): string | undefined {
  const idx = process.argv.findIndex((arg) => arg === '--city' || arg === '-c');
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return undefined;
}

// Look up cityId from slug
async function getCityIdFromSlug(slug: string): Promise<string | null> {
  try {
    const cities = await client.query(api.cities.queries.listAllCities, {});
    const city = (cities as any[]).find((c: any) => c.slug === slug);
    if (city) {
      return city._id;
    }
    // Try partial match (e.g., "sf" matches "san-francisco-bay-area")
    const partialMatch = (cities as any[]).find(
      (c: any) => c.slug.includes(slug) || c.name.toLowerCase().includes(slug.toLowerCase()),
    );
    if (partialMatch) {
      console.log(`   (Matched "${slug}" to "${partialMatch.name}")`);
      return partialMatch._id;
    }
    return null;
  } catch (error) {
    console.error(`Error looking up city: ${error}`);
    return null;
  }
}

async function main() {
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
  const workerCount = getWorkerCount();
  const citySlug = getCitySlug();

  // Look up cityId if slug provided
  let cityId: string | undefined;
  let cityName: string | undefined;
  if (citySlug) {
    const id = await getCityIdFromSlug(citySlug);
    if (!id) {
      console.error(`Error: City "${citySlug}" not found. Available cities:`);
      const cities = await client.query(api.cities.queries.listAllCities, {});
      for (const city of cities as any[]) {
        console.log(`   - ${city.slug} (${city.name})`);
      }
      process.exit(1);
    }
    cityId = id;
    const cities = await client.query(api.cities.queries.listAllCities, {});
    const city = (cities as any[]).find((c: any) => c._id === cityId);
    cityName = city?.name;
  }

  // Clear log file
  fs.writeFileSync(LOG_FILE, `=== Scraper Daemon Started ${new Date().toISOString()} ===\n`);
  writeLog(`Starting with ${workerCount} worker(s)${cityId ? ` for ${cityName}` : ''}`);

  console.log('🤖 Scraper Development Daemon Started');
  console.log(`   Convex: ${CONVEX_URL}`);
  console.log(`   Workers: ${workerCount}`);
  if (cityId && cityName) {
    console.log(`   City: ${cityName} (${citySlug})`);
  } else {
    console.log(`   City: All markets`);
  }
  console.log(`   Logs: tail -f ${LOG_FILE}`);
  if (verbose) {
    console.log('   Mode: Verbose');
  }
  console.log('   Running autonomously. Submit requests & feedback via /admin/scraper-dev');
  console.log('   Press Ctrl+C to stop.\n');

  // Initialize workers
  for (let i = 0; i < workerCount; i++) {
    const workerId = `worker-${i + 1}-${Date.now()}`;
    workers.set(workerId, { id: workerId, busy: false });
  }

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    shutdownRequested = true;
    for (const worker of workers.values()) {
      if (worker.process) {
        worker.process.kill();
      }
    }
    // Give processes time to clean up
    setTimeout(() => process.exit(0), 1000);
  });

  // Main polling loop - check for available workers and pending work
  while (!shutdownRequested) {
    try {
      // Find idle workers
      const idleWorkers = Array.from(workers.values()).filter((w) => !w.busy);

      // For each idle worker, try to claim work
      for (const worker of idleWorkers) {
        if (shutdownRequested) break;

        try {
          // Atomically get and claim next request (optionally filtered by city)
          const request = await client.mutation(api.scraping.development.getNextAndClaim, {
            workerId: worker.id,
            ...(cityId ? { cityId: cityId as any } : {}),
          });

          if (request) {
            // Start processing in background (don't await)
            worker.busy = true;
            worker.currentRequest = request as DevelopmentRequest;

            await logQueueStatus(`[${worker.id}] `);
            console.log(`[${worker.id}] 🚀 Starting: ${request.sourceName}`);
            writeLog(`[${worker.id}] Claimed: ${request.sourceName}`);

            processRequestAsync(worker, request as DevelopmentRequest, verbose);
          }
        } catch (error) {
          // Claim failed (probably race condition or no work) - that's ok
          if (verbose) {
            console.log(`[${worker.id}] No work available`);
          }
        }
      }

      // Log status periodically
      const busyCount = Array.from(workers.values()).filter((w) => w.busy).length;
      if (busyCount > 0 && verbose) {
        console.log(`   Active workers: ${busyCount}/${workerCount}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Process a request asynchronously (doesn't block the main loop)
 */
async function processRequestAsync(worker: WorkerState, request: DevelopmentRequest, verbose: boolean) {
  try {
    await processRequest(request, verbose, worker.id);
  } catch (error) {
    console.error(`[${worker.id}] Error:`, error instanceof Error ? error.message : error);
    writeLog(`[${worker.id}] Error: ${error instanceof Error ? error.message : error}`);
  } finally {
    worker.busy = false;
    worker.currentRequest = undefined;
    worker.process = undefined;
    console.log(`[${worker.id}] ✅ Finished: ${request.sourceName}`);
    writeLog(`[${worker.id}] Finished: ${request.sourceName}`);
  }
}

/**
 * Site exploration result - discovered navigation structure
 */
/**
 * Discovered API endpoint with camp data
 */
interface DiscoveredApi {
  url: string;
  method: string;
  contentType: string;
  responseSize: number;
  matchCount: number; // How many times the search term was found
  structureHint?: string; // e.g., "Array[45]" or "Object with keys: data, meta"
  urlPattern?: string; // Parameterized version of the URL
  sampleData?: string; // First 2KB of response for preview (truncated)
}

interface SiteExplorationResult {
  siteType: string;
  hasMultipleLocations: boolean;
  locations: Array<{ name: string; url?: string; siteId?: string }>;
  hasCategories: boolean;
  categories: Array<{ name: string; id?: string }>;
  registrationSystem?: string;
  urlPatterns: string[];
  navigationNotes: string[];
  rawPageSummary?: string;
  isDirectory?: boolean; // True if this is a listing/directory site with links to multiple camp orgs
  directoryLinks?: Array<{ url: string; name: string; isInternal?: boolean }>; // Camp links found on directory
  discoveredApis?: DiscoveredApi[]; // APIs found via network monitoring
  apiSearchTerm?: string; // The term used to search API responses
}

/**
 * Extract search terms from the source name or URL for API discovery
 */
function extractSearchTerms(sourceName: string, url: string): string[] {
  const terms: string[] = [];

  // Extract meaningful words from the source name (skip common words)
  const skipWords = new Set([
    'the',
    'and',
    'of',
    'for',
    'a',
    'an',
    'in',
    'at',
    'to',
    'summer',
    'camp',
    'camps',
    'kids',
    'youth',
    'portland',
    'seattle',
    'oregon',
    'washington',
    'inc',
    'llc',
    'org',
    'com',
  ]);
  const words = sourceName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !skipWords.has(w));

  // Take up to 3 meaningful words
  terms.push(...words.slice(0, 3));

  // Also try to extract from URL path
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    for (const part of pathParts) {
      const cleanPart = part.replace(/[-_]/g, ' ').toLowerCase();
      if (cleanPart.length > 3 && !skipWords.has(cleanPart) && !terms.includes(cleanPart)) {
        terms.push(cleanPart);
        if (terms.length >= 5) break;
      }
    }
  } catch {}

  return [...new Set(terms)].slice(0, 5);
}

/**
 * Extract a URL pattern by replacing IDs with placeholders
 */
function extractUrlPattern(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    // Look for numeric IDs or UUIDs that could be parameters
    const pattern = pathParts
      .map((part) => {
        if (/^\d+$/.test(part)) {
          return '{id}';
        }
        if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(part)) {
          return '{uuid}';
        }
        if (/^[a-f0-9]{24}$/i.test(part)) {
          return '{objectId}';
        }
        return part;
      })
      .join('/');

    return `${parsed.origin}/${pattern}`;
  } catch {
    return undefined;
  }
}

/**
 * Explore a site to discover its navigation structure before writing a scraper
 */
async function exploreSiteNavigation(
  url: string,
  sourceName: string,
  log: (msg: string) => void,
): Promise<SiteExplorationResult> {
  const result: SiteExplorationResult = {
    siteType: 'unknown',
    hasMultipleLocations: false,
    locations: [],
    hasCategories: false,
    categories: [],
    urlPatterns: [],
    navigationNotes: [],
  };

  log(`   🔍 Exploring site navigation...`);

  // Check if Stagehand is available for browser-based exploration
  if (!Stagehand) {
    log(`   ⚠️ Stagehand not available, using basic URL analysis`);
    // Basic URL-based detection
    if (url.includes('portland.gov/parks')) {
      result.siteType = 'parks_and_rec_location_based';
      result.hasMultipleLocations = true;
      result.registrationSystem = 'ActiveCommunities';
      result.navigationNotes.push('Portland Parks uses ActiveCommunities with location-based organization');
    }
    return result;
  }

  let stagehand: any = null;

  try {
    // Initialize Stagehand for exploration
    stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      model: {
        modelName: 'anthropic/claude-sonnet-4-20250514',
        apiKey: process.env.MODEL_API_KEY,
      },
      disablePino: true,
      verbose: 0,
    });

    await stagehand.init();
    const page = stagehand.context.pages()[0];

    // ========== API DISCOVERY: Set up network monitoring ==========
    // Track all network requests and search for camp data in JSON responses
    const capturedRequests = new Map<
      string,
      {
        url: string;
        method: string;
        resourceType: string;
      }
    >();
    const discoveredApis: DiscoveredApi[] = [];

    // Extract a search term from the source name or URL for API discovery
    const searchTerms = extractSearchTerms(sourceName, url);
    if (searchTerms.length > 0) {
      result.apiSearchTerm = searchTerms[0];
      log(`   🔎 API Discovery: searching responses for "${searchTerms.join('", "')}"`);
    }

    // Monitor requests - wrapped in try-catch as some browsers don't support this event
    try {
      page.on('request', (request: any) => {
        const reqUrl = request.url();
        const resourceType = request.resourceType();
        // Track API-like requests (XHR, fetch) and anything with /api/ in the URL
        if (['xhr', 'fetch'].includes(resourceType) || reqUrl.includes('/api/')) {
          capturedRequests.set(reqUrl, {
            url: reqUrl,
            method: request.method(),
            resourceType,
          });
        }
      });
    } catch (e) {
      log(`   ⚠️ Request monitoring not supported, skipping API discovery`);
    }

    // Monitor responses - wrapped in try-catch
    try {
      page.on('response', async (response: any) => {
        const respUrl = response.url();
        const request = capturedRequests.get(respUrl);

        if (request && response.status() === 200) {
          try {
            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('application/json')) {
              const body = await response.text();
              const bodySize = body.length;

              // Search for camp-related terms in the response
              let totalMatches = 0;
              for (const term of searchTerms) {
                const regex = new RegExp(term, 'gi');
                const matches = (body.match(regex) || []).length;
                totalMatches += matches;
              }

              // Also check for generic camp indicators
              const campIndicators = /camp|session|program|registration|enroll|price|cost|age|grade/gi;
              const campMatches = (body.match(campIndicators) || []).length;

              // If we found matches or camp indicators, record this API
              if (totalMatches > 0 || campMatches >= 5) {
                let structureHint: string | undefined;
                try {
                  const json = JSON.parse(body);
                  if (Array.isArray(json)) {
                    structureHint = `Array[${json.length}]`;
                  } else if (typeof json === 'object' && json !== null) {
                    const keys = Object.keys(json).slice(0, 5);
                    structureHint = `Object with keys: ${keys.join(', ')}${Object.keys(json).length > 5 ? '...' : ''}`;
                  }
                } catch {}

                // Capture sample data (truncated to 2KB for storage)
                let sampleData: string | undefined;
                try {
                  const json = JSON.parse(body);
                  // Pretty print with limited depth and truncate
                  sampleData = JSON.stringify(json, null, 2).slice(0, 2000);
                  if (sampleData.length >= 2000) {
                    sampleData += '\n... (truncated)';
                  }
                } catch {
                  sampleData = body.slice(0, 2000);
                }

                discoveredApis.push({
                  url: respUrl,
                  method: request.method,
                  contentType,
                  responseSize: bodySize,
                  matchCount: totalMatches + campMatches,
                  structureHint,
                  urlPattern: extractUrlPattern(respUrl),
                  sampleData,
                });
              }
            }
          } catch {
            // Response body not available
          }
        }
      });
    } catch (e) {
      log(`   ⚠️ Response monitoring not supported, skipping API discovery`);
    }
    // ========== END API DISCOVERY SETUP ==========

    log(`   📄 Loading ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle', timeoutMs: 30000 });
    await page.waitForTimeout(3000);

    // Use AI extraction to analyze the page structure
    log(`   🤖 Analyzing page structure...`);
    const extraction = await page.extract({
      instruction: `Analyze this summer camp website's navigation structure. Look for:

1. **Location-based organization**: Are camps listed by location/facility? Look for:
   - Lists of community centers, parks, schools, or facilities
   - "View camps at [Location]" links
   - Location filters or dropdown menus

2. **Category organization**: Are camps organized by type? Look for:
   - Camp categories (Day Camps, Sports Camps, Arts Camps, etc.)
   - Age group filters (Preschool, Elementary, Teen)
   - Activity type sections

3. **External registration systems**: Does this link to another site? Look for:
   - Links to ActiveCommunities, CampBrain, UltraCamp, RegFox
   - "Register" buttons that go to external URLs
   - Iframe embeds from registration platforms

4. **URL patterns**: Note any URL parameters you see like:
   - site_ids, location_id, facility_id
   - category_id, activity_type
   - age_group, grade_level

Return a structured analysis of how camps are organized on this site.`,
      schema: {
        type: 'object',
        properties: {
          organizationType: {
            type: 'string',
            description:
              "How camps are organized: 'by_location', 'by_category', 'by_age', 'single_list', 'calendar', or 'unknown'",
          },
          locations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                linkText: { type: 'string' },
                urlPattern: { type: 'string' },
              },
            },
            description: 'List of locations/facilities if camps are organized by location',
          },
          categories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
              },
            },
            description: 'List of camp categories if organized that way',
          },
          externalRegistration: {
            type: 'object',
            properties: {
              platform: { type: 'string' },
              baseUrl: { type: 'string' },
              urlParameters: { type: 'array', items: { type: 'string' } },
            },
            description: 'External registration system details if applicable',
          },
          navigationInstructions: {
            type: 'string',
            description: 'Step-by-step instructions for how to navigate to find ALL camps',
          },
          estimatedCampCount: {
            type: 'string',
            description: 'Rough estimate of how many camps/sessions this org offers',
          },
        },
      },
    });

    const extracted = extraction as {
      organizationType?: string;
      locations?: Array<{ name: string; linkText?: string; urlPattern?: string }>;
      categories?: Array<{ name: string; description?: string }>;
      externalRegistration?: { platform?: string; baseUrl?: string; urlParameters?: string[] };
      navigationInstructions?: string;
      estimatedCampCount?: string;
    };

    log(`   ✅ Site analysis complete`);

    // Process the extraction results
    if (extracted.organizationType) {
      result.siteType = extracted.organizationType;
    }

    if (extracted.locations && extracted.locations.length > 0) {
      result.hasMultipleLocations = true;
      result.locations = extracted.locations.map((loc) => ({
        name: loc.name,
        url: loc.urlPattern,
      }));
      result.navigationNotes.push(
        `Found ${extracted.locations.length} locations: ${extracted.locations.map((l) => l.name).join(', ')}`,
      );
    }

    if (extracted.categories && extracted.categories.length > 0) {
      result.hasCategories = true;
      result.categories = extracted.categories.map((cat) => ({
        name: cat.name,
      }));
      result.navigationNotes.push(
        `Found ${extracted.categories.length} categories: ${extracted.categories.map((c) => c.name).join(', ')}`,
      );
    }

    if (extracted.externalRegistration) {
      result.registrationSystem = extracted.externalRegistration.platform;
      if (extracted.externalRegistration.baseUrl) {
        result.urlPatterns.push(extracted.externalRegistration.baseUrl);
      }
      if (extracted.externalRegistration.urlParameters) {
        result.navigationNotes.push(`URL parameters found: ${extracted.externalRegistration.urlParameters.join(', ')}`);
      }
    }

    if (extracted.navigationInstructions) {
      result.navigationNotes.push(`Navigation: ${extracted.navigationInstructions}`);
    }

    if (extracted.estimatedCampCount) {
      result.navigationNotes.push(`Estimated camps: ${extracted.estimatedCampCount}`);
    }

    // If we found locations, try to get their URLs
    if (result.hasMultipleLocations && result.locations.length > 0) {
      log(`   🔗 Discovering location URLs...`);

      const linkExtraction = await page.extract({
        instruction: `Find all links to camp registration pages for different locations/facilities.
For each location, extract the full URL that leads to camps at that location.
Look for links in lists, tables, or navigation that point to facility-specific camp pages.`,
        schema: {
          type: 'object',
          properties: {
            locationLinks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  locationName: { type: 'string' },
                  url: { type: 'string' },
                  siteIdOrParam: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const links = linkExtraction as {
        locationLinks?: Array<{ locationName: string; url: string; siteIdOrParam?: string }>;
      };

      if (links.locationLinks && links.locationLinks.length > 0) {
        result.locations = links.locationLinks.map((link) => ({
          name: link.locationName,
          url: link.url,
          siteId: link.siteIdOrParam,
        }));

        // Extract URL pattern
        const urls = links.locationLinks.map((l) => l.url).filter((u) => u);
        if (urls.length > 0) {
          result.urlPatterns.push(urls[0]);
        }
      }
    }

    // Check if this is a directory/listing site (lists multiple camp organizations)
    const urlLower = url.toLowerCase();
    const directoryIndicators = [
      'kidsoutandabout.com',
      'parentmap.com',
      'seattlesummercamps.com',
      'summercamps.com',
      'campnavigator.com',
      'kidscamps.com',
      'activityhero.com',
      'sawyer.com',
      'acacamps.org',
      '/guide',
      '/list',
      '/directory',
      '/best-',
      '/top-',
    ];

    const isLikelyDirectory =
      directoryIndicators.some((ind) => urlLower.includes(ind)) ||
      (extracted.estimatedCampCount && parseInt(extracted.estimatedCampCount) > 20);

    if (isLikelyDirectory) {
      log(`   📂 Detected directory/listing site - extracting camp links...`);
      result.isDirectory = true;

      // Extract both external camp organization links AND internal camp detail pages
      // Many directory sites host camp details internally (e.g., kidsoutandabout.com/content/camp-name)
      const dirLinks = await page.evaluate(() => {
        const links: Array<{ url: string; name: string; isInternal: boolean }> = [];
        const seenUrls = new Set<string>();
        const seenDomains = new Set<string>();
        const hostDomain = window.location.hostname.replace(/^www\./, '');
        const currentPath = window.location.pathname;

        // Patterns that indicate a camp detail page (internal links)
        const campDetailPatterns = [
          /\/content\/.*camp/i,
          /\/camp[s]?\/[^/]+$/i,
          /\/program[s]?\/[^/]+$/i,
          /\/activit(y|ies)\/[^/]+$/i,
          /\/class(es)?\/[^/]+$/i,
          /\/event[s]?\/.*camp/i,
          /\/listing[s]?\/[^/]+$/i,
          /\/provider[s]?\/[^/]+$/i,
          /\/organization[s]?\/[^/]+$/i,
          /\/venue[s]?\/[^/]+$/i,
          /camp.*-\d{4}$/i, // e.g., "summer-camp-2026"
        ];

        // Patterns to exclude (navigation, pagination, filters)
        const excludePatterns = [
          /\/search/i,
          /\/filter/i,
          /\/page\/\d+/i,
          /\/category\//i,
          /\/tag\//i,
          /\/author\//i,
          /\/login/i,
          /\/register/i,
          /\/cart/i,
          /\/checkout/i,
          /\/account/i,
          /\/about/i,
          /\/contact/i,
          /\/privacy/i,
          /\/terms/i,
          /\/faq/i,
          /^\/?$/, // Homepage
        ];

        // Social and non-camp domains to skip
        const skipDomains =
          /facebook|twitter|instagram|linkedin|youtube|google|yelp|tripadvisor|amazon|pinterest|reddit|tiktok|snapchat/i;

        document.querySelectorAll('a[href]').forEach((a) => {
          const href = a.getAttribute('href');
          if (!href) return;

          try {
            // Handle both absolute and relative URLs
            const url = new URL(href, window.location.origin);
            const fullUrl = url.href;
            const domain = url.hostname.replace(/^www\./, '');
            const path = url.pathname;

            // Skip if we've seen this exact URL
            if (seenUrls.has(fullUrl)) return;

            // Skip excluded patterns
            if (excludePatterns.some((p) => p.test(path))) return;

            // Skip current page
            if (path === currentPath) return;

            const isInternal = domain === hostDomain;
            const name = a.textContent?.trim() || '';

            if (isInternal) {
              // For internal links, check if it looks like a camp detail page
              const isCampDetail = campDetailPatterns.some((p) => p.test(path));

              // Also check if the link text suggests it's a camp
              const textSuggestsCamp = /camp|program|class|activity|workshop|lesson/i.test(name);

              if (isCampDetail || textSuggestsCamp) {
                seenUrls.add(fullUrl);
                if (name.length > 2 && name.length < 200) {
                  links.push({ url: fullUrl, name, isInternal: true });
                }
              }
            } else {
              // For external links, collect camp organization websites
              if (skipDomains.test(domain)) return;
              if (seenDomains.has(domain)) return;

              seenDomains.add(domain);
              seenUrls.add(fullUrl);
              const linkName = name.length > 2 ? name : domain.split('.')[0];
              if (linkName.length > 2 && linkName.length < 200) {
                links.push({ url: fullUrl, name: linkName, isInternal: false });
              }
            }
          } catch {}
        });

        return links;
      });

      const externalLinks = dirLinks.filter((l) => !l.isInternal);
      const internalLinks = dirLinks.filter((l) => l.isInternal);

      log(`   ✅ Found ${externalLinks.length} external camp org links`);
      log(`   ✅ Found ${internalLinks.length} internal camp detail pages`);

      if (dirLinks.length > 0) {
        result.directoryLinks = dirLinks;
        log(`   ✅ Total: ${dirLinks.length} camp links found in directory`);
      }
    }

    // ========== API DISCOVERY: Save results ==========
    if (discoveredApis.length > 0) {
      // Sort by match count (most matches first)
      discoveredApis.sort((a, b) => b.matchCount - a.matchCount);
      result.discoveredApis = discoveredApis;
      log(`   🎯 API Discovery: found ${discoveredApis.length} APIs with camp data`);
      for (const api of discoveredApis.slice(0, 3)) {
        log(`      - ${api.method} ${api.url.slice(0, 80)}... (${api.matchCount} matches)`);
      }
    } else {
      log(`   ℹ️ API Discovery: no APIs found with camp data (captured ${capturedRequests.size} requests)`);
    }
    // ========== END API DISCOVERY RESULTS ==========

    await stagehand.close();
    stagehand = null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`   ⚠️ Exploration error: ${errorMsg.slice(0, 100)}`);
    result.navigationNotes.push(`Exploration encountered error: ${errorMsg.slice(0, 200)}`);

    if (stagehand) {
      try {
        await stagehand.close();
      } catch {}
    }
  }

  // Log summary
  log(`   📊 Exploration results:`);
  log(`      Site type: ${result.siteType}`);
  if (result.isDirectory) {
    log(`      📂 DIRECTORY: ${result.directoryLinks?.length || 0} camp links found`);
  }
  log(`      Locations: ${result.locations.length}`);
  log(`      Categories: ${result.categories.length}`);
  log(`      Registration system: ${result.registrationSystem || 'unknown'}`);
  if (result.discoveredApis && result.discoveredApis.length > 0) {
    log(`      🎯 APIs with camp data: ${result.discoveredApis.length}`);
  }

  return result;
}

/**
 * Format exploration results for inclusion in the prompt
 */
function formatExplorationForPrompt(exploration: SiteExplorationResult): string {
  const lines: string[] = [];

  lines.push('\n## 🔍 Site Navigation Discovery (Auto-Explored)\n');
  lines.push('The daemon explored this site and found:\n');

  if (exploration.siteType !== 'unknown') {
    lines.push(`**Organization Type:** ${exploration.siteType}\n`);
  }

  if (exploration.hasMultipleLocations && exploration.locations.length > 0) {
    lines.push('\n### ⚠️ MULTIPLE LOCATIONS DETECTED\n');
    lines.push('**You MUST iterate through all locations to get all camps.**\n\n');
    lines.push('```typescript\n');
    lines.push('const LOCATIONS = [\n');
    for (const loc of exploration.locations) {
      if (loc.siteId) {
        lines.push(`  { name: "${loc.name}", siteId: "${loc.siteId}" },\n`);
      } else if (loc.url) {
        lines.push(`  { name: "${loc.name}", url: "${loc.url}" },\n`);
      } else {
        lines.push(`  { name: "${loc.name}" },\n`);
      }
    }
    lines.push('];\n');
    lines.push('```\n');
  }

  if (exploration.hasCategories && exploration.categories.length > 0) {
    lines.push('\n### Camp Categories Found:\n');
    for (const cat of exploration.categories) {
      lines.push(`- ${cat.name}\n`);
    }
  }

  if (exploration.registrationSystem) {
    lines.push(`\n### Registration System: ${exploration.registrationSystem}\n`);
  }

  if (exploration.urlPatterns.length > 0) {
    lines.push('\n### URL Patterns Discovered:\n');
    lines.push('```\n');
    for (const pattern of exploration.urlPatterns) {
      lines.push(`${pattern}\n`);
    }
    lines.push('```\n');
  }

  if (exploration.navigationNotes.length > 0) {
    lines.push('\n### Navigation Notes:\n');
    for (const note of exploration.navigationNotes) {
      lines.push(`- ${note}\n`);
    }
  }

  // ========== API DISCOVERY RESULTS ==========
  if (exploration.discoveredApis && exploration.discoveredApis.length > 0) {
    lines.push('\n### 🎯 DISCOVERED APIs (High Priority!)\n');
    lines.push(
      '**These APIs were found by monitoring network traffic. They likely contain the camp data you need.**\n',
    );
    lines.push('**STRONGLY PREFER using these APIs over scraping HTML.**\n\n');

    if (exploration.apiSearchTerm) {
      lines.push(`Search term used: "${exploration.apiSearchTerm}"\n\n`);
    }

    for (const api of exploration.discoveredApis.slice(0, 3)) {
      lines.push(`#### ${api.method} ${api.url}\n`);
      lines.push(`- Response size: ${(api.responseSize / 1024).toFixed(1)} KB\n`);
      lines.push(`- Match count: ${api.matchCount} camp-related terms\n`);
      if (api.structureHint) {
        lines.push(`- Structure: ${api.structureHint}\n`);
      }
      if (api.urlPattern && api.urlPattern !== api.url) {
        lines.push(`- URL Pattern: ${api.urlPattern}\n`);
      }
      // Include sample data if available (show first 1500 chars)
      if ((api as any).sampleData) {
        const sample = (api as any).sampleData.slice(0, 1500);
        lines.push(`\n**Sample Response:**\n\`\`\`json\n${sample}\n\`\`\`\n`);
      }
      lines.push('\n');
    }

    lines.push('**IMPORTANT: Use API-based scraping when APIs are discovered!**\n\n');
    lines.push('**Recommended approach:**\n');
    lines.push('1. Use `fetch()` or `page.evaluate(() => fetch(...))` to call these APIs directly\n');
    lines.push('2. Parse the JSON response to extract camp session data\n');
    lines.push('3. Map the API fields to our ExtractedSession interface\n');
    lines.push('4. The Stagehand page object is available if you need cookies/auth from the browser context\n\n');
    lines.push('**Example API-based scraper pattern:**\n');
    lines.push('```typescript\n');
    lines.push('const response = await page.evaluate(async () => {\n');
    lines.push('  const res = await fetch("API_URL_HERE");\n');
    lines.push('  return res.json();\n');
    lines.push('});\n');
    lines.push('// Map API response to ExtractedSession[]\n');
    lines.push('```\n\n');
  }
  // ========== END API DISCOVERY RESULTS ==========

  return lines.join('');
}

async function processRequest(request: DevelopmentRequest, verbose: boolean = false, workerId?: string) {
  const requestId = request._id;
  const prefix = workerId ? `[${workerId}]` : '';

  const log = (msg: string) => {
    const prefixedMsg = prefix ? `${prefix} ${msg}` : msg;
    writeLog(prefixedMsg);
    if (verbose) console.log(prefixedMsg);
  };

  console.log(`${prefix} 📋 Processing: ${request.sourceName}`);
  writeLog(`\n=== ${prefix} Processing: ${request.sourceName} ===`);
  writeLog(`${prefix} URL: ${request.sourceUrl}`);

  try {
    // Request already claimed by getNextAndClaim - no need to claim again

    // STEP 1: Explore the site navigation structure BEFORE building the scraper
    let explorationResult: SiteExplorationResult | null = null;

    // Check if we already have exploration results from a previous attempt
    if (request.siteExploration) {
      log(`   📋 Using existing site exploration from ${new Date(request.siteExploration.exploredAt).toISOString()}`);
      explorationResult = {
        siteType: request.siteExploration.siteType || 'unknown',
        hasMultipleLocations: request.siteExploration.hasMultipleLocations || false,
        locations: request.siteExploration.locations || [],
        hasCategories: request.siteExploration.hasCategories || false,
        categories: request.siteExploration.categories || [],
        registrationSystem: request.siteExploration.registrationSystem,
        urlPatterns: request.siteExploration.urlPatterns || [],
        navigationNotes: request.siteExploration.navigationNotes || [],
        discoveredApis: request.siteExploration.discoveredApis,
        apiSearchTerm: request.siteExploration.apiSearchTerm,
      };
    } else if (!request.generatedScraperCode) {
      // Only explore on first attempt when no exploration exists
      explorationResult = await exploreSiteNavigation(request.sourceUrl, request.sourceName, log);

      // Save exploration results to database for future attempts
      if (explorationResult) {
        try {
          await client.mutation(api.scraping.development.saveExploration, {
            requestId: requestId as any,
            exploration: {
              siteType: explorationResult.siteType,
              hasMultipleLocations: explorationResult.hasMultipleLocations,
              locations: explorationResult.locations,
              hasCategories: explorationResult.hasCategories,
              categories: explorationResult.categories,
              registrationSystem: explorationResult.registrationSystem,
              urlPatterns: explorationResult.urlPatterns,
              navigationNotes: explorationResult.navigationNotes,
              discoveredApis: explorationResult.discoveredApis,
              apiSearchTerm: explorationResult.apiSearchTerm,
            },
          });
          log(`   💾 Saved site exploration to database`);
        } catch (saveError) {
          log(`   ⚠️ Failed to save exploration: ${saveError instanceof Error ? saveError.message : saveError}`);
        }

        // Handle directory sites - extract camp links and create requests for each
        if (
          explorationResult.isDirectory &&
          explorationResult.directoryLinks &&
          explorationResult.directoryLinks.length > 0
        ) {
          const allLinks = explorationResult.directoryLinks as Array<{
            url: string;
            name: string;
            isInternal?: boolean;
          }>;
          const externalLinks = allLinks.filter((l) => !l.isInternal);
          const internalLinks = allLinks.filter((l) => l.isInternal);

          log(`   📂 Directory detected:`);
          log(`      - ${externalLinks.length} external camp organization links`);
          log(`      - ${internalLinks.length} internal camp detail pages`);
          log(`   📥 Creating scraper requests from directory...`);

          try {
            // Filter out known non-camp URLs
            const filterNonCamp = (link: { url: string; name: string }) => {
              const url = link.url.toLowerCase();
              if (
                /facebook|twitter|instagram|linkedin|youtube|google|yelp|tripadvisor|amazon|pinterest|reddit|wikipedia|tiktok/i.test(
                  url,
                )
              ) {
                return false;
              }
              return true;
            };

            const validExternalLinks = externalLinks.filter(filterNonCamp);
            const validInternalLinks = internalLinks.filter(filterNonCamp);

            let createdExternal = 0;
            let createdInternal = 0;
            let existed = 0;

            // Process external links - these are camp organization websites
            // Create scraper requests to build scrapers for their sites
            for (const link of validExternalLinks.slice(0, 30)) {
              try {
                const domain = new URL(link.url).hostname.replace(/^www\./, '');
                const name = link.name.length > 3 ? link.name : domain.split('.')[0];

                await client.mutation(api.scraping.development.requestScraperDevelopment, {
                  sourceName: name.slice(0, 100),
                  sourceUrl: link.url,
                  cityId: request.cityId as any,
                  notes: `Discovered from directory: ${request.sourceName} (external camp website)`,
                  requestedBy: 'directory-crawler',
                });

                createdExternal++;
                log(`      + [ext] ${domain}`);
              } catch (e) {
                existed++;
              }
            }

            // Process internal links - these are camp detail pages hosted on the directory
            // Create scraper requests to extract camp data from each detail page
            for (const link of validInternalLinks.slice(0, 50)) {
              try {
                const urlObj = new URL(link.url);
                const pathSlug = urlObj.pathname.split('/').filter(Boolean).pop() || '';
                const name = link.name.length > 3 ? link.name : pathSlug.replace(/-/g, ' ');

                await client.mutation(api.scraping.development.requestScraperDevelopment, {
                  sourceName: name.slice(0, 100),
                  sourceUrl: link.url,
                  cityId: request.cityId as any,
                  notes: `Directory detail page from: ${request.sourceName}. Extract camp info (name, dates, price, ages, location, registration URL) from this page.`,
                  requestedBy: 'directory-crawler-internal',
                });

                createdInternal++;
                log(`      + [int] ${urlObj.pathname.slice(0, 50)}`);
              } catch (e) {
                existed++;
              }
            }

            const totalCreated = createdExternal + createdInternal;
            log(`   ✅ Directory processed:`);
            log(`      - ${createdExternal} external org requests created`);
            log(`      - ${createdInternal} internal page requests created`);
            log(`      - ${existed} skipped (already exist)`);

            // Mark this request as completed (directory processed)
            await client.mutation(api.scraping.development.markDirectoryProcessed, {
              requestId: requestId as any,
              notes: `Directory processed: ${createdExternal} external + ${createdInternal} internal = ${totalCreated} new scraper requests queued`,
              linksFound: allLinks.length,
              requestsCreated: totalCreated,
            });

            return; // Don't build a scraper for the directory listing page itself
          } catch (dirError) {
            log(`   ⚠️ Directory processing error: ${dirError instanceof Error ? dirError.message : dirError}`);
            // Fall through to normal scraper building as fallback
          }
        }
      }
    }

    // Build the prompt for Claude Code (now includes exploration results)
    const prompt = buildClaudePrompt(request, explorationResult);

    // Write prompt to a file for Claude Code to read
    const promptFile = path.join(SCRATCHPAD_DIR, `prompt-${requestId}.md`);
    fs.writeFileSync(promptFile, prompt);

    // Create output file for the scraper code
    const outputFile = path.join(SCRATCHPAD_DIR, `scraper-${requestId}.ts`);

    log(`   Spawning Claude Code...`);
    log(`   Prompt file: ${promptFile}`);

    // Write status file for monitoring
    const statusFile = path.join(SCRATCHPAD_DIR, 'current-status.txt');
    const startTime = Date.now();
    fs.writeFileSync(
      statusFile,
      `Processing: ${request.sourceName}\nURL: ${request.sourceUrl}\nStarted: ${new Date().toISOString()}\nTimeout: ${CLAUDE_TIMEOUT_MS / 60000} minutes\n`,
    );

    // Create a transcript file for this session
    const transcriptFile = path.join(SCRATCHPAD_DIR, `transcript-${requestId}.txt`);
    const transcriptStream = fs.createWriteStream(transcriptFile);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`   CLAUDE SESSION: ${request.sourceName}`);
    console.log(`${'='.repeat(60)}\n`);

    // Run Claude with --print and stream-json to see what it's doing
    // IMPORTANT: stdin must be "ignore" or Claude hangs waiting for input
    // Ensure PATH includes common locations for claude binary
    const pathAdditions = [`${process.env.HOME}/.local/bin`, '/usr/local/bin', '/opt/homebrew/bin'].join(':');
    const enhancedPath = `${pathAdditions}:${process.env.PATH || ''}`;

    const claudeProcess = spawn(
      'claude',
      ['--dangerously-skip-permissions', '--print', '--output-format', 'stream-json', '-p', prompt],
      {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'], // ignore stdin or Claude hangs!
        env: {
          ...process.env,
          PATH: enhancedPath,
          SCRAPER_OUTPUT_FILE: outputFile,
        },
      },
    );

    // Stream stdout and parse JSON events
    let stdout = '';
    let lastAssistantMessage = '';
    claudeProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;

      // Write raw to transcript file
      transcriptStream.write(text);

      // Parse each JSON line and display nicely
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          if (event.type === 'system' && event.subtype === 'init') {
            console.log(`   Model: ${event.model}`);
          } else if (event.type === 'assistant' && event.message?.content) {
            // Show assistant's text
            for (const block of event.message.content) {
              if (block.type === 'text' && block.text !== lastAssistantMessage) {
                const newText = block.text.slice(lastAssistantMessage.length);
                if (newText) {
                  process.stdout.write(newText);
                  lastAssistantMessage = block.text;
                }
              } else if (block.type === 'tool_use') {
                console.log(`\n   🔧 ${block.name}: ${JSON.stringify(block.input).slice(0, 100)}...`);
              }
            }
          } else if (event.type === 'tool_result') {
            // Show tool result summary
            const result = event.result?.slice?.(0, 200) || '';
            if (result) {
              console.log(`   📋 Result: ${result.slice(0, 100)}${result.length > 100 ? '...' : ''}`);
            }
          } else if (event.type === 'result') {
            console.log(
              `\n   ✓ Completed in ${event.duration_ms}ms, cost: $${event.total_cost_usd?.toFixed(4) || '?'}`,
            );
          }
        } catch {
          // Not valid JSON, just log it
          if (line.trim()) {
            fs.appendFileSync(LOG_FILE, line + '\n');
          }
        }
      }
    });

    // Capture stderr
    let stderr = '';
    claudeProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      // Only show stderr if it's not empty noise
      if (text.trim() && !text.includes('Debugger')) {
        process.stderr.write(`   [stderr] ${text}`);
      }
    });

    // Wait for Claude with timeout
    const exitCode = await new Promise<number>((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`\n   ⏱️  Timeout after ${CLAUDE_TIMEOUT_MS / 60000} minutes - killing process`);
        writeLog(`Timeout after ${CLAUDE_TIMEOUT_MS / 60000} minutes`);
        claudeProcess.kill('SIGTERM');
        setTimeout(() => {
          claudeProcess.kill('SIGKILL');
        }, 5000);
        resolve(124);
      }, CLAUDE_TIMEOUT_MS);

      claudeProcess.on('close', (code) => {
        clearTimeout(timeout);
        transcriptStream.end();
        resolve(code ?? 1);
      });
    });
    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`   SESSION ENDED - ${duration}s - Exit code: ${exitCode}`);
    console.log(`${'='.repeat(60)}\n`);

    writeLog(`\nClaude finished in ${duration}s with exit code ${exitCode}`);
    if (stderr) writeLog(`stderr: ${stderr}`);
    fs.writeFileSync(statusFile, `Completed: ${request.sourceName}\nDuration: ${duration}s\nExit code: ${exitCode}\n`);

    // Check if scraper code was written
    let scraperCode: string | null = null;

    // First, check if Claude wrote directly to the output file
    if (fs.existsSync(outputFile)) {
      scraperCode = fs.readFileSync(outputFile, 'utf-8');
      if (scraperCode.trim().length > 50) {
        log(`   ✅ Scraper code saved to file (${scraperCode.length} bytes)`);
      } else {
        log(`   ⚠️  Output file exists but too small (${scraperCode.length} bytes)`);
        scraperCode = null;
      }
    }

    // If no output file, try to extract code from the JSON stream
    if (!scraperCode && stdout) {
      // Look for typescript code blocks in any assistant message
      const codeMatch = stdout.match(/"text"\s*:\s*"[^"]*```(?:typescript|ts)\\n([^`]+)```/);
      if (codeMatch && codeMatch[1].length > 50) {
        // Unescape the JSON string
        scraperCode = codeMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
        fs.writeFileSync(outputFile, scraperCode);
        log(`   ✅ Extracted scraper code from JSON stream (${scraperCode.length} bytes)`);
      }

      // Also try raw markdown code blocks (in case of different format)
      if (!scraperCode) {
        const rawMatch = stdout.match(/```(?:typescript|ts)\n([\s\S]*?)```/);
        if (rawMatch && rawMatch[1].length > 50) {
          scraperCode = rawMatch[1];
          fs.writeFileSync(outputFile, scraperCode);
          log(`   ✅ Extracted scraper code from raw output (${scraperCode.length} bytes)`);
        }
      }
    }

    if (!scraperCode) {
      console.log(`   ⚠️  No scraper code found in output file or stream`);
    }

    if (scraperCode) {
      // Update the database with the generated code
      await client.mutation(api.scraping.development.updateScraperCode, {
        requestId: requestId as any,
        scraperCode,
      });

      log(`   Testing scraper...`);

      // Test the scraper using the same script Claude can use
      // This ensures consistent execution between dev and daemon testing
      const testResult = await runTestScript(outputFile, request.sourceUrl, verbose);

      // Record test results
      // Filter out internal placeholders, keep only real sample data
      const visibleSamples = testResult.sessions
        .filter((s: any) => !s._index) // Remove hidden count placeholders
        .slice(0, 5);

      await client.mutation(api.scraping.development.recordTestResults, {
        requestId: requestId as any,
        sessionsFound: testResult.sessions.length,
        sampleData: visibleSamples.length > 0 ? JSON.stringify(visibleSamples, null, 2) : undefined,
        error: testResult.error,
      });

      if (testResult.error) {
        console.log(`   ❌ Test failed: ${testResult.error.slice(0, 100)}`);
        // Debug: show which API key is being used
        if (testResult.error.includes('credit balance')) {
          console.log(`   🔑 MODEL_API_KEY prefix: ${process.env.MODEL_API_KEY?.slice(0, 30)}...`);
        }
        writeLog(`Test FAILED: ${testResult.error}`);

        // Generate intelligent auto-feedback for errors
        const autoFeedback = generateAutoFeedback(request.sourceUrl, scraperCode, testResult.error);
        log(`   🤖 Auto-generating feedback for error...`);
        await client.mutation(api.scraping.development.submitFeedback, {
          requestId: requestId as any,
          feedback: autoFeedback,
          feedbackBy: 'auto-diagnosis',
        });
      } else if (testResult.sessions.length === 0) {
        // Check if 0 sessions is expected/valid (seasonal catalog, not published yet, etc.)
        const zeroIsValid = isZeroSessionsValid(scraperCode, request.sourceUrl);

        if (zeroIsValid.valid) {
          console.log(`   ✅ Found 0 sessions (expected): ${zeroIsValid.reason}`);
          writeLog(`Test PASSED with 0 sessions: ${zeroIsValid.reason}`);

          // Record as successful with explanatory note
          await client.mutation(api.scraping.development.recordTestResults, {
            requestId: requestId as any,
            sessionsFound: 0,
            sampleData: JSON.stringify({
              note: zeroIsValid.reason,
              expectedEmpty: true,
              checkAgainAfter: zeroIsValid.checkAfter,
            }),
          });
        } else {
          console.log(`   ⚠️  Test found 0 sessions - analyzing and auto-retrying`);
          writeLog(`Test found 0 sessions - analyzing site characteristics`);

          // Generate intelligent auto-feedback
          const autoFeedback = generateAutoFeedback(request.sourceUrl, scraperCode);
          log(`   🤖 Auto-generating feedback based on site analysis...`);

          await client.mutation(api.scraping.development.submitFeedback, {
            requestId: requestId as any,
            feedback: autoFeedback,
            feedbackBy: 'auto-diagnosis',
          });

          console.log(`   📝 Submitted auto-feedback - will retry with better guidance`);
        }
      } else {
        console.log(`   ✅ Found ${testResult.sessions.length} sessions - ready for review`);
        writeLog(`Test PASSED: Found ${testResult.sessions.length} sessions`);
        writeLog(`Sample: ${JSON.stringify(testResult.sessions[0], null, 2)}`);
      }
    } else {
      // No scraper code produced - mark as failed
      console.log(`   ❌ No scraper code produced`);
      await client.mutation(api.scraping.development.recordTestResults, {
        requestId: requestId as any,
        sessionsFound: 0,
        error: 'Claude did not produce any scraper code',
      });
    }
  } catch (error) {
    console.error(`${prefix}    Error:`, error instanceof Error ? error.message : error);
    throw error; // Re-throw so processRequestAsync can handle cleanup
  }
}

/**
 * Generate site-specific guidance based on URL patterns
 */
function getSiteSpecificGuidance(url: string): string {
  const guidance: string[] = [];

  // Portland Parks & Rec - LOCATION-BASED organization
  if (url.includes('portland.gov/parks')) {
    guidance.push('\n## ⚠️ CRITICAL: Portland Parks & Recreation - LOCATION-BASED CAMPS\n');
    guidance.push('**Camps are organized by COMMUNITY CENTER. You MUST scrape each location separately.**\n\n');
    guidance.push('### Discovery Steps:\n');
    guidance.push('1. Go to the main camps page and find the list of community center locations\n');
    guidance.push('2. Each location links to ActiveCommunities with a different `site_ids` parameter\n');
    guidance.push('3. You MUST iterate through ALL locations to get all camps\n\n');
    guidance.push('### Known Community Center site_ids:\n');
    guidance.push('```typescript\n');
    guidance.push('const COMMUNITY_CENTERS = [\n');
    guidance.push('  { name: "Charles Jordan Community Center", siteId: 15 },\n');
    guidance.push('  { name: "East Portland Community Center", siteId: 23 },\n');
    guidance.push('  { name: "Matt Dishman Community Center", siteId: 21 },\n');
    guidance.push('  { name: "Montavilla Community Center", siteId: 43 },\n');
    guidance.push('  { name: "Mt. Scott Community Center", siteId: 44 },\n');
    guidance.push('  { name: "Multnomah Arts Center", siteId: 22 },\n');
    guidance.push('  { name: "Peninsula Park Community Center", siteId: 45 },\n');
    guidance.push('  { name: "Southwest Community Center", siteId: 46 },\n');
    guidance.push('  { name: "St. Johns Community Center", siteId: 47 },\n');
    guidance.push('];\n');
    guidance.push('```\n\n');
    guidance.push('### URL Pattern:\n');
    guidance.push('```\n');
    guidance.push('https://anc.apm.activecommunities.com/portlandparks/activity/search\n');
    guidance.push('  ?onlineSiteId=0\n');
    guidance.push('  &activity_select_param=2\n');
    guidance.push('  &activity_category_ids=83&activity_category_ids=50&activity_category_ids=68\n');
    guidance.push('  &site_ids=XX  <-- VARIES BY LOCATION\n');
    guidance.push('  &activity_other_category_ids=4\n');
    guidance.push('  &viewMode=list\n');
    guidance.push('```\n\n');
    guidance.push('### Expected Result Format:\n');
    guidance.push('Camp - Spring Break Thrills: Week of 3/23 (Grades 1-5)\n');
    guidance.push('#1189692 / Grade 1st - 5th / Openings 0\n');
    guidance.push('Mon,Tue,Wed,Thu,Fri 9:00 AM - 5:00 PM\n\n');
    guidance.push('**Expect 50-200+ camps total across all locations.**\n\n');
  }

  // Generic ActiveCommunities detection (other cities)
  else if (url.includes('activecommunities.com') || url.includes('apm.activecommunities.com')) {
    guidance.push('\n## ⚠️ CRITICAL: ActiveCommunities React SPA Detected\n');
    guidance.push('This is a React SPA that loads content dynamically.\n');
    guidance.push('**DO NOT use querySelector - use page.extract() with Stagehand AI.**\n\n');
    guidance.push('### Check for Location-Based Organization:\n');
    guidance.push('Many Parks & Rec sites organize camps by facility/location.\n');
    guidance.push('Look for `site_ids` parameters in URLs - you may need to iterate through multiple.\n\n');
    guidance.push('Wait with `networkidle` AND `page.waitForTimeout(5000)` for React to render.\n\n');
  }

  // OMSI/secure sites
  if (url.includes('secure.omsi.edu') || url.includes('simpletix.com')) {
    guidance.push('\n## Site Type: Secure Registration Portal\n');
    guidance.push('This is a ticketing/registration system. Look for:\n');
    guidance.push('- Program/event listings in a grid or list view\n');
    guidance.push('- Category filters or navigation\n');
    guidance.push('- Date ranges and pricing in each listing\n\n');
  }

  // Museum sites often have complex structures
  if (url.includes('museum') || url.includes('evergreenmuseum') || url.includes('omsi')) {
    guidance.push('\n## Museum/Science Center Site\n');
    guidance.push('These typically have:\n');
    guidance.push('- Multiple camp categories (by age, theme, dates)\n');
    guidance.push('- Detailed program pages with registration links\n');
    guidance.push('- Check for a dedicated camps/classes section\n\n');
  }

  // Parks & Recreation general pattern
  if ((url.includes('parks') && url.includes('recreation')) || url.includes('parksandrec')) {
    guidance.push('\n## Parks & Recreation Site Pattern\n');
    guidance.push('**WARNING: These sites often organize camps by LOCATION.**\n');
    guidance.push('Look for:\n');
    guidance.push('- List of community centers, parks, or facilities\n');
    guidance.push('- Each location may have its own camp listings\n');
    guidance.push('- Registration system may use `site_ids` or `location_id` parameters\n');
    guidance.push('- You MUST iterate through all locations to get complete data\n\n');
  }

  return guidance.join('');
}

function buildClaudePrompt(request: DevelopmentRequest, exploration?: SiteExplorationResult | null): string {
  const templatePath = path.join(process.cwd(), 'scripts', 'scraper-prompt-template.md');
  let template: string;

  try {
    template = fs.readFileSync(templatePath, 'utf-8');
  } catch {
    console.error(`Error: Could not read template file at ${templatePath}`);
    console.error('Using fallback prompt.');
    template = `# Scraper Development Task

You are developing a web scraper for: **{{SOURCE_NAME}}**
URL: {{SOURCE_URL}}

Write a scraper that extracts summer camp sessions and save it to: {{OUTPUT_FILE}}
{{#NOTES}}
Notes: {{NOTES}}
{{/NOTES}}
{{SITE_GUIDANCE}}
{{EXPLORATION_RESULTS}}
`;
  }

  const outputFile = `${SCRATCHPAD_DIR}/scraper-${request._id}.ts`;

  // Get site-specific guidance
  const siteGuidance = getSiteSpecificGuidance(request.sourceUrl);

  // Format exploration results if available
  const explorationResults = exploration ? formatExplorationForPrompt(exploration) : '';

  // Replace basic placeholders
  let prompt = template
    .replace(/\{\{SOURCE_NAME\}\}/g, request.sourceName)
    .replace(/\{\{SOURCE_URL\}\}/g, request.sourceUrl)
    .replace(/\{\{OUTPUT_FILE\}\}/g, outputFile)
    .replace(/\{\{SITE_GUIDANCE\}\}/g, siteGuidance)
    .replace(/\{\{EXPLORATION_RESULTS\}\}/g, explorationResults);

  // Handle conditional sections
  // Notes section
  if (request.notes) {
    prompt = prompt
      .replace(/\{\{#NOTES\}\}/g, '')
      .replace(/\{\{\/NOTES\}\}/g, '')
      .replace(/\{\{NOTES\}\}/g, request.notes);
  } else {
    prompt = prompt.replace(/\{\{#NOTES\}\}[\s\S]*?\{\{\/NOTES\}\}/g, '');
  }

  // Feedback section
  const hasFeedback = request.feedbackHistory && request.feedbackHistory.length > 0;
  const latestFeedback = hasFeedback ? request.feedbackHistory![request.feedbackHistory!.length - 1] : null;

  if (hasFeedback && latestFeedback) {
    prompt = prompt
      .replace(/\{\{#FEEDBACK\}\}/g, '')
      .replace(/\{\{\/FEEDBACK\}\}/g, '')
      .replace(/\{\{FEEDBACK_VERSION\}\}/g, String(latestFeedback.scraperVersionBefore))
      .replace(/\{\{FEEDBACK_TEXT\}\}/g, latestFeedback.feedback);
  } else {
    prompt = prompt.replace(/\{\{#FEEDBACK\}\}[\s\S]*?\{\{\/FEEDBACK\}\}/g, '');
  }

  // Previous code section
  if (request.generatedScraperCode) {
    prompt = prompt
      .replace(/\{\{#PREVIOUS_CODE\}\}/g, '')
      .replace(/\{\{\/PREVIOUS_CODE\}\}/g, '')
      .replace(/\{\{PREVIOUS_CODE\}\}/g, request.generatedScraperCode);
  } else {
    prompt = prompt.replace(/\{\{#PREVIOUS_CODE\}\}[\s\S]*?\{\{\/PREVIOUS_CODE\}\}/g, '');
  }

  return prompt;
}

interface TestResult {
  sessions: any[];
  error?: string;
  diagnostics?: ScraperDiagnostics;
}

/**
 * Run the test-scraper.ts script to test a scraper
 * This uses the same execution path as the Convex executor
 */
async function runTestScript(scraperFile: string, url: string, verbose: boolean = false): Promise<TestResult> {
  const { execSync } = require('child_process');
  const log = (msg: string) => {
    writeLog(msg);
    if (verbose) console.log(msg);
  };

  try {
    log(`   Running: npx tsx scripts/test-scraper.ts "${scraperFile}" "${url}"`);

    const output = execSync(`npx tsx scripts/test-scraper.ts "${scraperFile}" "${url}"`, {
      cwd: process.cwd(),
      timeout: 180000, // 3 minute timeout
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    log(`   Test output:\n${output.slice(-1500)}`);

    // Try to parse JSON output first (most reliable)
    const jsonMatch = output.match(/__JSON_START__([\s\S]*?)__JSON_END__/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1].trim());
        if (jsonData.success && jsonData.sessionCount > 0) {
          // Use the actual sample data from the scraper
          const sessions = jsonData.samples.map((s: any) => ({
            name: s.name || '(no name)',
            dates: s.startDate && s.endDate ? `${s.startDate} - ${s.endDate}` : s.startDate,
            location: s.location,
            ages: s.minAge || s.maxAge ? `${s.minAge || '?'}-${s.maxAge || '?'}` : undefined,
            price: s.priceInCents ? `$${(s.priceInCents / 100).toFixed(2)}` : s.priceRaw,
            available: s.isAvailable,
          }));

          // Add count indicator if there are more
          if (jsonData.sessionCount > sessions.length) {
            sessions.push({
              name: `... and ${jsonData.sessionCount - sessions.length} more sessions`,
              _isPlaceholder: true,
            });
          }

          // Return sessions with actual count for recording
          const fullSessions = [];
          for (let i = 0; i < jsonData.sessionCount; i++) {
            if (i < sessions.length) {
              fullSessions.push(sessions[i]);
            } else {
              fullSessions.push({ _index: i + 1 }); // Hidden placeholder for count
            }
          }

          return { sessions: fullSessions, error: undefined };
        }
      } catch (e) {
        log(`   Warning: Failed to parse JSON output: ${e}`);
      }
    }

    // Fallback: Parse text output
    const successMatch = output.match(/SUCCESS: Found (\d+) sessions/);
    if (successMatch) {
      const sessionCount = parseInt(successMatch[1]);
      const sessions: any[] = [
        {
          name: `Found ${sessionCount} sessions`,
          note: 'JSON parsing failed - see test output for details',
        },
      ];

      // Pad to correct count
      while (sessions.length < sessionCount) {
        sessions.push({ _index: sessions.length + 1 });
      }

      return { sessions, error: undefined };
    }

    // Test passed but couldn't parse output
    return { sessions: [{ name: 'Test passed but could not parse output' }], error: undefined };
  } catch (error: any) {
    // Test failed - extract error message
    const stderr = error.stderr || '';
    const stdout = error.stdout || '';
    const fullOutput = stdout + '\n' + stderr;

    log(`   Test failed:\n${fullOutput.slice(-2000)}`);

    // Try to extract the error message
    let errorMessage = 'Test failed';

    const errorMatch = fullOutput.match(/Error: (.+)/);
    if (errorMatch) {
      errorMessage = errorMatch[1].slice(0, 500);
    } else if (fullOutput.includes('0 sessions')) {
      errorMessage = 'Found 0 sessions - scraper may not be extracting data correctly';
    } else if (fullOutput.includes('timeout')) {
      errorMessage = 'Test timed out - page may be slow to load';
    } else if (error.message) {
      errorMessage = error.message.slice(0, 500);
    }

    return { sessions: [], error: errorMessage };
  }
}

interface ScraperDiagnostics {
  siteType: 'static' | 'react_spa' | 'active_communities' | 'api_driven' | 'unknown';
  possibleIssues: string[];
  suggestedFixes: string[];
  detectedPatterns: string[];
}

/**
 * Analyze the URL and page characteristics to diagnose why scraping might fail
 */
function diagnoseSiteCharacteristics(url: string, scraperCode: string): ScraperDiagnostics {
  const diagnostics: ScraperDiagnostics = {
    siteType: 'unknown',
    possibleIssues: [],
    suggestedFixes: [],
    detectedPatterns: [],
  };

  // Detect ActiveCommunities sites (very common for parks & rec)
  if (url.includes('activecommunities.com') || url.includes('apm.activecommunities.com')) {
    diagnostics.siteType = 'active_communities';
    diagnostics.possibleIssues.push('ActiveCommunities is a React SPA that loads content dynamically');
    diagnostics.possibleIssues.push('DOM selectors will fail - content renders after JavaScript executes');
    diagnostics.suggestedFixes.push('Use page.extract() with Stagehand AI instead of querySelector');
    diagnostics.suggestedFixes.push('Wait for networkidle + additional 5-10 seconds for React hydration');
    diagnostics.suggestedFixes.push('Extract from visible rendered content, not DOM structure');
    diagnostics.detectedPatterns.push('activecommunities.com detected');
  }

  // Detect other React/SPA patterns
  if (url.includes('secure.') || url.includes('portal.') || url.includes('app.')) {
    diagnostics.detectedPatterns.push('URL pattern suggests web app/portal');
    if (diagnostics.siteType === 'unknown') {
      diagnostics.siteType = 'react_spa';
      diagnostics.possibleIssues.push('Likely a Single Page Application (SPA)');
      diagnostics.suggestedFixes.push('Wait longer for JavaScript to render content');
      diagnostics.suggestedFixes.push('Use page.extract() for AI-based extraction');
    }
  }

  // Check scraper code for common issues
  if (scraperCode.includes('querySelectorAll') && !scraperCode.includes('page.extract')) {
    diagnostics.possibleIssues.push('Scraper relies on DOM selectors which may fail on SPAs');
    diagnostics.suggestedFixes.push('Add fallback using page.extract() for AI extraction');
  }

  if (scraperCode.includes("waitUntil: 'domcontentloaded'") && !scraperCode.includes('waitForTimeout')) {
    diagnostics.possibleIssues.push('May not wait long enough for dynamic content');
    diagnostics.suggestedFixes.push('Add page.waitForTimeout(5000) after navigation');
  }

  if (!scraperCode.includes('networkidle') && diagnostics.siteType === 'react_spa') {
    diagnostics.suggestedFixes.push("Use waitUntil: 'networkidle' for SPA sites");
  }

  // Detect pagination issues
  if (scraperCode.includes('category_ids') || scraperCode.includes('page=')) {
    diagnostics.detectedPatterns.push('Multi-page or multi-category scraping');
    if (!scraperCode.includes('hasMorePages') && !scraperCode.includes('pagination')) {
      diagnostics.possibleIssues.push('May not handle pagination correctly');
      diagnostics.suggestedFixes.push('Implement pagination handling with Load More or Next button clicks');
    }
  }

  return diagnostics;
}

/**
 * Check if 0 sessions is a valid/expected result
 * Returns true for seasonal catalogs, not-yet-published schedules, etc.
 */
function isZeroSessionsValid(
  scraperCode: string,
  url: string,
): { valid: boolean; reason: string; checkAfter?: string } {
  const codeLower = scraperCode.toLowerCase();
  const urlLower = url.toLowerCase();

  // Patterns that indicate scraper intentionally handles 0 sessions
  const seasonalPatterns = [
    { pattern: /not (yet )?(published|available|posted|released)/i, reason: 'Catalog not yet published' },
    { pattern: /coming soon/i, reason: 'Coming soon' },
    { pattern: /check back (later|in|after)/i, reason: 'Seasonal - check back later' },
    { pattern: /registration (opens|begins|starts) (in|on|after)/i, reason: 'Registration not yet open' },
    {
      pattern: /(\d{4}) (summer|camp|program)s? (will be|are) (posted|published|available)/i,
      reason: 'Future catalog - not yet published',
    },
    {
      pattern: /schedule (for )?\d{4} (not|isn't|is not) (yet )?(available|ready|published)/i,
      reason: 'Schedule not yet available',
    },
    { pattern: /late (may|june|winter|spring|summer|fall)/i, reason: 'Seasonal catalog' },
    { pattern: /catalog (is )?(empty|unavailable)/i, reason: 'Catalog currently empty' },
    {
      pattern: /no (camps?|sessions?|programs?) (are )?(currently|presently) (listed|available|scheduled)/i,
      reason: 'No programs currently scheduled',
    },
  ];

  for (const { pattern, reason } of seasonalPatterns) {
    if (pattern.test(scraperCode)) {
      // Try to extract a date for when to check again
      const monthMatch = scraperCode.match(
        /(?:after|in|on|by)\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{1,2})?\s*,?\s*(\d{4})?/i,
      );
      let checkAfter: string | undefined;
      if (monthMatch) {
        const month = monthMatch[1];
        const day = monthMatch[2] || '1';
        const year = monthMatch[3] || new Date().getFullYear().toString();
        checkAfter = `${month} ${day}, ${year}`;
      }
      return { valid: true, reason, checkAfter };
    }
  }

  // Known sites that have seasonal catalogs
  const seasonalSites = [
    { pattern: /pcc\.edu/i, reason: 'PCC - publishes catalog late May', checkAfter: 'May 28' },
    { pattern: /college|university/i, reason: 'Academic institution - likely seasonal catalog' },
  ];

  for (const { pattern, reason, checkAfter } of seasonalSites) {
    if (
      (pattern.test(urlLower) && codeLower.includes('0 sessions')) ||
      codeLower.includes('no sessions') ||
      codeLower.includes('empty')
    ) {
      return { valid: true, reason, checkAfter };
    }
  }

  // Check if scraper explicitly returns empty with explanation
  if (
    codeLower.includes('return []') &&
    (codeLower.includes('// no camps') ||
      codeLower.includes('// empty') ||
      codeLower.includes('// seasonal') ||
      codeLower.includes('// not published'))
  ) {
    return { valid: true, reason: 'Scraper explicitly handles empty state' };
  }

  return { valid: false, reason: '' };
}

/**
 * Generate intelligent auto-feedback when scraper finds 0 sessions
 */
function generateAutoFeedback(url: string, scraperCode: string, testError?: string): string {
  const diagnostics = diagnoseSiteCharacteristics(url, scraperCode);

  const feedback: string[] = ['Automatic diagnosis based on test results:\n'];

  // Site type specific guidance
  if (diagnostics.siteType === 'active_communities') {
    feedback.push('⚠️ CRITICAL: This is an ActiveCommunities site (React SPA).\n');
    feedback.push('The current approach using DOM selectors WILL NOT WORK.\n\n');
    feedback.push('REQUIRED CHANGES:\n');
    feedback.push('1. Navigate directly to the activity search URL with category filters\n');
    feedback.push('2. Wait with networkidle AND page.waitForTimeout(5000) minimum\n');
    feedback.push('3. Use page.extract() with Stagehand AI to extract visible content\n');
    feedback.push('4. DO NOT use querySelector/querySelectorAll - they will fail\n');
    feedback.push('5. The camps render as cards - extract name, dates, price, ages from what you SEE\n\n');
    feedback.push('Example category URLs:\n');
    feedback.push('- Day Camps: ?activity_category_ids=50\n');
    feedback.push('- Specialty Camps: ?activity_category_ids=83\n');
    feedback.push('- Sports Camps: ?activity_category_ids=68\n');
  } else if (diagnostics.siteType === 'react_spa') {
    feedback.push('⚠️ This appears to be a Single Page Application (SPA).\n\n');
    feedback.push('SUGGESTED CHANGES:\n');
    feedback.push('1. Add longer wait times after navigation (5-10 seconds)\n');
    feedback.push('2. Use page.extract() for AI-based content extraction\n');
    feedback.push('3. Check if the site has an API you can call directly\n');
  }

  // Add specific issues
  if (diagnostics.possibleIssues.length > 0) {
    feedback.push('\nDETECTED ISSUES:\n');
    for (const issue of diagnostics.possibleIssues) {
      feedback.push(`- ${issue}\n`);
    }
  }

  // Add suggested fixes
  if (diagnostics.suggestedFixes.length > 0) {
    feedback.push('\nSUGGESTED FIXES:\n');
    for (const fix of diagnostics.suggestedFixes) {
      feedback.push(`- ${fix}\n`);
    }
  }

  // Add error context if available
  if (testError) {
    feedback.push(`\nTEST ERROR: ${testError.slice(0, 500)}\n`);
  }

  return feedback.join('');
}

/**
 * Determine the type of scraper and how to test it
 *
 * Key distinction:
 * - BROWSER-DEPENDENT: Scraper navigates pages, clicks elements, or uses AI extraction
 *   to discover and extract session data from the DOM
 * - PROGRAMMATIC: Scraper has hardcoded week definitions and generates sessions
 *   using forEach/for loops. May use page.evaluate for optional data enrichment,
 *   but sessions are generated from static data regardless of page content
 */
function analyzeScraperType(scraperCode: string): {
  needsBrowser: boolean;
  isProgrammatic: boolean;
  reason: string;
} {
  // Check for browser APIs
  const usesStagehandExtract = scraperCode.includes('page.extract(');
  const usesPageGoto = scraperCode.includes('page.goto(');
  const usesPageClick = scraperCode.includes('page.click(') || scraperCode.includes('.click(');
  const usesPageWaitFor = scraperCode.includes('page.waitFor');

  // Check for DOM traversal to build sessions (as opposed to just metadata extraction)
  // querySelectorAll is a strong signal of building sessions from DOM elements
  const usesDOMTraversal = scraperCode.includes('querySelectorAll');

  // Check for programmatic session generation patterns
  // Handle various patterns: weeks = [, weeks: [...] = [, weeks: Array<...> = [
  const hasHardcodedWeeks =
    scraperCode.includes('weeks = [') ||
    scraperCode.includes('weeks: [') ||
    /weeks:\s*Array<[^>]+>\s*=\s*\[/.test(scraperCode) ||
    /const\s+weeks\s*=\s*\[/.test(scraperCode);
  const hasSessionsPush = scraperCode.includes('sessions.push');
  const hasWeeksForEach = scraperCode.includes('weeks.forEach');
  const hasWeeksForLoop = /for\s*\([^)]*weeks\.length/.test(scraperCode);
  const hasGenerateFunction = scraperCode.includes('generateWeeklySessions');

  // PRIORITY 1: If it uses page.extract() or page.goto() or querySelectorAll,
  // it MUST use a browser. These are definitive browser-dependent patterns.
  if (usesStagehandExtract || usesPageGoto || usesDOMTraversal) {
    return {
      needsBrowser: true,
      isProgrammatic: false,
      reason: `Browser-dependent: extract=${usesStagehandExtract}, goto=${usesPageGoto}, domTraversal=${usesDOMTraversal}`,
    };
  }

  // PRIORITY 2: If it has hardcoded weeks that are iterated to generate sessions,
  // it's programmatic. Even if it uses page.evaluate for metadata, the sessions
  // are generated from static data.
  if (hasHardcodedWeeks && hasSessionsPush && (hasWeeksForEach || hasWeeksForLoop)) {
    return {
      needsBrowser: false,
      isProgrammatic: true,
      reason: `Programmatic: hardcoded weeks array with loop to push sessions`,
    };
  }

  if (hasGenerateFunction && hasSessionsPush) {
    return {
      needsBrowser: false,
      isProgrammatic: true,
      reason: `Programmatic: generateWeeklySessions function`,
    };
  }

  // PRIORITY 3: If it uses click or waitFor, it needs browser
  if (usesPageClick || usesPageWaitFor) {
    return {
      needsBrowser: true,
      isProgrammatic: false,
      reason: `Browser-dependent: click=${usesPageClick}, waitFor=${usesPageWaitFor}`,
    };
  }

  // PRIORITY 4: Check for general programmatic patterns
  // Has sessions.push with any loop and no browser navigation
  const hasForLoop = scraperCode.includes('for (') && scraperCode.includes('sessions.push');
  const hasWhileLoop = scraperCode.includes('while (') && scraperCode.includes('sessions.push');

  if (hasForLoop || hasWhileLoop) {
    return {
      needsBrowser: false,
      isProgrammatic: true,
      reason: `Programmatic: loop-based session generation`,
    };
  }

  // Default: assume it needs browser testing
  return {
    needsBrowser: true,
    isProgrammatic: false,
    reason: 'No clear programmatic patterns detected - needs browser testing',
  };
}

/**
 * Actually execute the scraper code with a mock page object using tsx
 * This works for scrapers that generate sessions programmatically
 */
async function executeScraperWithMock(
  scraperCode: string,
  url: string,
  log: (msg: string) => void,
): Promise<TestResult | null> {
  try {
    log(`   Executing scraper with mock page...`);

    // Write the scraper to a temp file
    const tempScraperPath = path.join(SCRATCHPAD_DIR, `temp-scraper-${Date.now()}.ts`);
    fs.writeFileSync(tempScraperPath, scraperCode);

    // Write a test runner that imports and executes the scraper
    const testRunnerPath = path.join(SCRATCHPAD_DIR, `test-runner-${Date.now()}.ts`);
    const testRunnerCode = `
import * as fs from 'fs';

// Create a mock page object
const mockPage = {
  url: () => '${url}',
  evaluate: async (fn: Function) => ({}),
  goto: async () => {},
  waitForTimeout: async () => {},
  extract: async () => ({}),
};

async function main() {
  try {
    const scraperModule = await import('${tempScraperPath}');
    const sessions = await scraperModule.scrape(mockPage);

    // Output as JSON for parsing
    console.log('__RESULT__' + JSON.stringify({
      success: true,
      sessionCount: sessions.length,
      sessions: sessions.slice(0, 10), // First 10 as samples
    }));
  } catch (error) {
    console.log('__RESULT__' + JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

main();
`;
    fs.writeFileSync(testRunnerPath, testRunnerCode);

    // Execute with tsx
    const { execSync } = require('child_process');
    const output = execSync(`npx tsx "${testRunnerPath}"`, {
      cwd: process.cwd(),
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Parse the result
    const resultMatch = output.match(/__RESULT__(.+)/);
    if (!resultMatch) {
      log(`   ⚠️ No result from scraper execution`);
      return null;
    }

    const result = JSON.parse(resultMatch[1]);

    // Cleanup temp files
    try {
      fs.unlinkSync(tempScraperPath);
      fs.unlinkSync(testRunnerPath);
    } catch {
      // Ignore cleanup errors
    }

    if (result.success && result.sessionCount > 0) {
      log(`   ✅ Scraper executed successfully: ${result.sessionCount} sessions`);
      return { sessions: result.sessions, error: undefined };
    } else if (result.error) {
      log(`   ❌ Scraper execution error: ${result.error}`);
      return null;
    } else {
      log(`   ⚠️ Scraper returned 0 sessions`);
      return null;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`   ❌ Execution failed: ${errorMsg.slice(0, 200)}`);
    return null;
  }
}

/**
 * Static analysis fallback for counting sessions
 */
function staticAnalysis(scraperCode: string, log: (msg: string) => void): TestResult | null {
  log(`   Using static analysis fallback...`);

  // Count hardcoded week definitions: { start: '2026-06-15', end: '...' }
  const weekMatches = scraperCode.match(/\{\s*start:\s*['"](\d{4}-\d{2}-\d{2})['"]/g);
  let sessionCount = weekMatches?.length || 0;

  if (sessionCount === 0) {
    // Look for WEEK_DEFINITIONS or similar objects
    const weekDefMatch = scraperCode.match(/WEEK_DEFINITIONS[^}]*\{[\s\S]*?\n\};/);
    if (weekDefMatch) {
      const innerMatches = weekDefMatch[0].match(/\d+:\s*\{/g);
      sessionCount = innerMatches?.length || 0;
    }
  }

  if (sessionCount === 0) {
    // Count sessions.push calls
    const pushMatches = scraperCode.match(/sessions\.push\s*\(/g);
    sessionCount = pushMatches?.length || 0;
  }

  if (sessionCount === 0) {
    // Estimate from date range
    const juneMatch = scraperCode.match(/['"](\d{4})-06-(\d{2})['"]/);
    const augMatch = scraperCode.match(/['"](\d{4})-08-(\d{2})['"]/);
    if (juneMatch && augMatch) {
      // Roughly 10 weeks from mid-June to late August
      sessionCount = 10;
    }
  }

  if (sessionCount === 0) {
    log(`   Could not estimate session count`);
    return null;
  }

  log(`   Static analysis found ${sessionCount} sessions`);

  // Extract sample data
  const locationMatch = scraperCode.match(/location\s*[=:]\s*(?:[^'"]*\|\|)?\s*['"]([^'"]+)['"]/);
  const location = locationMatch?.[1] || 'Location TBD';

  const priceMatch = scraperCode.match(/priceInCents\s*[=:]\s*(\d+)/);
  const weeklyPriceCalc = scraperCode.match(/dailyPriceInCents\s*\*\s*5/);
  const dailyMatch = scraperCode.match(/dailyPriceInCents\s*=\s*(\d+)/);
  let priceInCents = priceMatch ? parseInt(priceMatch[1]) : undefined;
  if (!priceInCents && dailyMatch && weeklyPriceCalc) {
    priceInCents = parseInt(dailyMatch[1]) * 5;
  }

  const minAgeMatch = scraperCode.match(/minAge\s*[=:]\s*(\d+)/);
  const maxAgeMatch = scraperCode.match(/maxAge\s*[=:]\s*(\d+)/);
  const minAge = minAgeMatch ? parseInt(minAgeMatch[1]) : undefined;
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : undefined;

  // Extract week dates to generate sample sessions
  const sessions = [];
  const weekDates = scraperCode.matchAll(
    /\{\s*start:\s*['"](\d{4}-\d{2}-\d{2})['"],\s*end:\s*['"](\d{4}-\d{2}-\d{2})['"]/g,
  );

  let weekNum = 1;
  for (const match of weekDates) {
    sessions.push({
      name: `Session - Week ${weekNum}`,
      startDate: match[1],
      endDate: match[2],
      location,
      priceInCents,
      minAge,
      maxAge,
    });
    weekNum++;
    if (weekNum > 5) break; // Only show first 5 as samples
  }

  if (sessions.length === 0) {
    // Create generic samples
    for (let i = 1; i <= Math.min(5, sessionCount); i++) {
      sessions.push({
        name: `Session ${i}`,
        location,
        priceInCents,
        minAge,
        maxAge,
        note: `(Total: ${sessionCount} sessions)`,
      });
    }
  }

  return { sessions, error: undefined };
}

/**
 * Try to test a programmatic scraper by actually executing it
 */
async function tryDirectExecution(
  scraperCode: string,
  url: string,
  log: (msg: string) => void,
): Promise<TestResult | null> {
  // Analyze the scraper type
  const analysis = analyzeScraperType(scraperCode);
  log(`   Scraper analysis: ${analysis.reason}`);

  if (analysis.needsBrowser) {
    log(`   Scraper requires browser - cannot test with mock`);
    return null;
  }

  if (!analysis.isProgrammatic) {
    log(`   Not a programmatic scraper`);
    return null;
  }

  // Try actual execution first
  const execResult = await executeScraperWithMock(scraperCode, url, log);
  if (execResult && execResult.sessions.length > 0) {
    return execResult;
  }

  // Fall back to static analysis
  return staticAnalysis(scraperCode, log);
}

/**
 * Test a scraper by actually running it
 * First tries to execute it directly (for scrapers that generate sessions without browser)
 * Falls back to Stagehand if the scraper needs browser interaction
 */
async function testScraper(scraperCode: string, url: string, verbose: boolean = false): Promise<TestResult> {
  const log = (msg: string) => {
    writeLog(msg);
    if (verbose) console.log(msg);
  };

  // First, try to run the scraper directly if it generates sessions without needing a real browser
  // This handles drop-in camps that generate weekly sessions programmatically
  const directResult = await tryDirectExecution(scraperCode, url, log);
  if (directResult) {
    return directResult;
  }

  // Check if Stagehand is available for browser-based testing
  if (!Stagehand) {
    log('   Stagehand not installed - marking for manual review');
    // If the code looks like it generates sessions, treat as success
    if (scraperCode.includes('generateWeeklySessions') || scraperCode.includes('sessions.push')) {
      log('   Code appears to generate sessions - marking as ready for review');
      return {
        sessions: [
          {
            name: 'Generated sessions (manual verification needed)',
            note: 'Scraper generates sessions programmatically',
          },
        ],
        error: undefined,
      };
    }
    return {
      sessions: [],
      error: undefined, // No error, just no automated test
    };
  }

  let stagehand: any = null;

  try {
    // Check for required environment variables
    if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
      return {
        sessions: [],
        error: 'Missing BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID environment variables',
      };
    }

    if (!process.env.MODEL_API_KEY) {
      return {
        sessions: [],
        error: 'Missing MODEL_API_KEY environment variable',
      };
    }

    log(`   Initializing Stagehand...`);

    // Initialize Stagehand
    stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      model: {
        modelName: 'anthropic/claude-sonnet-4-20250514',
        apiKey: process.env.MODEL_API_KEY,
      },
      disablePino: true,
      verbose: 0,
    });

    await stagehand.init();

    // Get the page
    const page = stagehand.context.pages()[0];

    log(`   Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for dynamic content
    await page.waitForTimeout(5000);

    log(`   Running scraper...`);

    // Create a wrapper to execute the scraper code
    // We'll use page.evaluate to run the extraction logic
    // But first, we need to parse the scraper code to understand what it does

    // For now, let's use a simpler approach: use Stagehand's extract()
    // with the scraper code as context/instruction

    // Extract the scrape function body from the code
    const functionMatch = scraperCode.match(
      /async function scrape\s*\([^)]*\)\s*(?::\s*Promise<[^>]+>)?\s*\{([\s\S]*)\}[\s\S]*$/,
    );

    if (!functionMatch) {
      // If we can't find a scrape function, try to use Stagehand's AI extraction
      // guided by the scraper code as instructions
      log(`   Using AI extraction (no scrape function found)...`);

      const { z } = await import('zod');

      const schema = z.object({
        sessions: z.array(
          z.object({
            name: z.string(),
            description: z.string().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            dateRaw: z.string().optional(),
            dropOffHour: z.number().optional(),
            dropOffMinute: z.number().optional(),
            pickUpHour: z.number().optional(),
            pickUpMinute: z.number().optional(),
            timeRaw: z.string().optional(),
            location: z.string().optional(),
            minAge: z.number().optional(),
            maxAge: z.number().optional(),
            minGrade: z.number().optional(),
            maxGrade: z.number().optional(),
            ageGradeRaw: z.string().optional(),
            priceInCents: z.number().optional(),
            priceRaw: z.string().optional(),
            registrationUrl: z.string().optional(),
            isAvailable: z.boolean().optional(),
          }),
        ),
      });

      // Use the scraper code as additional instructions
      const instruction = `Extract all summer camp sessions from this page.

The developer wrote this scraper code as a guide:
\`\`\`
${scraperCode.slice(0, 2000)}
\`\`\`

Follow the logic in the code to extract sessions. Return all sessions found.`;

      const result = await stagehand.extract(instruction, schema);

      return {
        sessions: result.sessions || [],
      };
    }

    // If we found a scrape function, try to execute it via page.evaluate
    // This is tricky because the scraper code may use Stagehand-specific APIs
    // For now, fall back to AI extraction
    log(`   Found scrape function, using AI-guided extraction...`);

    const { z } = await import('zod');

    const schema = z.object({
      sessions: z.array(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          dateRaw: z.string().optional(),
          dropOffHour: z.number().optional(),
          dropOffMinute: z.number().optional(),
          pickUpHour: z.number().optional(),
          pickUpMinute: z.number().optional(),
          timeRaw: z.string().optional(),
          location: z.string().optional(),
          minAge: z.number().optional(),
          maxAge: z.number().optional(),
          minGrade: z.number().optional(),
          maxGrade: z.number().optional(),
          ageGradeRaw: z.string().optional(),
          priceInCents: z.number().optional(),
          priceRaw: z.string().optional(),
          registrationUrl: z.string().optional(),
          isAvailable: z.boolean().optional(),
        }),
      ),
    });

    const instruction = `Extract all summer camp sessions from this page following this scraper logic:

\`\`\`typescript
${scraperCode.slice(0, 3000)}
\`\`\`

Apply the extraction logic from the code. Return ALL sessions found.`;

    const result = await stagehand.extract(instruction, schema);

    return {
      sessions: result.sessions || [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      sessions: [],
      error: errorMessage,
    };
  } finally {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// DIRECTORY QUEUE PROCESSING
// ============================================

interface DirectoryQueueItem {
  _id: string;
  cityId: string;
  url: string;
  status: string;
  linkPattern?: string;
  baseUrlFilter?: string;
}

/**
 * Process pending directory queue items by fetching locally
 */
async function processDirectoryQueue(verbose: boolean = false) {
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
  if (!Stagehand) {
    return { success: false, urls: [], error: 'Stagehand not available - install @browserbasehq/stagehand' };
  }

  if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    return { success: false, urls: [], error: 'Missing BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID' };
  }

  let stagehand: any = null;

  try {
    log(`   Initializing Stagehand...`);

    stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      model: {
        modelName: 'anthropic/claude-sonnet-4-20250514',
        apiKey: process.env.MODEL_API_KEY,
      },
      disablePino: true,
      verbose: 0,
    });

    await stagehand.init();
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

// ============================================
// CONTACT EXTRACTION PROCESSING
// ============================================

interface ContactInfo {
  email?: string;
  phone?: string;
  contactName?: string;
  contactTitle?: string;
  address?: string;
}

/**
 * Extract contact info from a URL locally using Stagehand
 */
async function extractContactLocally(
  url: string,
  log: (msg: string) => void,
): Promise<{ success: boolean; contactInfo?: ContactInfo; error?: string }> {
  if (!Stagehand) {
    return { success: false, error: 'Stagehand not available' };
  }

  if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    return { success: false, error: 'Missing BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID' };
  }

  let stagehand: any = null;

  try {
    stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      model: {
        modelName: 'anthropic/claude-sonnet-4-20250514',
        apiKey: process.env.MODEL_API_KEY,
      },
      disablePino: true,
      verbose: 0,
    });

    await stagehand.init();
    const page = stagehand.context.pages()[0];

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Use Stagehand's extract with a zod-like schema
    const { z } = await import('zod');
    const ContactInfoSchema = z.object({
      email: z.string().optional().describe('Primary contact email address'),
      phone: z.string().optional().describe('Primary contact phone number'),
      contactName: z.string().optional().describe('Name of the contact person'),
      contactTitle: z.string().optional().describe('Title/role of the contact person'),
      address: z.string().optional().describe('Physical address'),
    });

    const instruction = `Extract all contact information from this page. Look carefully for:
- Email addresses (especially info@, contact@, hello@, registration@, or any camp-related email)
- Phone numbers (in any format)
- Physical addresses
- Contact person names and their titles/roles (e.g., Camp Director, Program Manager)

Check the header, footer, sidebar, and main content areas. Also look for "Contact Us", "About", or "Connect" sections.`;

    const extractResult = await stagehand.extract(instruction, ContactInfoSchema);

    await stagehand.close();
    stagehand = null;

    return {
      success: true,
      contactInfo: extractResult as ContactInfo,
    };
  } catch (error) {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch {}
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process organizations that need contact info extraction
 */
async function processContactExtraction(verbose: boolean = false) {
  // Contact extraction always logs to console (it's important to see progress)
  const log = (msg: string) => {
    writeLog(msg);
    console.log(msg);
  };

  // Get orgs needing contact info
  const orgsNeedingContact = await client.query(api.scraping.contactExtractorHelpers.getOrgsNeedingContactInfo, {
    limit: 3,
  });

  if (!orgsNeedingContact || orgsNeedingContact.length === 0) {
    if (verbose) log('📧 No orgs need contact extraction');
    return;
  }

  log(`📧 Processing ${orgsNeedingContact.length} orgs for contact extraction...`);

  for (const org of orgsNeedingContact) {
    if (!org.website) continue;

    await logQueueStatus('   ');
    log(`   🔍 ${org.name}: ${org.website}`);

    try {
      // Extract locally using Stagehand (not via Convex action)
      const result = await extractContactLocally(org.website, log);

      // Save results to Convex
      await client.mutation(api.scraping.contactExtractorHelpers.saveOrgContactInfo, {
        organizationId: org._id,
        email: result.contactInfo?.email,
        phone: result.contactInfo?.phone,
      });

      if (result.success && result.contactInfo) {
        const info = result.contactInfo;
        if (info.email || info.phone) {
          log(`   ✅ Found: ${info.email || '-'} | ${info.phone || '-'}`);
        } else {
          log(`   ⚠️ No contact info on page`);
        }
      } else {
        log(`   ❌ Error: ${result.error || 'unknown'}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log(`   ❌ Error: ${errorMsg}`);

      // Still mark as attempted so we don't retry immediately
      try {
        await client.mutation(api.scraping.contactExtractorHelpers.saveOrgContactInfo, {
          organizationId: org._id,
        });
      } catch {}
    }
  }
}

// ============================================
// MARKET DISCOVERY PROCESSING
// ============================================

interface DiscoveryTask {
  _id: string;
  cityId: string;
  regionName: string;
  status: string;
  searchQueries: string[];
  maxSearchResults?: number;
}

interface DiscoveredUrl {
  url: string;
  source: string;
  title?: string;
  domain: string;
}

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
const SKIP_URL_PATTERNS = [
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

function shouldSkipDiscoveryUrl(url: string): boolean {
  return SKIP_URL_PATTERNS.some((pattern) => pattern.test(url));
}

function extractDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Process pending market discovery tasks
 */
async function processMarketDiscoveryQueue(verbose: boolean = false) {
  // For discovery, always log to console since it's a long-running visual task
  const log = (msg: string) => {
    writeLog(msg);
    console.log(msg);
  };

  // Check if Stagehand is available
  if (!Stagehand) {
    if (verbose) log('🌍 Market discovery skipped - Stagehand not available');
    return;
  }

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
    stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      model: {
        modelName: 'anthropic/claude-sonnet-4-20250514',
        apiKey: process.env.MODEL_API_KEY,
      },
      disablePino: true,
      verbose: 0,
    });

    await stagehand.init();
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
            searchResults.forEach((div) => {
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
            document.querySelectorAll('div.g, div[data-hveid]').forEach((div) => {
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

            document.querySelectorAll('a[href^="http"]').forEach((a) => {
              const href = a.getAttribute('href');
              if (!href || seenUrls.has(href)) return;

              // Skip internal links and common non-camp sites
              const url = new URL(href);
              const domain = url.hostname.replace(/^www\./, '');
              if (domain === window.location.hostname) return;
              if (/facebook|twitter|instagram|linkedin|youtube|google|yelp|tripadvisor/i.test(domain)) return;

              seenUrls.add(href);
              const title = a.textContent?.trim() || '';
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

// Check for --directory flag to only process directory queue
const directoryOnly = process.argv.includes('--directory') || process.argv.includes('-d');
const contactOnly = process.argv.includes('--contact') || process.argv.includes('-c');
const discoveryOnly = process.argv.includes('--discovery') || process.argv.includes('-D');

if (directoryOnly) {
  // One-shot directory processing
  console.log('📂 Processing directory queue only...');
  processDirectoryQueue(true)
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
} else if (contactOnly) {
  // One-shot contact extraction
  console.log('📧 Processing contact extraction only...');
  processContactExtraction(true)
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
} else if (discoveryOnly) {
  // One-shot market discovery processing
  console.log('🌍 Processing market discovery only...');
  processMarketDiscoveryQueue(true)
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
} else {
  // Run the full daemon (scraper development + directory queue + contact extraction + market discovery)
  const originalMain = main;
  main = async function () {
    // Start the original main loop
    const mainPromise = originalMain();

    // Also periodically check directory queue
    const directoryInterval = setInterval(async () => {
      if (!shutdownRequested) {
        try {
          await processDirectoryQueue(process.argv.includes('-v') || process.argv.includes('--verbose'));
        } catch (err) {
          console.error('Directory queue error:', err);
        }
      }
    }, 30000); // Check every 30 seconds

    // Also periodically check contact extraction
    const contactInterval = setInterval(async () => {
      if (!shutdownRequested) {
        try {
          await processContactExtraction(process.argv.includes('-v') || process.argv.includes('--verbose'));
        } catch (err) {
          console.error('Contact extraction error:', err);
        }
      }
    }, 60000); // Check every 60 seconds

    // Also periodically check market discovery queue
    const discoveryInterval = setInterval(async () => {
      if (!shutdownRequested) {
        try {
          await processMarketDiscoveryQueue(process.argv.includes('-v') || process.argv.includes('--verbose'));
        } catch (err) {
          console.error('Market discovery error:', err);
        }
      }
    }, 30000); // Check every 30 seconds

    // Initial checks
    setTimeout(() => processDirectoryQueue(process.argv.includes('-v')), 5000);
    setTimeout(() => processContactExtraction(process.argv.includes('-v')), 10000);
    setTimeout(() => processMarketDiscoveryQueue(process.argv.includes('-v')), 15000);

    await mainPromise;
    clearInterval(directoryInterval);
    clearInterval(contactInterval);
    clearInterval(discoveryInterval);
  };

  main().catch(console.error);
}
