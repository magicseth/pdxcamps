export default function DiscoverLoading() {
  return (
    <div role="status" aria-live="polite" className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse motion-reduce:animate-none" aria-hidden="true" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-6xl mx-auto p-4">
        {/* Filters skeleton */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse motion-reduce:animate-none flex-shrink-0"
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Camp cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden"
              aria-hidden="true"
            >
              <div className="h-32 bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse motion-reduce:animate-none" />
                <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse motion-reduce:animate-none" />
                <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse motion-reduce:animate-none" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading camps...</span>
    </div>
  );
}
