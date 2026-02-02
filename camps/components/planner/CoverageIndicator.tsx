'use client';

import { OrgLogo } from '../shared/OrgLogo';

export type CoverageStatus = 'full' | 'partial' | 'gap' | 'tentative' | 'event';

interface CoverageIndicatorProps {
  status: CoverageStatus;
  childName: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<
  CoverageStatus,
  { bg: string; icon: string; label: string; title: string }
> = {
  full: {
    bg: 'bg-green-500',
    icon: '●',
    label: 'Covered',
    title: 'Fully covered by registered camps',
  },
  partial: {
    bg: 'bg-yellow-500',
    icon: '◐',
    label: 'Partial',
    title: 'Partially covered',
  },
  gap: {
    bg: 'bg-red-500',
    icon: '○',
    label: 'Gap',
    title: 'No coverage - needs camp',
  },
  tentative: {
    bg: 'bg-orange-500',
    icon: '◑',
    label: 'Tentative',
    title: 'Interested or waitlisted only',
  },
  event: {
    bg: 'bg-purple-500',
    icon: '✈',
    label: 'Event',
    title: 'Family event',
  },
};

export function CoverageIndicator({
  status,
  childName,
  showLabel = false,
  size = 'md',
}: CoverageIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${sizeClasses} ${config.bg} text-white font-medium`}
      title={`${childName}: ${config.title}`}
    >
      <span>{config.icon}</span>
      {showLabel && <span>{childName}</span>}
    </span>
  );
}

interface CoverageChipProps {
  status: CoverageStatus;
  childName: string;
  eventTitle?: string;
  campName?: string;
  organizationLogoUrl?: string | null;
}

export function CoverageChip({ status, childName, eventTitle, campName, organizationLogoUrl }: CoverageChipProps) {
  const config = STATUS_CONFIG[status];

  if (status === 'event' && eventTitle) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-sm"
        title={`${childName}: ${eventTitle}`}
      >
        <span>✈</span>
        <span className="font-medium">{childName}</span>
        <span className="text-purple-600 dark:text-purple-300 truncate max-w-[100px]">
          {eventTitle}
        </span>
      </span>
    );
  }

  const bgColors: Record<CoverageStatus, string> = {
    full: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    gap: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    tentative: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    event: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  };

  const hasLogo = organizationLogoUrl && organizationLogoUrl.startsWith('http');

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm ${bgColors[status]}`}
      title={campName ? `${childName}: ${campName}` : `${childName}: ${config.title}`}
    >
      {hasLogo ? (
        <OrgLogo url={organizationLogoUrl} size="xs" />
      ) : (
        <span>{config.icon}</span>
      )}
      <span className="font-medium">{childName}</span>
    </span>
  );
}

export function CoverageLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-full bg-green-500"></span>
        <span className="text-slate-600 dark:text-slate-400">Covered</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
        <span className="text-slate-600 dark:text-slate-400">Partial</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-full bg-red-500"></span>
        <span className="text-slate-600 dark:text-slate-400">Gap</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-full bg-orange-500"></span>
        <span className="text-slate-600 dark:text-slate-400">Tentative</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-full bg-purple-500"></span>
        <span className="text-slate-600 dark:text-slate-400">Event</span>
      </div>
    </div>
  );
}
