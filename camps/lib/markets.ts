export interface Market {
  slug: string;
  name: string;
  tagline: string;
  region: string;
  domains: string[]; // All domains that should show this market
  emoji: string;
  // Market-specific copy
  popularOrgs: string; // e.g., "OMSI, Oregon Zoo, Portland Parks"
  neighborhoods: string; // e.g., "Portland, Beaverton, Lake Oswego"
  testimonialAttribution: string; // e.g., "Portland parent of 2"
  madeIn: string; // e.g., "Portland"
  // Branding
  iconPath: string; // e.g., "/icons/pdx" - will have /icon.png, /icon-192.png, /apple-icon.png
  iconStorageId?: string; // Convex storage ID for dynamically stored icon
  themeColor: string;
}

export const MARKETS: Market[] = [
  {
    slug: 'portland',
    name: 'Portland',
    tagline: 'PDX Camps',
    region: 'Portland Metro Area',
    domains: ['pdxcamps.com', 'www.pdxcamps.com', 'localhost'],
    emoji: '🌲',
    popularOrgs: 'OMSI, Oregon Zoo, Portland Parks',
    neighborhoods: 'Portland, Beaverton, Lake Oswego, Tigard, West Linn',
    testimonialAttribution: 'Portland parent of 2',
    madeIn: 'Portland',
    iconPath: '/icons/pdx',
    themeColor: '#2563eb',
  },
  {
    slug: 'boston',
    name: 'Boston',
    tagline: 'BOS Camps',
    region: 'Greater Boston Area',
    domains: ['boscamps.com', 'www.boscamps.com'],
    emoji: '🦞',
    popularOrgs: 'Museum of Science, New England Aquarium, Boston Parks',
    neighborhoods: 'Boston, Cambridge, Brookline, Newton, Somerville',
    testimonialAttribution: 'Boston parent of 2',
    madeIn: 'Boston',
    iconPath: '/icons/bos',
    themeColor: '#dc2626',
  },
  {
    slug: 'denver',
    name: 'Denver',
    tagline: 'DEN Camps',
    region: 'Denver Metro Area',
    domains: ['dencamps.com', 'www.dencamps.com'],
    emoji: '🏔️',
    popularOrgs: 'Denver Museum of Nature & Science, Denver Zoo, Denver Parks',
    neighborhoods: 'Denver, Aurora, Lakewood, Littleton, Boulder',
    testimonialAttribution: 'Denver parent of 2',
    madeIn: 'Denver',
    iconPath: '/icons/den',
    themeColor: '#7c3aed', // Purple for mountains
  },
  {
    slug: 'san-francisco',
    name: 'San Francisco',
    tagline: 'SFB Camps',
    region: 'San Francisco Bay Area',
    domains: ['sfbaycamps.com', 'www.sfbaycamps.com'],
    emoji: '🌉',
    popularOrgs: 'California Academy of Sciences, Exploratorium, SF Parks',
    neighborhoods: 'San Francisco, Oakland, Berkeley, Palo Alto, San Jose',
    testimonialAttribution: 'Bay Area parent of 2',
    madeIn: 'San Francisco',
    iconPath: '/icons/sfb',
    themeColor: '#f97316', // Orange for Golden Gate
  },
  {
    slug: 'seattle',
    name: 'Seattle',
    tagline: 'Seattle Camp Guide',
    region: 'Greater Seattle Area',
    domains: ['seattlecampguide.com', 'www.seattlecampguide.com'],
    emoji: '☕',
    popularOrgs: 'Pacific Science Center, Woodland Park Zoo, Seattle Parks',
    neighborhoods: 'Seattle, Bellevue, Redmond, Kirkland, Bothell',
    testimonialAttribution: 'Seattle parent of 2',
    madeIn: 'Seattle',
    iconPath: '/icons/sea',
    themeColor: '#059669', // Green for evergreens
  },
  {
    slug: 'mix',
    name: 'Mix Camps',
    tagline: 'Mix Camps',
    region: 'Nationwide',
    domains: ['mixcamps.com', 'www.mixcamps.com'],
    emoji: '',
    popularOrgs: '',
    neighborhoods: '',
    testimonialAttribution: '',
    madeIn: '',
    iconPath: '/icons/mix',
    themeColor: '#2563eb',
  },
];

export const DEFAULT_MARKET = MARKETS[0]; // Portland as fallback

/**
 * Get market configuration based on hostname
 */
export function getMarketFromHostname(hostname: string): Market {
  // Remove port if present
  const host = hostname.split(':')[0].toLowerCase();

  const market = MARKETS.find((m) => m.domains.some((domain) => host === domain || host.endsWith('.' + domain)));

  return market || DEFAULT_MARKET;
}

/**
 * Get market by slug
 */
export function getMarketBySlug(slug: string): Market | undefined {
  return MARKETS.find((m) => m.slug === slug);
}
