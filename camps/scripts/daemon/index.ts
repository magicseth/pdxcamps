#!/usr/bin/env npx tsx
/**
 * Scraper Development Daemon
 *
 * Watches the database for scraper development requests and spawns
 * Claude Code to write custom scrapers for each site. Also processes
 * directory queue, contact extraction, and market discovery.
 *
 * Usage:
 *   npx tsx scripts/daemon/index.ts
 *   npx tsx scripts/daemon/index.ts -w 5 -v
 *   npx tsx scripts/daemon/index.ts --directory    # One-shot directory processing
 *   npx tsx scripts/daemon/index.ts --contact      # One-shot contact extraction
 *   npx tsx scripts/daemon/index.ts --discovery    # One-shot market discovery
 */

import { api } from '../../convex/_generated/api';
import * as fs from 'fs';
import {
  client,
  writeLog,
  logQueueStatus,
  sleep,
  POLL_INTERVAL_MS,
  LOG_FILE,
  SCRATCHPAD_DIR,
} from './shared';
import { DevelopmentRequest, WorkerState } from './types';
import { processRequest } from './scraper-worker';
import { processDirectoryQueue } from './directory-worker';
import { processContactExtraction } from './contact-worker';
import { processMarketDiscoveryQueue, setShutdownFlag } from './discovery-worker';

const workers: Map<string, WorkerState> = new Map();
let shutdownRequested = false;

// ============================================
// ARG PARSING
// ============================================

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

function getCitySlug(): string | undefined {
  const idx = process.argv.findIndex((arg) => arg === '--city');
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return undefined;
}

async function getCityIdFromSlug(slug: string): Promise<string | null> {
  try {
    const cities = await client.query(api.cities.queries.listAllCities, {});
    const city = (cities as any[]).find((c: any) => c.slug === slug);
    if (city) return city._id;
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

// ============================================
// STUCK REQUEST RECOVERY
// ============================================

const STUCK_TIMEOUT_MS = 25 * 60 * 1000; // 25 minutes

async function recoverStuckRequests(verbose: boolean) {
  try {
    const inProgressRequests = await client.query(api.scraping.development.listRequests, {
      status: 'in_progress' as any,
      limit: 50,
    });

    if (!inProgressRequests || inProgressRequests.length === 0) return;

    const now = Date.now();
    for (const request of inProgressRequests as any[]) {
      const startedAt = request.claudeSessionStartedAt;
      if (!startedAt || now - startedAt < STUCK_TIMEOUT_MS) continue;

      const stuckMinutes = Math.round((now - startedAt) / 60000);
      const msg = `Auto-reset: previous session timed out after ${stuckMinutes} minutes`;

      console.log(`🔄 Resetting stuck request: ${request.sourceName} (${stuckMinutes}m old)`);
      writeLog(`Stuck recovery: ${request.sourceName} - ${msg}`);

      try {
        // Submit auto-feedback noting the timeout
        await client.mutation(api.scraping.development.submitFeedback, {
          requestId: request._id,
          feedback: msg,
          feedbackBy: 'stuck-recovery',
        });
      } catch {
        // If submitFeedback fails (e.g., wrong status), just force restart
        try {
          await client.mutation(api.scraping.development.forceRestart, {
            requestId: request._id,
          });
        } catch (e) {
          if (verbose) console.log(`   Failed to reset ${request.sourceName}: ${e}`);
        }
      }
    }
  } catch (err) {
    if (verbose) console.log(`   Stuck recovery check failed: ${err}`);
  }
}

// ============================================
// WORKER MANAGEMENT
// ============================================

async function processRequestAsync(
  worker: WorkerState,
  request: DevelopmentRequest,
  verbose: boolean,
) {
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

// ============================================
// MAIN DAEMON LOOP
// ============================================

async function runDaemon() {
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
  console.log(`   Convex: ${process.env.NEXT_PUBLIC_CONVEX_URL}`);
  console.log(`   Workers: ${workerCount}`);
  if (cityId && cityName) {
    console.log(`   City: ${cityName} (${citySlug})`);
  } else {
    console.log(`   City: All markets`);
  }
  console.log(`   Logs: tail -f ${LOG_FILE}`);
  if (verbose) console.log('   Mode: Verbose');
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
    setShutdownFlag(true);
    for (const worker of workers.values()) {
      if (worker.process) {
        worker.process.kill();
      }
    }
    setTimeout(() => process.exit(0), 1000);
  });

  // Timing trackers for secondary queues
  let lastDirectoryCheck = 0;
  let lastContactCheck = 0;
  let lastDiscoveryCheck = 0;
  let lastStuckCheck = 0;

  // Initial checks (staggered)
  setTimeout(() => processDirectoryQueue(verbose).catch(() => {}), 5000);
  setTimeout(() => processContactExtraction(verbose).catch(() => {}), 10000);
  setTimeout(() => processMarketDiscoveryQueue(verbose).catch(() => {}), 15000);

  // Main polling loop
  while (!shutdownRequested) {
    const now = Date.now();

    try {
      // Find idle workers and claim scraper work
      const idleWorkers = Array.from(workers.values()).filter((w) => !w.busy);

      for (const worker of idleWorkers) {
        if (shutdownRequested) break;

        try {
          const request = await client.mutation(api.scraping.development.getNextAndClaim, {
            workerId: worker.id,
            ...(cityId ? { cityId: cityId as any } : {}),
          });

          if (request) {
            worker.busy = true;
            worker.currentRequest = request as DevelopmentRequest;

            await logQueueStatus(`[${worker.id}] `);
            console.log(`[${worker.id}] 🚀 Starting: ${request.sourceName}`);
            writeLog(`[${worker.id}] Claimed: ${request.sourceName}`);

            processRequestAsync(worker, request as DevelopmentRequest, verbose);
          }
        } catch (error) {
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

      // Directory queue (every 30s)
      if (now - lastDirectoryCheck >= 30000) {
        lastDirectoryCheck = now;
        processDirectoryQueue(verbose).catch((err) => {
          console.error('Directory queue error:', err);
        });
      }

      // Contact extraction (every 60s)
      if (now - lastContactCheck >= 60000) {
        lastContactCheck = now;
        processContactExtraction(verbose).catch((err) => {
          console.error('Contact extraction error:', err);
        });
      }

      // Market discovery (every 30s)
      if (now - lastDiscoveryCheck >= 30000) {
        lastDiscoveryCheck = now;
        processMarketDiscoveryQueue(verbose).catch((err) => {
          console.error('Market discovery error:', err);
        });
      }

      // Stuck request recovery (every 60s)
      if (now - lastStuckCheck >= 60000) {
        lastStuckCheck = now;
        recoverStuckRequests(verbose).catch((err) => {
          if (verbose) console.error('Stuck recovery error:', err);
        });
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

// ============================================
// ENTRY POINT
// ============================================

const directoryOnly = process.argv.includes('--directory') || process.argv.includes('-d');
const contactOnly = process.argv.includes('--contact');
const discoveryOnly = process.argv.includes('--discovery') || process.argv.includes('-D');

if (directoryOnly) {
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
  runDaemon().catch(console.error);
}
