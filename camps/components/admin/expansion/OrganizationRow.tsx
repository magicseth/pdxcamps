'use client';

import { useState } from 'react';
import { ScraperStatusBadge } from './ScraperStatusBadge';

interface OrgData {
  _id: string;
  name: string;
  website?: string;
  scraperStatus: 'no_scraper' | 'pending_dev' | 'active' | 'failing' | 'disabled';
  sourceId?: string;
  sessionCount: number;
  lastScrapedAt?: number;
  dataQualityScore?: number;
  scraperHealth?: {
    successRate: number;
    consecutiveFailures: number;
    totalRuns: number;
    lastError?: string;
  };
}

interface OrganizationRowProps {
  org: OrgData;
  onTriggerScrape?: (sourceId: string) => void;
}

export function OrganizationRow({ org, onTriggerScrape }: OrganizationRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-slate-100 dark:border-slate-700 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-2 text-sm"
      >
        <svg
          className={`w-3 h-3 text-slate-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
          fill="currentColor"
          viewBox="0 0 12 12"
        >
          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>

        <span className="font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
          {org.name}
        </span>

        <ScraperStatusBadge status={org.scraperStatus} />

        <span className="text-xs text-slate-400 tabular-nums w-16 text-right">
          {org.sessionCount} sess
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pl-8 space-y-2">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {org.website && (
              <div>
                <span className="text-slate-500">Website: </span>
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                >
                  {new URL(org.website).hostname}
                </a>
              </div>
            )}
            {org.lastScrapedAt && (
              <div>
                <span className="text-slate-500">Last scraped: </span>
                <span className="text-slate-700 dark:text-slate-300">
                  {formatRelativeTime(org.lastScrapedAt)}
                </span>
              </div>
            )}
            {org.dataQualityScore !== undefined && (
              <div>
                <span className="text-slate-500">Quality: </span>
                <span className={`font-medium ${
                  org.dataQualityScore >= 80
                    ? 'text-green-600 dark:text-green-400'
                    : org.dataQualityScore >= 50
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                }`}>
                  {org.dataQualityScore}%
                </span>
              </div>
            )}
            {org.scraperHealth && (
              <div>
                <span className="text-slate-500">Success rate: </span>
                <span className="text-slate-700 dark:text-slate-300">
                  {Math.round(org.scraperHealth.successRate * 100)}% ({org.scraperHealth.totalRuns} runs)
                </span>
              </div>
            )}
          </div>

          {/* Scraper error */}
          {org.scraperHealth?.lastError && (
            <div className="text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 text-red-700 dark:text-red-300">
              Last error: {org.scraperHealth.lastError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {org.sourceId && org.scraperStatus === 'active' && onTriggerScrape && (
              <button
                onClick={() => onTriggerScrape(org.sourceId!)}
                className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
              >
                Trigger Scrape
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
