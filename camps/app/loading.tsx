export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 animate-spin motion-reduce:animate-none" />
        <p className="text-slate-500 dark:text-slate-400 text-sm animate-pulse motion-reduce:animate-none">
          Loading...
        </p>
      </div>
    </div>
  );
}
