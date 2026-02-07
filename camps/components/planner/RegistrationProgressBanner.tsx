'use client';

interface RegistrationProgressBannerProps {
  year: number;
  totalWeeks: number;
  coveredWeeks: number;
  registeredCount: number;
  todoCount: number;
  waitlistCount: number;
  onTodoClick?: () => void;
}

export function RegistrationProgressBanner({
  year,
  totalWeeks,
  coveredWeeks,
  registeredCount,
  todoCount,
  waitlistCount,
  onTodoClick,
}: RegistrationProgressBannerProps) {
  const coveragePercent = totalWeeks > 0 ? Math.round((coveredWeeks / totalWeeks) * 100) : 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left side: Year and progress bar */}
        <div className="flex items-center gap-4 flex-1">
          <div className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">
            Summer {year}
          </div>
          <div className="flex-1 max-w-xs">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                {coveredWeeks}/{totalWeeks} weeks
              </span>
            </div>
          </div>
        </div>

        {/* Right side: Status pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {registeredCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {registeredCount} Registered
            </span>
          )}

          {todoCount > 0 && (
            <button
              onClick={onTodoClick}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {todoCount} To Do
            </button>
          )}

          {waitlistCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-medium">
              <span className="text-xs">⏳</span>
              {waitlistCount} Waitlist
            </span>
          )}

          {registeredCount === 0 && todoCount === 0 && waitlistCount === 0 && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              No camps saved yet
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
