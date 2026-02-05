import { Id } from '../../../convex/_generated/dataModel';

export interface MarketWithStatus {
  // Static market data
  key: string;
  name: string;
  state: string;
  tier: 1 | 2 | 3;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  timezone: string;
  suggestedDomains: string[];
  suggestedBrandName: string;
  keyStats: string;
  whyStrong: string;

  // DB status
  dbId?: Id<'expansionMarkets'>;
  selectedDomain?: string;
  domainPurchased: boolean;
  domainPurchasedAt?: number;
  dnsConfigured: boolean;
  netlifyZoneId?: string;
  cityId?: Id<'cities'>;
  status:
    | 'not_started'
    | 'domain_purchased'
    | 'dns_configured'
    | 'city_created'
    | 'launched';
  createdAt?: number;
  updatedAt?: number;

  // Stats (only available if city exists)
  stats?: {
    sources: number;
    orgs: number;
    sessions: number;
  } | null;

  // Icon generation
  iconOptions?: string[] | null;
  iconPrompt?: string;
  selectedIconStorageId?: string;
  selectedIconSourceUrl?: string;
}

export type ExpansionStatus = MarketWithStatus['status'];

export const STATUS_LABELS: Record<ExpansionStatus, string> = {
  not_started: 'Not Started',
  domain_purchased: 'Domain Purchased',
  dns_configured: 'DNS Configured',
  city_created: 'City Created',
  launched: 'Launched',
};

export const STATUS_COLORS: Record<ExpansionStatus, string> = {
  not_started: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  domain_purchased: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  dns_configured: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  city_created: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  launched: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};
