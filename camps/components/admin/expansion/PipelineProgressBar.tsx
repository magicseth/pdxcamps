'use client';

interface PipelineProgressBarProps {
  directories: { total: number; crawled: number; pending: number };
  organizations: { total: number; withScrapers: number; percentWithScrapers: number };
  scrapers: { total: number; healthy: number; failing: number; pendingDev: number };
  sessions: { total: number; active: number };
}

export function PipelineProgressBar({ directories, organizations, scrapers, sessions }: PipelineProgressBarProps) {
  const stages = [
    {
      label: 'Directories',
      count: directories.total,
      detail: `${directories.crawled} crawled`,
      filled: directories.total > 0,
      progress: directories.total > 0 ? directories.crawled / directories.total : 0,
    },
    {
      label: 'Orgs',
      count: organizations.total,
      detail: `${organizations.percentWithScrapers}% scraped`,
      filled: organizations.total > 0,
      progress: organizations.total > 0 ? organizations.withScrapers / organizations.total : 0,
    },
    {
      label: 'Scrapers',
      count: scrapers.total,
      detail: `${scrapers.healthy} healthy`,
      filled: scrapers.total > 0,
      progress: scrapers.total > 0 ? scrapers.healthy / scrapers.total : 0,
    },
    {
      label: 'Sessions',
      count: sessions.total,
      detail: `${sessions.active} active`,
      filled: sessions.total > 0,
      progress: sessions.active > 0 ? 1 : sessions.total > 0 ? 0.5 : 0,
    },
  ];

  return (
    <div className="flex items-center gap-1 w-full">
      {stages.map((stage, i) => (
        <div key={stage.label} className="flex items-center gap-1 flex-1">
          <div className="flex flex-col items-center flex-1">
            <div className="text-[10px] text-slate-500 mb-0.5 whitespace-nowrap">{stage.label}</div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  stage.progress >= 0.8
                    ? 'bg-green-500'
                    : stage.progress >= 0.4
                      ? 'bg-amber-500'
                      : stage.progress > 0
                        ? 'bg-blue-500'
                        : 'bg-slate-300 dark:bg-slate-600'
                }`}
                style={{ width: `${Math.max(stage.progress * 100, stage.filled ? 5 : 0)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
              {stage.count > 0 ? stage.detail : '--'}
            </div>
          </div>
          {i < stages.length - 1 && (
            <svg className="w-3 h-3 text-slate-300 dark:text-slate-600 flex-shrink-0 mt-1" viewBox="0 0 12 12" fill="currentColor">
              <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
