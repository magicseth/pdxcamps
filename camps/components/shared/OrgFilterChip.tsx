'use client';

import { OrgLogo } from './OrgLogo';

interface OrgFilterChipProps {
  id: string;
  name: string;
  logoUrl?: string | null;
  count?: number;
  isSelected: boolean;
  onClick: () => void;
  showCount?: boolean;
  size?: 'sm' | 'md';
}

export function OrgFilterChip({
  name,
  logoUrl,
  count,
  isSelected,
  onClick,
  showCount = true,
  size = 'md',
}: OrgFilterChipProps) {
  const sizeClasses = size === 'sm'
    ? 'px-2 py-1 text-xs gap-1.5'
    : 'px-3 py-1.5 text-sm gap-2';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center ${sizeClasses} rounded-full font-medium transition-all duration-200 ${
        isSelected
          ? 'bg-primary text-white shadow-sm'
          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
      }`}
    >
      <OrgLogo url={logoUrl} name={name} size="xs" />
      <span className="truncate max-w-[120px]">{name}</span>
      {showCount && count !== undefined && (
        <span className={`tabular-nums ${
          isSelected
            ? 'text-white/70'
            : 'text-slate-400 dark:text-slate-500'
        }`}>
          {count}
        </span>
      )}
      {isSelected && (
        <span className="ml-0.5 opacity-70">✕</span>
      )}
    </button>
  );
}
