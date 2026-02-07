'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { User } from '@workos-inc/node';
import { useMarket, type Market } from '../../hooks/useMarket';
import { SettingsIcon, ShareIcon } from './icons';

// Convex HTTP actions URL for serving dynamic assets
const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://deafening-schnauzer-923.convex.site';

/**
 * Get icon URL - uses Convex storage if available, otherwise static path
 */
function getIconUrl(market: Market): string {
  if (market.iconStorageId) {
    return `${CONVEX_SITE_URL}/city-icon/${market.slug}`;
  }
  return `${market.iconPath}/apple-icon.png`;
}

interface YearSelectorProps {
  selectedYear: number;
  onPrevYear: () => void;
  onNextYear: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

interface AppHeaderProps {
  user: User | null;
  onSignOut: () => void;
  isPremium?: boolean;
  yearSelector?: YearSelectorProps;
  onShare?: () => void;
}

export function AppHeader({ user, onSignOut, isPremium, yearSelector, onShare }: AppHeaderProps) {
  const market = useMarket();
  const adminEmails = ['seth@magicseth.com'];
  const isAdmin = user?.email && adminEmails.includes(user.email);

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-20">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center">
            <Image
              src={getIconUrl(market)}
              alt={market.tagline}
              width={100}
              height={32}
              className="h-8 w-auto"
              priority
              unoptimized={!!market.iconStorageId}
            />
          </Link>

          {/* Year selector in header */}
          {yearSelector && (
            <div className="flex items-center gap-1">
              <button
                onClick={yearSelector.onPrevYear}
                disabled={!yearSelector.canGoPrev}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                aria-label="Previous year"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Summer {yearSelector.selectedYear}
              </span>
              <button
                onClick={yearSelector.onNextYear}
                disabled={!yearSelector.canGoNext}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                aria-label="Next year"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Share button in header */}
          {onShare && (
            <button
              onClick={onShare}
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Share schedule"
              aria-label="Share"
            >
              <ShareIcon />
            </button>
          )}

          {!isPremium && isPremium !== undefined && (
            <Link
              href="/upgrade"
              className="text-sm px-3 py-1.5 bg-gradient-to-r from-accent to-accent-dark text-white font-medium rounded-lg hover:from-accent-dark hover:to-primary transition-all shadow-sm"
            >
              Upgrade
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className="text-sm text-orange-600 hover:underline font-medium rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              Admin
            </Link>
          )}
          <Link
            href="/settings"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Settings - Manage children, preferences"
            aria-label="Settings"
          >
            <SettingsIcon />
          </Link>
          <button
            onClick={onSignOut}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Sign out of your account"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
