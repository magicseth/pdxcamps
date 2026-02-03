import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ConvexClientProvider } from '@/components/ConvexClientProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'PDX Camps',
    template: '%s | PDX Camps',
  },
  description: 'Discover and organize summer camps for your kids in Portland',
  icons: {
    icon: [
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'PDX Camps',
    description: 'Discover and organize summer camps for your kids in Portland',
    type: 'website',
    locale: 'en_US',
    siteName: 'PDX Camps',
  },
  twitter: {
    card: 'summary',
    title: 'PDX Camps',
    description: 'Discover and organize summer camps for your kids in Portland',
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    'theme-color': '#2563eb',
    'color-scheme': 'light dark',
  },
};

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
