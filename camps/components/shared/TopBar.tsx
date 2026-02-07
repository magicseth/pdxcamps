'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMarket } from '@/hooks/useMarket';

// Convex HTTP actions URL for serving dynamic assets
const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://deafening-schnauzer-923.convex.site';

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  const market = useMarket();

  // Use Convex storage if available, otherwise static path
  const iconUrl = market.iconStorageId
    ? `${CONVEX_SITE_URL}/city-icon/${market.slug}`
    : `${market.iconPath}/apple-icon.png`;

  return (
    <header className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 z-20">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src={iconUrl}
            alt={market.tagline}
            width={192}
            height={192}
            className="h-8 w-8"
            priority
            unoptimized={!!market.iconStorageId}
          />
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

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}
