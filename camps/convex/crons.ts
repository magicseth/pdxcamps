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
