'use client';

interface CampImageProps {
  resolvedImageUrl?: string;
  externalImageUrl?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-20 h-20',
  lg: 'w-48 h-48',
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-lg',
  lg: 'text-3xl',
};

export function CampImage({
  resolvedImageUrl,
  externalImageUrl,
  name,
  size = 'md',
  className = '',
}: CampImageProps) {
  const imageUrl = resolvedImageUrl || externalImageUrl;
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-lg object-cover bg-slate-100 dark:bg-slate-700 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center ${className}`}
    >
      <span className={`${textSizeClasses[size]} font-medium text-slate-400 dark:text-slate-500`}>
        {initials || '?'}
      </span>
    </div>
  );
}
