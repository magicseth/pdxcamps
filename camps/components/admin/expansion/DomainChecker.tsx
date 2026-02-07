'use client';

import { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';

interface DomainResult {
  domain: string;
  available: boolean;
  price?: string;
  error?: string;
}

interface DomainCheckerProps {
  marketKey: string;
  suggestedDomains: string[];
  selectedDomain?: string;
  onStartCheck?: (domains: string[]) => Promise<string>; // Legacy - not used anymore
  onSelect: (domain: string, price?: string) => void;
}

export function DomainChecker({
  marketKey,
  suggestedDomains,
  selectedDomain,
  onSelect,
}: DomainCheckerProps) {
  const [results, setResults] = useState<DomainResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [customDomain, setCustomDomain] = useState('');

  // Use Fastly Domain Research API for fast availability checks
  const checkDomainsQuick = useAction(api.expansion.actions.checkDomainsQuick);

  const handleCheck = async () => {
    setLoading(true);
    setResults([]);
    try {
      const domainsToCheck = customDomain
        ? [...suggestedDomains, customDomain]
        : suggestedDomains;

      // Check using Fastly Domain Research API - fast parallel checking
      const checkResults = await checkDomainsQuick({ domains: domainsToCheck });
      setResults(checkResults);
    } catch (error) {
      console.error('Domain check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustom = () => {
    if (customDomain && !suggestedDomains.includes(customDomain)) {
      handleCheck();
    }
  };

  const domainsToShow = customDomain
    ? [...suggestedDomains, customDomain]
    : suggestedDomains;

  return (
    <div className="space-y-4">
      {/* Check Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCheck}
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check Availability'}
        </button>
        <span className="text-sm text-slate-500">
          {suggestedDomains.length} suggested domains
        </span>
      </div>

      {/* Progress indicator */}
      {loading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Checking {domainsToShow.length} domains...
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300">
                Using Fastly Domain Research API - should complete in a few seconds.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Custom Domain Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
          placeholder="Or enter custom domain..."
          className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
          disabled={loading}
        />
        <button
          onClick={handleAddCustom}
          disabled={!customDomain || loading}
          className="px-3 py-2 text-sm text-primary hover:text-primary-dark disabled:opacity-50"
        >
          + Add
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400">Domain</th>
                <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400">Status</th>
                <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400">Price</th>
                <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {results.map((result) => (
                <tr key={result.domain} className={selectedDomain === result.domain ? 'bg-primary/5' : ''}>
                  <td className="px-4 py-2 font-mono text-slate-900 dark:text-white">
                    {result.domain}
                  </td>
                  <td className="px-4 py-2">
                    {result.error ? (
                      <span className="text-red-600 dark:text-red-400">{result.error}</span>
                    ) : result.available ? (
                      <span className="text-green-600 dark:text-green-400">Available</span>
                    ) : (
                      <span className="text-slate-500">Taken</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                    {result.price ? `$${result.price}` : '-'}
                  </td>
                  <td className="px-4 py-2">
                    {result.available && !result.error && (
                      <button
                        onClick={() => onSelect(result.domain, result.price)}
                        className={`px-3 py-1 text-xs rounded ${
                          selectedDomain === result.domain
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        {selectedDomain === result.domain ? 'Selected' : 'Select'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Suggested Domains List (before check) */}
      {results.length === 0 && !loading && (
        <div className="space-y-1">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Suggested domains:</p>
          <ul className="space-y-1">
            {suggestedDomains.map((domain) => (
              <li key={domain} className="text-sm font-mono text-slate-700 dark:text-slate-300">
                {domain}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
