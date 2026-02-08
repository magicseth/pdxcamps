'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6" aria-hidden="true">⚠️</div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 text-balance">Something went wrong</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8 text-pretty">
          We encountered an unexpected error. Please try again, or contact support if the problem persists.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Go Home
          </a>
        </div>
        {error.digest && <p className="mt-8 text-xs text-slate-400 dark:text-slate-500">Error ID: {error.digest}</p>}
      </div>
    </div>
  );
}
