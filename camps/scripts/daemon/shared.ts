/**
 * Shared utilities, constants, and client setup for the scraper daemon
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import * as path from 'path';
import * as fs from 'fs';

// Load environment from .env.local, but don't overwrite existing env vars
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const trimmedKey = key.trim();
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

export const client = new ConvexHttpClient(CONVEX_URL);

// Stagehand is optional - only used for testing scrapers
let StagehandClass: any = null;
try {
  StagehandClass = require('@browserbasehq/stagehand').Stagehand;
} catch {
  // Stagehand not installed - testing will be skipped
}

export { StagehandClass };

// Constants
export const POLL_INTERVAL_MS = 5000;
export const CLAUDE_TIMEOUT_MS = 20 * 60 * 1000;

// Scratchpad directory for Claude Code work
export const SCRATCHPAD_DIR = path.join(process.cwd(), '..', '.scraper-development');
if (!fs.existsSync(SCRATCHPAD_DIR)) {
  fs.mkdirSync(SCRATCHPAD_DIR, { recursive: true });
}

export const LOG_FILE = path.join(SCRATCHPAD_DIR, 'daemon.log');

export function writeLog(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

export async function logQueueStatus(prefix: string = '') {
  try {
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

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a Stagehand instance with centralized model config
 */
export async function createStagehand(model: 'sonnet' | 'haiku' = 'sonnet'): Promise<any> {
  if (!StagehandClass) {
    throw new Error('Stagehand not available - install @browserbasehq/stagehand');
  }

  if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    throw new Error('Missing BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID');
  }

  if (!process.env.MODEL_API_KEY) {
    throw new Error('Missing MODEL_API_KEY environment variable');
  }

  const modelName =
    model === 'haiku'
      ? 'anthropic/claude-haiku-4-5-20251001'
      : 'anthropic/claude-sonnet-4-20250514';

  const stagehand = new StagehandClass({
    env: 'BROWSERBASE',
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    model: {
      modelName,
      apiKey: process.env.MODEL_API_KEY,
    },
    disablePino: true,
    verbose: 0,
  });

  await stagehand.init();
  return stagehand;
}

// Known camp directory domains
export const KNOWN_DIRECTORIES = [
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
export const CAMP_SIGNAL_KEYWORDS = [
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
export const SKIP_URL_PATTERNS = [
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

export function shouldSkipDiscoveryUrl(url: string): boolean {
  return SKIP_URL_PATTERNS.some((pattern) => pattern.test(url));
}

export function extractDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
