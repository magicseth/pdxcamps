'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMarket } from '@/hooks/useMarket';
import { SettingsIcon } from './icons';

// Convex HTTP actions URL for serving dynamic assets
const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://deafening-schnauzer-923.convex.site';

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  const market = useMarket();

  // Always serve from Convex HTTP action for dynamic city support
  const iconUrl = `${CONVEX_SITE_URL}/city-icon/${market.slug}`;

  return (
    <header className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 z-20">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src={iconUrl} alt={market.tagline} width={192} height={192} className="h-8 w-8" priority unoptimized />
          <span className="font-bold text-lg text-slate-900 dark:text-white">{market.tagline}</span>
        </Link>

        <Link
          href="/settings"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon />
        </Link>
      </div>
    </header>
  );
}
