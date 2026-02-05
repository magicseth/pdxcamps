import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ============================================
// SCRAPING CRONS
// ============================================

// Run scheduled scrapes every 15 minutes
// This action queries all sources due for scraping and executes them
crons.interval(
  "scrape scheduler",
  { minutes: 15 },
  internal.scraping.actions.runScheduledScrapes,
  {}
);

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
// MAINTENANCE CRONS
// ============================================

// Run data quality checks daily at 6 AM PST (2 PM UTC)
// Detects sources with no scrapers, high zero-price ratios, low quality scores,
// and stale scrapes. Creates alerts for issues found.
crons.daily(
  "data quality checks",
  { hourUTC: 14, minuteUTC: 0 },
  internal.scraping.dataQualityActions.runDataQualityChecks,
  {}
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

export default crons;
