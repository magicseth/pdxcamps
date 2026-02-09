'use client';

import { MarketWithStatus, STATUS_LABELS, STATUS_COLORS } from './types';

interface MarketCardProps {
  market: MarketWithStatus;
  onSelect: () => void;
  isSelected: boolean;
}

export function MarketCard({ market, onSelect, isSelected }: MarketCardProps) {
  const tierColors = {
    1: 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/10',
    2: 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10',
    3: 'border-slate-300 bg-slate-50/50 dark:bg-slate-800/50',
  };

  const tierBadgeColors = {
    1: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    2: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    3: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  };

  return (
    <button
      onClick={onSelect}
      className={`
        w-full text-left p-4 rounded-lg border-2 transition-all
        ${tierColors[market.tier]}
        ${
          isSelected
            ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900'
            : 'hover:border-primary/50 hover:shadow-md'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">{market.name}</h3>
          <p className="text-xs text-slate-500">{market.state}</p>
        </div>
        <span className={`px-2 py-0.5 text-xs rounded-full ${tierBadgeColors[market.tier]}`}>Tier {market.tier}</span>
      </div>

      {/* Status Badge */}
      <div className="mb-3">
        <span className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[market.status]}`}>
          {market.status === 'launched' && '✓ '}
          {STATUS_LABELS[market.status]}
        </span>
      </div>

      {/* Market Info */}
      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">{market.keyStats}</p>

      {/* Data Stats - only show if city exists */}
      {market.stats && (
        <div className="flex gap-3 text-xs mb-2">
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Sources:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{market.stats.sources}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Orgs:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{market.stats.orgs}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Sessions:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{market.stats.sessions}</span>
          </div>
        </div>
      )}

      {/* Pipeline mini-stats */}
      {market.pipelineStats && (
        <div className="flex gap-2 text-[10px] mb-2">
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {market.pipelineStats.directories.total} dirs
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {market.pipelineStats.organizations.percentWithScrapers}% scraped
          </span>
          {market.pipelineStats.scrapers.failing > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300">
              {market.pipelineStats.scrapers.failing} failing
            </span>
          )}
        </div>
      )}

      {/* Domain info if purchased */}
      {market.selectedDomain && (
        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500">
            Domain: <span className="font-mono text-slate-700 dark:text-slate-300">{market.selectedDomain}</span>
          </p>
        </div>
      )}

      {/* Progress indicator */}
      <div className="mt-3 flex items-center gap-1">
        <ProgressDot filled={market.status !== 'not_started'} label="Domain" />
        <ProgressLine filled={market.dnsConfigured} />
        <ProgressDot filled={market.dnsConfigured} label="DNS" />
        <ProgressLine filled={!!market.cityId} />
        <ProgressDot filled={!!market.cityId} label="City" />
        <ProgressLine filled={market.status === 'launched'} />
        <ProgressDot filled={market.status === 'launched'} label="Live" />
      </div>
    </button>
  );
}

function ProgressDot({ filled, label }: { filled: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-2 h-2 rounded-full ${filled ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}
        title={label}
      />
    </div>
  );
}

function ProgressLine({ filled }: { filled: boolean }) {
  return <div className={`flex-1 h-0.5 ${filled ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />;
}
