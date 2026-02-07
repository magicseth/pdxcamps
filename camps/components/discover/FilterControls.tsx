'use client';

// Quick date filter button component
export function QuickDateButton({
  label,
  onClick,
  isActive,
}: {
  label: string;
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
        isActive
          ? 'bg-primary text-white'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
      }`}
    >
      {label}
    </button>
  );
}

// Filter chip component for active filters display
export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 dark:bg-primary-dark/30 text-primary-dark dark:text-white/60 rounded-full text-xs font-medium transition-transform hover:scale-105">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:text-primary-dark dark:hover:text-white/80 transition-colors"
        title="Remove filter"
        aria-label={`Remove ${label} filter`}
      >
        &times;
      </button>
    </span>
  );
}
