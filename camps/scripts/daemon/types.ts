/**
 * Shared types for the scraper daemon
 */

export interface DevelopmentRequest {
  _id: string;
  sourceName: string;
  sourceUrl: string;
  sourceId?: string;
  cityId?: string;
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
  claudeSessionStartedAt?: number;
}

export interface WorkerState {
  id: string;
  busy: boolean;
  currentRequest?: DevelopmentRequest;
  process?: import('child_process').ChildProcess;
}

export interface SiteExplorationResult {
  siteType: string;
  hasMultipleLocations: boolean;
  locations: Array<{ name: string; url?: string; siteId?: string }>;
  hasCategories: boolean;
  categories: Array<{ name: string; id?: string }>;
  registrationSystem?: string;
  urlPatterns: string[];
  navigationNotes: string[];
  rawPageSummary?: string;
  isDirectory?: boolean;
  directoryLinks?: Array<{ url: string; name: string; isInternal?: boolean }>;
}

export interface TestResult {
  sessions: any[];
  error?: string;
  diagnostics?: ScraperDiagnostics;
}

export interface ScraperDiagnostics {
  siteType: 'static' | 'react_spa' | 'active_communities' | 'api_driven' | 'unknown';
  possibleIssues: string[];
  suggestedFixes: string[];
  detectedPatterns: string[];
}

export interface DirectoryQueueItem {
  _id: string;
  cityId: string;
  url: string;
  status: string;
  linkPattern?: string;
  baseUrlFilter?: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  contactName?: string;
  contactTitle?: string;
  address?: string;
}

export interface DiscoveryTask {
  _id: string;
  cityId: string;
  regionName: string;
  status: string;
  searchQueries: string[];
  maxSearchResults?: number;
}

export interface DiscoveredUrl {
  url: string;
  source: string;
  title?: string;
  domain: string;
}
