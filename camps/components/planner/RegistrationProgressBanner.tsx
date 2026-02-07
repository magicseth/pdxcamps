'use client';

interface RegistrationProgressBannerProps {
  year: number;
  totalWeeks: number;
  coveredWeeks: number;
  registeredCount: number;
  todoCount: number;
  waitlistCount: number;
  onTodoClick?: () => void;
  onAddEventClick?: () => void;
  onShareClick?: () => void;
}

export function RegistrationProgressBanner({
  year,
  totalWeeks,
  coveredWeeks,
  registeredCount,
  todoCount,
  waitlistCount,
  onTodoClick,
  onAddEventClick,
  onShareClick,
}: RegistrationProgressBannerProps) {
  const coveragePercent = totalWeeks > 0 ? Math.round((coveredWeeks / totalWeeks) * 100) : 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left side: Year and progress bar */}
        <div className="flex items-center gap-4 flex-1">
          <div className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">Summer {year}</div>
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

        {/* Right side: Status pills and action buttons */}
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
            <span className="text-sm text-slate-500 dark:text-slate-400">No camps saved yet</span>
          )}

          {/* Divider */}
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 hidden sm:block" />

          {/* Add Event button */}
          <button
            onClick={onAddEventClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Event
          </button>

          {/* Share button */}
          <button
            onClick={onShareClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Share schedule
          </button>
        </div>
      </div>
    </div>
  );
}
