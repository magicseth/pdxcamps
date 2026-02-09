'use client';

import { useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { PipelineProgressBar } from './PipelineProgressBar';
import { DirectoryRow } from './DirectoryRow';
import { OrganizationRow } from './OrganizationRow';

interface MarketPipelinePanelProps {
  cityId: Id<'cities'>;
  cityName: string;
}

export function MarketPipelinePanel({ cityId, cityName }: MarketPipelinePanelProps) {
  const [running, setRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<string | null>(null);
  const [showUnassociated, setShowUnassociated] = useState(false);

  const pipelineStats = useQuery(api.expansion.queries.getMarketPipelineStats, { cityId });
  const directories = useQuery(api.scraping.directories.listDirectoriesForCity, { cityId });
  const runPipeline = useAction(api.scraping.pipelineOrchestrator.runMarketPipeline);

  const handleRunPipeline = async () => {
    setRunning(true);
    setPipelineResult(null);
    try {
      const result = await runPipeline({ cityId });
      setPipelineResult(
        `Discovered ${result.directoriesDiscovered} directories via search, created ${result.directoriesCreated} total, crawled ${result.directoriesCrawled}, found ${result.totalOrgsCreated} orgs` +
        (result.errors.length > 0 ? ` (${result.errors.length} errors)` : ''),
      );
    } catch (err) {
      setPipelineResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRunning(false);
    }
  };

  // Separate directories from unassociated orgs
  const unassociatedOrgs = useQuery(
    api.scraping.directories.getDirectoryWithOrgs,
    // We'll show these on demand — skip for now and use a separate approach
    'skip',
  );

  if (!pipelineStats) {
    return (
      <div className="p-4 animate-pulse">
        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Pipeline: {cityName}
        </h3>
        <button
          onClick={handleRunPipeline}
          disabled={running}
          className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
            running
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {running ? 'Running...' : 'Run Pipeline'}
        </button>
      </div>

      {/* Pipeline result */}
      {pipelineResult && (
        <div className={`mx-4 mt-3 text-xs p-2 rounded ${
          pipelineResult.startsWith('Error')
            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
        }`}>
          {pipelineResult}
        </div>
      )}

      {/* Progress bar */}
      <div className="px-4 py-3">
        <PipelineProgressBar
          directories={pipelineStats.directories}
          organizations={pipelineStats.organizations}
          scrapers={pipelineStats.scrapers}
          sessions={pipelineStats.sessions}
        />
      </div>

      {/* Summary stats */}
      <div className="px-4 pb-3 grid grid-cols-4 gap-3">
        <MiniStat
          label="Directories"
          value={pipelineStats.directories.total}
          detail={`${pipelineStats.directories.crawled} crawled`}
        />
        <MiniStat
          label="Organizations"
          value={pipelineStats.organizations.total}
          detail={`${pipelineStats.organizations.percentWithScrapers}% with scrapers`}
        />
        <MiniStat
          label="Scrapers"
          value={pipelineStats.scrapers.total}
          detail={`${pipelineStats.scrapers.healthy} healthy, ${pipelineStats.scrapers.failing} failing`}
        />
        <MiniStat
          label="Sessions"
          value={pipelineStats.sessions.total}
          detail={`${pipelineStats.sessions.active} active`}
        />
      </div>

      {/* Health indicator */}
      <div className="mx-4 mb-3">
        <HealthBadge health={pipelineStats.overallHealth} />
      </div>

      {/* Directories list */}
      {directories && directories.length > 0 && (
        <div className="px-4 pb-4 space-y-2">
          <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            Directories ({directories.length})
          </h4>
          {directories.map((dir) => (
            <DirectoryRow
              key={dir._id}
              directory={dir}
              onRecrawl={async (directoryId) => {
                // Re-crawl will be triggered by the pipeline orchestrator
                // For now, the user can re-run the full pipeline
              }}
            />
          ))}
        </div>
      )}

      {/* Unassociated orgs toggle */}
      {pipelineStats.organizations.total > 0 && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowUnassociated(!showUnassociated)}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            {showUnassociated ? 'Hide' : 'Show'} Direct Discovery orgs (not from directories)
          </button>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums">{value}</div>
      <div className="text-[10px] text-slate-500 font-medium">{label}</div>
      <div className="text-[10px] text-slate-400">{detail}</div>
    </div>
  );
}

function HealthBadge({ health }: { health: 'good' | 'warning' | 'critical' }) {
  const config = {
    good: { label: 'Healthy', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    warning: { label: 'Warning', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    critical: { label: 'Critical', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  };

  const c = config[health];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${c.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        health === 'good' ? 'bg-green-500' : health === 'warning' ? 'bg-amber-500' : 'bg-red-500'
      }`} />
      {c.label}
    </span>
  );
}
