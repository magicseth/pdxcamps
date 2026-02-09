'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { OrganizationRow } from './OrganizationRow';

interface DirectoryData {
  _id: Id<'directories'>;
  name: string;
  url: string;
  domain: string;
  directoryType: 'aggregator' | 'municipal' | 'curated_list' | 'search_result';
  status: 'discovered' | 'crawling' | 'crawled' | 'failed' | 'excluded';
  linksFound?: number;
  orgsExtracted?: number;
  lastCrawledAt?: number;
  crawlError?: string;
  orgCount: number;
  orgsWithScrapers: number;
}

interface DirectoryRowProps {
  directory: DirectoryData;
  onRecrawl?: (directoryId: Id<'directories'>) => void;
  onTriggerScrape?: (sourceId: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  aggregator: 'Aggregator',
  municipal: 'Municipal',
  curated_list: 'Curated',
  search_result: 'Search',
};

const STATUS_STYLES: Record<string, string> = {
  discovered: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  crawling: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  crawled: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  excluded: 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export function DirectoryRow({ directory, onRecrawl, onTriggerScrape }: DirectoryRowProps) {
  const [expanded, setExpanded] = useState(false);

  // Conditionally load orgs only when expanded
  const dirWithOrgs = useQuery(
    api.scraping.directories.getDirectoryWithOrgs,
    expanded ? { directoryId: directory._id } : 'skip',
  );

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-3"
      >
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
          fill="currentColor"
          viewBox="0 0 12 12"
        >
          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">
              {directory.name}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{directory.domain}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
            <span>{TYPE_LABELS[directory.directoryType] || directory.directoryType}</span>
            {directory.linksFound !== undefined && <span>{directory.linksFound} links</span>}
            <span>
              {directory.orgCount} orgs ({directory.orgsWithScrapers} with scrapers)
            </span>
          </div>
        </div>

        <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${STATUS_STYLES[directory.status]}`}>
          {directory.status}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
          {/* Error message if failed */}
          {directory.crawlError && (
            <div className="mx-4 mt-3 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 text-red-700 dark:text-red-300">
              {directory.crawlError}
            </div>
          )}

          {/* Actions */}
          <div className="px-4 py-2 flex gap-2">
            {onRecrawl && directory.status !== 'excluded' && (
              <button
                onClick={() => onRecrawl(directory._id)}
                className="text-xs px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
              >
                {directory.status === 'crawled' ? 'Re-crawl' : 'Crawl'}
              </button>
            )}
            <a
              href={directory.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              Visit URL
            </a>
          </div>

          {/* Organizations list */}
          {dirWithOrgs?.organizations && dirWithOrgs.organizations.length > 0 ? (
            <div className="mx-4 mb-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden">
              <div className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                Organizations ({dirWithOrgs.organizations.length})
              </div>
              {dirWithOrgs.organizations.map((org) => (
                <OrganizationRow
                  key={org._id}
                  org={org}
                  onTriggerScrape={onTriggerScrape}
                />
              ))}
            </div>
          ) : expanded && !dirWithOrgs ? (
            <div className="px-4 py-3 text-xs text-slate-400">Loading organizations...</div>
          ) : (
            <div className="px-4 py-3 text-xs text-slate-400">No organizations found yet</div>
          )}
        </div>
      )}
    </div>
  );
}
