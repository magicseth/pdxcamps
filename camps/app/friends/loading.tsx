export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
      </div>
      <div className="max-w-4xl mx-auto p-6">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4" aria-hidden="true">
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
              <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            </div>
          ))}
          <span className="sr-only">Loading friends...</span>
        </div>
      </div>
    </div>
  );
}
