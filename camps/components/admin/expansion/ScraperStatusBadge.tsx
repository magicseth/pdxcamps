'use client';

type ScraperStatus = 'no_scraper' | 'pending_dev' | 'active' | 'failing' | 'disabled';

const STATUS_CONFIG: Record<ScraperStatus, { label: string; className: string }> = {
  no_scraper: {
    label: 'No Scraper',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  },
  pending_dev: {
    label: 'Pending Dev',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  failing: {
    label: 'Failing',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
  disabled: {
    label: 'Disabled',
    className: 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  },
};

interface ScraperStatusBadgeProps {
  status: ScraperStatus;
}

export function ScraperStatusBadge({ status }: ScraperStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
