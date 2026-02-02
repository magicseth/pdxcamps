/**
 * Standard interface for all scrapers
 * Every scraper must export a function matching this signature
 */

import { Id } from "../../_generated/dataModel";

// Scraped camp session data - normalized format
export interface ScrapedSession {
  // Required fields
  name: string;

  // Dates
  startDate?: string; // ISO format YYYY-MM-DD
  endDate?: string;
  dateRaw?: string; // Original date string for debugging

  // Times
  dropOffHour?: number;
  dropOffMinute?: number;
  pickUpHour?: number;
  pickUpMinute?: number;
  timeRaw?: string;

  // Pricing (in cents)
  priceInCents?: number;
  memberPriceInCents?: number;
  priceRaw?: string;

  // Age/grade requirements
  minAge?: number;
  maxAge?: number;
  minGrade?: number;
  maxGrade?: number;
  ageGradeRaw?: string;

  // Location
  location?: string;

  // Availability
  isAvailable?: boolean;
  availabilityRaw?: string;

  // URLs
  registrationUrl?: string;
  infoUrl?: string;

  // Images
  imageUrls?: string[];

  // Metadata
  description?: string;
  category?: string;

  // Source tracking
  sourceProductId?: string; // External ID from source system
  sourceSessionId?: string;
}

// Scraped organization/camp provider data
export interface ScrapedOrganization {
  name: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
}

// Result from running a scraper
export interface ScrapeResult {
  success: boolean;
  sessions: ScrapedSession[];
  organization?: ScrapedOrganization;
  error?: string;

  // Metadata
  scrapedAt: number;
  durationMs: number;
  pagesScraped: number;
  rawDataSummary?: string; // Brief summary of what was fetched
}

// Configuration passed to scrapers
export interface ScraperConfig {
  sourceId: Id<"scrapeSources">;
  url: string;
  name: string;
  organizationId?: Id<"organizations">;

  // Custom config per scraper (stored in DB)
  customConfig?: Record<string, unknown>;
}

// Logger function type for scrapers to use
export type ScraperLogger = (
  level: "INFO" | "DEBUG" | "WARN" | "ERROR",
  message: string,
  data?: unknown
) => void;

// Standard scraper function signature
export type ScraperFunction = (
  config: ScraperConfig,
  log: ScraperLogger
) => Promise<ScrapeResult>;

// Registry entry for a scraper
export interface ScraperRegistryEntry {
  name: string;
  description: string;
  scrape: ScraperFunction;
  // Domains this scraper handles (for auto-matching)
  domains?: string[];
}
