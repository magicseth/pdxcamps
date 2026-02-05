import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import { fetchQuery } from 'convex/nextjs';
import './globals.css';
import { ConvexClientProvider } from '@/components/ConvexClientProvider';
import { getMarketFromHostname, DEFAULT_MARKET, type Market } from '@/lib/markets';
import { api } from '@/convex/_generated/api';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Convex HTTP actions URL for serving dynamic assets
const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://deafening-schnauzer-923.convex.site';

/**
 * Get icon URL for a city - uses Convex storage if available, falls back to static
 */
function getIconUrl(city: { slug: string; iconStorageId?: string }): string {
  if (city.iconStorageId) {
    // Serve from Convex HTTP action
    return `${CONVEX_SITE_URL}/city-icon/${city.slug}`;
  }
  // Fallback to static icons (first part of slug, e.g., "san" from "san-francisco-bay-area")
  return `/icons/${city.slug.split('-')[0]}/icon.png`;
}

/**
 * Get market from database (SSR) with fallback to static config
 */
async function getMarketSSR(hostname: string): Promise<Market & { iconStorageId?: string }> {
  const domain = hostname.split(':')[0].toLowerCase().replace(/^www\./, '');

  try {
    const city = await fetchQuery(api.cities.queries.getCityByDomain, { domain });

    if (city) {
      return {
        slug: city.slug,
        name: city.name,
        tagline: city.brandName || `${city.name} Camps`,
        region: `${city.name} Metro Area`,
        domains: [city.domain, `www.${city.domain}`].filter(Boolean) as string[],
        emoji: '🏕️',
        popularOrgs: '',
        neighborhoods: '',
        testimonialAttribution: `${city.name} parent of 2`,
        madeIn: city.name,
        iconPath: `/icons/${city.slug.split('-')[0]}`, // Fallback static path
        themeColor: '#2563eb',
        iconStorageId: city.iconStorageId,
      };
    }
  } catch (error) {
    console.error('Failed to fetch market from DB:', error);
  }

  // Fallback to static config
  return getMarketFromHostname(hostname);
}

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost';
  const market = await getMarketSSR(host);

  // Use Convex storage URL if icon is stored there, otherwise static path
  const iconUrl = market.iconStorageId
    ? `${CONVEX_SITE_URL}/city-icon/${market.slug}`
    : `${market.iconPath}/icon.png`;

  const icon192Url = market.iconStorageId
    ? `${CONVEX_SITE_URL}/city-icon/${market.slug}` // Same URL, browser will cache
    : `${market.iconPath}/icon-192.png`;

  const appleIconUrl = market.iconStorageId
    ? `${CONVEX_SITE_URL}/city-icon/${market.slug}`
    : `${market.iconPath}/apple-icon.png`;

  return {
    title: {
      default: market.tagline,
      template: `%s | ${market.tagline}`,
    },
    description: `Discover and organize summer camps for your kids in ${market.name}`,
    icons: {
      icon: [
        { url: iconUrl, sizes: '32x32', type: 'image/png' },
        { url: icon192Url, sizes: '192x192', type: 'image/png' },
      ],
      apple: [
        { url: appleIconUrl, sizes: '180x180', type: 'image/png' },
      ],
    },
    openGraph: {
      title: market.tagline,
      description: `Discover and organize summer camps for your kids in ${market.name}`,
      type: 'website',
      locale: 'en_US',
      siteName: market.tagline,
    },
    twitter: {
      card: 'summary',
      title: market.tagline,
      description: `Discover and organize summer camps for your kids in ${market.name}`,
    },
    robots: {
      index: true,
      follow: true,
    },
    other: {
      'theme-color': market.themeColor,
      'color-scheme': 'light dark',
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
