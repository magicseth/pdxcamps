import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ConvexClientProvider } from '@/components/ConvexClientProvider';
import { getMarketFromHostname, DEFAULT_MARKET } from '@/lib/markets';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost';
  const market = getMarketFromHostname(host);

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
