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
];

export const DEFAULT_MARKET = MARKETS[0]; // Portland as fallback

/**
 * Get market configuration based on hostname
 */
export function getMarketFromHostname(hostname: string): Market {
  // Remove port if present
  const host = hostname.split(':')[0].toLowerCase();

  const market = MARKETS.find(m =>
    m.domains.some(domain => host === domain || host.endsWith('.' + domain))
  );

  return market || DEFAULT_MARKET;
}

/**
 * Get market by slug
 */
export function getMarketBySlug(slug: string): Market | undefined {
  return MARKETS.find(m => m.slug === slug);
}
