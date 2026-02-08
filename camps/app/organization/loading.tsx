export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-4" aria-hidden="true" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-8" aria-hidden="true" />
          <div className="space-y-4">
            <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true" />
            <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true" />
          </div>
          <span className="sr-only">Loading organization...</span>
        </div>
      </div>
    </div>
  );
}
