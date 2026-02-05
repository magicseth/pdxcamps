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

/**
 * Get market from database (SSR) with fallback to static config
 */
async function getMarketSSR(hostname: string): Promise<Market> {
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
        iconPath: `/icons/${city.slug.split('-')[0]}`, // Use first part of slug for icon path
        themeColor: '#2563eb',
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

  return {
    title: {
      default: market.tagline,
      template: `%s | ${market.tagline}`,
    },
    description: `Discover and organize summer camps for your kids in ${market.name}`,
    icons: {
      icon: [
        { url: `${market.iconPath}/icon.png`, sizes: '32x32', type: 'image/png' },
        { url: `${market.iconPath}/icon-192.png`, sizes: '192x192', type: 'image/png' },
      ],
      apple: [
        { url: `${market.iconPath}/apple-icon.png`, sizes: '180x180', type: 'image/png' },
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
