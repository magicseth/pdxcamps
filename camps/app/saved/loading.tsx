export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="h-6 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
      </div>
      <div className="max-w-3xl mx-auto p-6">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-4">
          <div className="h-10 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg mb-6" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true" />
          ))}
          <span className="sr-only">Loading saved camps...</span>
        </div>
      </div>
    </div>
  );
}
