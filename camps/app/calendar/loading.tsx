export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
      </div>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-4">
          <div className="flex gap-3 mb-6">
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true" />
          ))}
          <span className="sr-only">Loading calendar...</span>
        </div>
      </div>
    </div>
  );
}
