'use client';

import { useState } from 'react';

interface OrgLogoProps {
  url: string | null | undefined;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  fallback?: React.ReactNode;
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

/**
 * Consistent organization logo component with fallback handling.
 * Shows logo image if valid URL, otherwise shows fallback or nothing.
 */
export function OrgLogo({ url, name, size = 'sm', className = '', fallback }: OrgLogoProps) {
  const [hasError, setHasError] = useState(false);

  // Validate URL
  const isValidUrl = url && url.startsWith('http');

  if (!isValidUrl || hasError) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img
      src={url}
      alt={name ? `${name} logo` : ''}
      title={name}
      loading="lazy"
      decoding="async"
      className={`object-contain rounded-sm flex-shrink-0 ${sizeClasses[size]} ${className}`}
      onError={() => setHasError(true)}
    />
  );
}
