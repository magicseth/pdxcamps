'use client';

import { OrgLogo } from '../shared/OrgLogo';

export type CoverageStatus = 'full' | 'partial' | 'gap' | 'tentative' | 'event' | 'school';

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
    bg: 'bg-accent',
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
    bg: 'bg-surface/200',
    icon: '✈',
    label: 'Event',
    title: 'Family event',
  },
  school: {
    bg: 'bg-slate-400',
    icon: '📚',
    label: 'School',
    title: 'Still in school',
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
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/30 text-primary dark:bg-surface-dark/40 dark:text-surface-light text-sm"
        title={`${childName}: ${eventTitle}`}
      >
        <span>✈</span>
        <span className="font-medium">{childName}</span>
        <span className="text-primary-light dark:text-surface-light truncate max-w-[100px]">
          {eventTitle}
        </span>
      </span>
    );
  }

  const bgColors: Record<CoverageStatus, string> = {
    full: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    partial: 'bg-accent/20 text-accent-dark dark:bg-accent/30 dark:text-accent-light',
    gap: 'bg-accent/10 text-accent-dark dark:bg-accent/20 dark:text-accent ring-1 ring-accent/30 dark:ring-accent/50',
    tentative: 'bg-accent/15 text-accent-dark dark:bg-accent/25 dark:text-accent',
    event: 'bg-surface/30 text-primary dark:bg-surface-dark/40 dark:text-surface-light',
    school: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm ${bgColors[status]} ${status === 'gap' ? 'animate-pulse motion-reduce:animate-none' : ''}`}
      title={campName ? `${childName}: ${campName}` : `${childName}: ${config.title}`}
    >
      <OrgLogo
        url={organizationLogoUrl}
        size="xs"
        fallback={<span>{config.icon}</span>}
      />
      <span className="font-medium">{childName}</span>
    </span>
  );
}

export function CoverageLegend() {
  const legendItems = [
    { bg: 'bg-green-100 dark:bg-green-900/40', icon: '✓', iconColor: 'text-green-600 dark:text-green-400', label: 'Covered', tooltip: 'Registered for camp all week' },
    { bg: 'bg-accent/20 dark:bg-accent/30', icon: '◐', iconColor: 'text-accent-dark dark:text-accent', label: 'Partial', tooltip: 'Some days covered, some gaps' },
    { bg: 'bg-accent/10 dark:bg-accent/20', icon: '•', iconColor: 'text-accent/60 dark:text-accent', label: 'Gap', tooltip: 'No coverage - click to find camps!' },
    { bg: 'bg-surface/30 dark:bg-surface-dark/40', icon: '✈️', iconColor: '', label: 'Event', tooltip: 'Family vacation or trip' },
    { bg: 'bg-slate-100 dark:bg-slate-800', icon: '📚', iconColor: '', label: 'School', tooltip: 'Still in school - no camp needed' },
  ];

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {legendItems.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-1.5 cursor-help"
          title={item.tooltip}
        >
          <span className={`w-6 h-6 rounded flex items-center justify-center ${item.bg}`}>
            <span className={item.iconColor}>{item.icon}</span>
          </span>
          <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
