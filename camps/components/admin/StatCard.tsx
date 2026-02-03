'use client';

import Link from 'next/link';

interface StatCardProps {
  label: string;
  value: number;
  subtext?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  href?: string;
  small?: boolean;
}

export function StatCard({
  label,
  value,
  subtext,
  variant = 'default',
  href,
  small = false,
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    info: 'bg-primary/10 dark:bg-primary-dark/20 border-primary/30 dark:border-primary-dark',
  };

  const valueStyles = {
    default: 'text-slate-900 dark:text-white',
    success: 'text-green-700 dark:text-green-300',
    warning: 'text-yellow-700 dark:text-yellow-300',
    error: 'text-red-700 dark:text-red-300',
    info: 'text-primary-dark dark:text-white/60',
  };

  const content = (
    <>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`${small ? 'text-2xl' : 'text-3xl'} font-bold tabular-nums ${valueStyles[variant]}`}>
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtext}</p>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`rounded-lg border ${small ? 'p-3' : 'p-4'} ${variantStyles[variant]} hover:opacity-80 transition-opacity block`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`rounded-lg border ${small ? 'p-3' : 'p-4'} ${variantStyles[variant]}`}>
      {content}
    </div>
  );
}
