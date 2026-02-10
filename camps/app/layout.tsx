import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';
import { fetchQuery } from 'convex/nextjs';
import './globals.css';
import { ConvexClientProvider } from '@/components/ConvexClientProvider';
import { FeedbackButton } from '@/components/shared/FeedbackButton';
import { LoginTracker } from '@/components/LoginTracker';
import { getMarketFromHostname, getMarketBySlug, DEFAULT_MARKET, type Market } from '@/lib/markets';
import { api } from '@/convex/_generated/api';
import { JsonLd } from '@/components/shared/JsonLd';

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
 * Get icon URL for a city - always uses Convex HTTP action for dynamic serving
 */
function getIconUrl(slug: string): string {
  return `${CONVEX_SITE_URL}/city-icon/${slug}`;
}

/**
 * Get market from database (SSR) with fallback to static config
 */
async function getMarketSSR(hostname: string): Promise<Market & { iconStorageId?: string }> {
  const domain = hostname
    .split(':')[0]
    .toLowerCase()
    .replace(/^www\./, '');

  try {
    const city = await fetchQuery(api.cities.queries.getCityByDomain, { domain });

    if (city) {
      // Use static market config as base if it exists (has correct iconPath, themeColor, etc.)
      const staticMarket = getMarketBySlug(city.slug);
      return {
        ...(staticMarket || {
          emoji: '🏕️',
          popularOrgs: '',
          neighborhoods: '',
          testimonialAttribution: `${city.name} parent of 2`,
          iconPath: `/icons/${city.slug.split('-')[0]}`,
          themeColor: '#2563eb',
        }),
        slug: city.slug,
        name: city.name,
        tagline: city.brandName || `${city.name} Camps`,
        region: `${city.name} Metro Area`,
        domains: [city.domain, `www.${city.domain}`].filter(Boolean) as string[],
        madeIn: city.name,
        iconStorageId: city.iconStorageId,
      };
    }
  } catch (error) {
    console.error('Failed to fetch market from DB:', error);
  }

  // Fallback to static config
  return getMarketFromHostname(hostname);
}

export const viewport: Viewport = {
  viewportFit: 'cover',
};

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost';
  const market = await getMarketSSR(host);

  // Use Convex HTTP action if the city has a stored icon, otherwise fall back to static files
  const iconUrl = market.iconStorageId
    ? getIconUrl(market.slug)
    : `${market.iconPath}/icon.png`;
  const icon192Url = market.iconStorageId
    ? getIconUrl(market.slug)
    : `${market.iconPath}/icon-192.png`;
  const appleIconUrl = market.iconStorageId
    ? getIconUrl(market.slug)
    : `${market.iconPath}/apple-icon.png`;

  return {
    title: {
      default: market.tagline,
      template: `%s | ${market.tagline}`,
    },
    description: `Find and organize summer camps for your kids in ${market.name}. Compare dates, prices, and ages for hundreds of programs. Free for ${market.name} families — Summer ${new Date().getFullYear()}.`,
    icons: {
      icon: [
        { url: iconUrl, sizes: '32x32', type: 'image/png' },
        { url: icon192Url, sizes: '192x192', type: 'image/png' },
      ],
      apple: [{ url: appleIconUrl, sizes: '180x180', type: 'image/png' }],
    },
    openGraph: {
      title: market.tagline,
      description: `Find camps near you, coordinate with friends, and plan your kids' entire summer in one place. Free for ${market.name} families.`,
      type: 'website',
      locale: 'en_US',
      siteName: market.tagline,
    },
    twitter: {
      card: 'summary_large_image',
      title: market.tagline,
      description: `Find camps near you, coordinate with friends, and plan your kids' entire summer in one place. Free for ${market.name} families.`,
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost';
  const market = await getMarketSSR(host);

  // Serialize SSR-resolved market data so client components can hydrate instantly
  // without waiting for a separate Convex query (prevents broken image flash, wrong brand name, etc.)
  const ssrMarketData = JSON.stringify({
    slug: market.slug,
    name: market.name,
    tagline: market.tagline,
    iconStorageId: market.iconStorageId,
    iconPath: market.iconPath,
    themeColor: market.themeColor,
    domains: market.domains,
  });

  return (
    <html lang="en" data-market-slug={market.slug} data-market-ssr={ssrMarketData}>
      <head>
        <link rel="dns-prefetch" href="https://deafening-schnauzer-923.convex.cloud" />
        <link rel="preconnect" href="https://deafening-schnauzer-923.convex.cloud" crossOrigin="anonymous" />
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: market.tagline,
          url: market.domains?.[0] ? `https://${market.domains[0]}` : 'https://pdxcamps.com',
          description: `Discover and organize summer camps for your kids in ${market.name}. Browse programs, compare schedules, coordinate with friends, and plan your entire summer in one place.`,
          applicationCategory: 'LifestyleApplication',
          operatingSystem: 'Web',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            description: 'Free to get started with up to 5 saved camps',
          },
          featureList: [
            'Browse summer camps by week, category, and location',
            'Save and compare camp sessions',
            'Coordinate schedules with friends',
            'Track registration deadlines',
            'Share summer plans with family',
          ],
        }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Script
          id="reddit-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js";t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
rdt('init','a2_g4x85lm7fkgd');
rdt('track', 'PageVisit');
`,
          }}
        />
        <ConvexClientProvider>
          <LoginTracker />
          {children}
          <FeedbackButton />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
