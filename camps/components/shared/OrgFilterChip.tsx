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

// Letter fallback when no logo is available
function LetterFallback({ name, isSelected, size }: { name: string; isSelected: boolean; size: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-4 h-4 text-[8px]' : 'w-5 h-5 text-[10px]';
  return (
    <span
      className={`${sizeClasses} rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
        isSelected ? 'bg-white/20 text-white' : 'bg-slate-300 dark:bg-slate-500 text-white'
      }`}
    >
      {name[0]?.toUpperCase()}
    </span>
  );
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
  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs gap-1.5' : 'px-3 py-1.5 text-sm gap-2';

  const hasLogo = logoUrl && logoUrl.startsWith('http');

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center ${sizeClasses} rounded-full font-medium transition-all duration-200 ${
        isSelected
          ? 'bg-primary text-white shadow-sm'
          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
      }`}
    >
      {hasLogo ? (
        <OrgLogo url={logoUrl} name={name} size="xs" />
      ) : (
        <LetterFallback name={name} isSelected={isSelected} size={size} />
      )}
      <span className="truncate max-w-[120px]">{name}</span>
      {showCount && count !== undefined && (
        <span className={`tabular-nums ${isSelected ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
          {count}
        </span>
      )}
      {isSelected && <span className="ml-0.5 opacity-70">✕</span>}
    </button>
  );
}
