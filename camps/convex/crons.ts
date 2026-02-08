import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// ============================================
// NOTIFICATION CRONS
// ============================================

// Hourly notification digest - sends availability alerts to families
// Notifies when camps they saved open for registration or have low availability
crons.interval(
  'availability notification digest',
  { hours: 1 },
  internal.notifications.actions.processHourlyDigest,
  {},
);

// ============================================
// EMAIL AUTOMATION CRONS
// ============================================

// Daily re-engagement check at 10 AM PST (6 PM UTC)
// Sends "X new camps added" email to users inactive 7+ days
crons.daily(
  'daily re-engagement check',
  { hourUTC: 18, minuteUTC: 0 },
  internal.emailAutomation.actions.processReEngagement,
  {},
);

// Weekly digest every Monday at 8 AM PST (4 PM UTC)
// Sends planning update with new camps, saved camp status, filling up alerts
crons.weekly(
  'weekly digest email',
  { dayOfWeek: 'monday', hourUTC: 16, minuteUTC: 0 },
  internal.emailAutomation.actions.processWeeklyDigest,
  {},
);

// Summer countdown every Monday at 9 AM PST (5 PM UTC), Feb-May only
// Sends "X weeks until summer" with real stats
crons.weekly(
  'summer countdown email',
  { dayOfWeek: 'monday', hourUTC: 17, minuteUTC: 0 },
  internal.emailAutomation.actions.processSummerCountdown,
  {},
);

// ============================================
// SCRAPING CRONS
// ============================================

// Run scheduled scrapes every 15 minutes
// This action queries all sources due for scraping and executes them
crons.interval('scrape scheduler', { minutes: 15 }, internal.scraping.actions.runScheduledScrapes, {});

// Directory queue is processed by local daemon (Claude Code)
// Not using cron - call api.scraping.directoryDaemon.processDirectoryQueue manually

// ============================================
// DISCOVERY CRONS
// ============================================

// Run discovery search daily at 2 AM PST (10 AM UTC)
// This finds new camp sources via web search for each active city
// Uncomment when SerpAPI is configured:
//
// crons.daily(
//   "discovery search - Portland",
//   { hourUTC: 10, minuteUTC: 0 },
//   internal.discovery.actions.executeDiscoverySearch,
//   { cityId: "PORTLAND_CITY_ID", query: "Portland summer camps for kids 2025" }
// );

// Analyze pending discoveries every 30 minutes
// This uses Claude to analyze URLs and determine if they're camp sites
// Uncomment when Claude API is configured:
//
// crons.interval(
//   "analyze discoveries",
//   { minutes: 30 },
//   internal.discovery.actions.batchAnalyzeDiscoveredUrls,
//   { sourceIds: [] } // Will be populated dynamically
// );

// ============================================
// PLANNER AGGREGATES
// ============================================

// Recompute weekly availability counts every 30 minutes
// Keeps planner grid session counts fresh without per-request computation
crons.interval('recompute weekly availability', { minutes: 30 }, internal.planner.aggregates.recomputeAll, {});

// ============================================
// IMAGE BACKFILL CRONS
// ============================================

// Backfill camp images every 6 hours
// Downloads scraped image URLs, then generates AI images for camps without any
crons.interval(
  'backfill camp images',
  { hours: 6 },
  internal.scraping.generateImages.startBackfill,
  {},
);

// ============================================
// MAINTENANCE CRONS
// ============================================

// Run data quality checks daily at 6 AM PST (2 PM UTC)
// Detects sources with no scrapers, high zero-price ratios, low quality scores,
// and stale scrapes. Creates alerts for issues found.
crons.daily(
  'data quality checks',
  { hourUTC: 14, minuteUTC: 0 },
  internal.scraping.dataQualityActions.runDataQualityChecks,
  {},
);

// Auto-queue scraper development every 6 hours
// Finds sources needing regeneration or missing scrapers and creates dev requests
crons.interval(
  'auto queue scraper development',
  { hours: 6 },
  internal.scraping.scraperAutomation.autoQueueScraperDevelopment,
  { maxToQueue: 5 },
);

// Clean up stale dev requests weekly (Sunday 3 AM PST / 11 AM UTC)
crons.weekly(
  'cleanup stale dev requests',
  { dayOfWeek: 'sunday', hourUTC: 11, minuteUTC: 0 },
  internal.scraping.scraperAutomation.cleanupStaleDevRequests,
  { maxAgeDays: 7 },
);

// URL discovery for broken sources - runs daily at 7 AM PST (3 PM UTC)
// Finds sources with 404 errors and tries to discover new URLs
crons.daily(
  'url discovery for broken sources',
  { hourUTC: 15, minuteUTC: 0 },
  internal.scraping.urlDiscovery.discoverUrlsForBrokenSources,
  { limit: 10 },
);

// Daily scraper report email - runs at 8 AM PST (4 PM UTC)
// Sends summary of scraping activity to seth@magicseth.com
crons.daily(
  'daily scraper report email',
  { hourUTC: 16, minuteUTC: 0 },
  internal.scraping.dailyReport.sendDailyReport,
  {},
);

// Source recovery - check disabled 404 sources weekly (Saturday 5 AM PST / 1 PM UTC)
// Re-enables sources whose URLs have come back online
crons.weekly(
  'source recovery check',
  { dayOfWeek: 'saturday', hourUTC: 13, minuteUTC: 0 },
  internal.scraping.sourceRecovery.checkDisabledSources,
  {},
);

// Clean up old scrape data weekly (keep 30 days)
// Runs on Sunday at midnight PST (8 AM UTC)
// Uncomment to enable:
//
// crons.weekly(
//   "cleanup old data",
//   { dayOfWeek: "sunday", hourUTC: 8, minuteUTC: 0 },
//   internal.scraping.internal.cleanupOldScrapeData,
//   { retentionDays: 30 }
// );

// Session deduplication - runs daily at 4 AM PST (12 PM UTC)
// Merges duplicate sessions (same camp, location, start/end dates)
crons.daily(
  'deduplicate sessions',
  { hourUTC: 12, minuteUTC: 0 },
  internal.cleanup.sessions.autoDeduplicateSessions,
  {},
);

// Cross-source duplicate detection - runs daily at 4:30 AM PST (12:30 PM UTC)
// Detects sessions from different sources that appear to be duplicates (alert-only, no auto-merge)
crons.daily(
  'cross-source duplicate detection',
  { hourUTC: 12, minuteUTC: 30 },
  internal.scraping.deduplication.detectAndAlertCrossSourceDuplicates,
  {},
);

// ============================================
// BLOG CONTENT CRONS
// ============================================

// Generate "New Camps This Week" blog post every Monday at 7 AM PST (3 PM UTC)
// Only publishes if 3+ new camp sessions were added in the past week
crons.weekly(
  'weekly blog update',
  { dayOfWeek: 'monday', hourUTC: 15, minuteUTC: 0 },
  internal.blog.actions.generateWeeklyUpdate,
  {},
);

export default crons;
