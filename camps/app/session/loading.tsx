export default function SessionLoading() {
  return (
    <div role="status" aria-live="polite" className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header skeleton */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden m-4">
        <div
          className="h-48 md:h-64 bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div className="p-6 space-y-4">
          <div
            className="h-8 w-2/3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
          <div
            className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
          <div className="flex gap-2">
            <div
              className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse motion-reduce:animate-none"
              aria-hidden="true"
            />
            <div
              className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse motion-reduce:animate-none"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* Details skeleton */}
      <div className="grid md:grid-cols-2 gap-4 m-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 space-y-4">
          <div
            className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse motion-reduce:animate-none"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 space-y-4">
          <div
            className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse motion-reduce:animate-none"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading session details...</span>
    </div>
  );
}
