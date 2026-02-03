'use client';

import Link from 'next/link';

interface AlertBannerProps {
  criticalCount: number;
  errorCount: number;
  warningCount: number;
}

export function AlertBanner({ criticalCount, errorCount, warningCount }: AlertBannerProps) {
  const totalAlerts = criticalCount + errorCount + warningCount;

  if (totalAlerts === 0) {
    return null;
  }

  const isCritical = criticalCount > 0;
  const isError = errorCount > 0 && !isCritical;

  return (
    <div
      className={`rounded-lg p-4 mb-6 flex items-center justify-between ${
        isCritical
          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          : isError
          ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
          : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex-shrink-0 ${
            isCritical
              ? 'text-red-600 dark:text-red-400'
              : isError
              ? 'text-orange-600 dark:text-orange-400'
              : 'text-yellow-600 dark:text-yellow-400'
          }`}
        >
          <AlertIcon />
        </div>
        <div>
          <p
            className={`font-medium ${
              isCritical
                ? 'text-red-800 dark:text-red-200'
                : isError
                ? 'text-orange-800 dark:text-orange-200'
                : 'text-yellow-800 dark:text-yellow-200'
            }`}
          >
            {criticalCount > 0 && (
              <span className="mr-3">{criticalCount} Critical</span>
            )}
            {errorCount > 0 && <span className="mr-3">{errorCount} Error</span>}
            {warningCount > 0 && <span>{warningCount} Warning</span>}
          </p>
          <p
            className={`text-sm ${
              isCritical
                ? 'text-red-600 dark:text-red-300'
                : isError
                ? 'text-orange-600 dark:text-orange-300'
                : 'text-yellow-600 dark:text-yellow-300'
            }`}
          >
            System alerts require attention
          </p>
        </div>
      </div>
      <Link
        href="/admin/data-quality"
        className={`px-4 py-2 text-sm font-medium rounded-md ${
          isCritical
            ? 'bg-red-600 text-white hover:bg-red-700'
            : isError
            ? 'bg-orange-600 text-white hover:bg-orange-700'
            : 'bg-yellow-600 text-white hover:bg-yellow-700'
        }`}
      >
        View Alerts
      </Link>
    </div>
  );
}

function AlertIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}
