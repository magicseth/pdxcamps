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
  marketName: string;
  suggestedDomains: string[];
  selectedDomain?: string;
  onStartCheck?: (domains: string[]) => Promise<string>; // Legacy - not used anymore
  onSelect: (domain: string, price?: string) => void;
}

// Domain generation patterns
function generateMoreDomains(marketName: string, existing: string[]): string[] {
  const city = marketName.toLowerCase().replace(/\s+/g, '');
  const cityShort = city.slice(0, 3);
  const cityAbbr = marketName.split(' ').map(w => w[0]).join('').toLowerCase();

  const patterns = [
    // Camp-focused
    `${city}camps.com`,
    `${cityShort}camps.com`,
    `${city}summercamp.com`,
    `${city}summercamps.com`,
    `camp${city}.com`,
    `camps${city}.com`,
    `${city}campguide.com`,
    `${city}campfinder.com`,

    // Kids/Family focused
    `${city}kidscamps.com`,
    `${city}familycamps.com`,
    `${city}youthcamps.com`,

    // Summer focused
    `summer${city}.com`,
    `${city}summer.com`,
    `${cityShort}summer.com`,

    // Alternative TLDs
    `${city}camps.co`,
    `${city}camps.io`,
    `${city}camps.org`,
    `${cityShort}camps.co`,

    // Creative variations
    `camp${cityShort}.com`,
    `${cityAbbr}camps.com`,
    `the${city}camps.com`,
    `my${city}camps.com`,
    `go${city}camps.com`,
    `find${city}camps.com`,

    // Week/Planner focused
    `${city}campweeks.com`,
    `${city}campplanner.com`,
  ];

  // Filter out already suggested domains
  const existingSet = new Set(existing.map(d => d.toLowerCase()));
  return patterns.filter(d => !existingSet.has(d.toLowerCase()));
}

export function DomainChecker({
  marketKey,
  marketName,
  suggestedDomains,
  selectedDomain,
  onSelect,
}: DomainCheckerProps) {
  const [results, setResults] = useState<DomainResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState<string | null>(null);
  const [customDomain, setCustomDomain] = useState('');
  const [allDomains, setAllDomains] = useState<string[]>(suggestedDomains);
  const [showMoreGenerated, setShowMoreGenerated] = useState(false);

  // Use Fastly Domain Research API for fast availability checks
  const checkDomainsQuick = useAction(api.expansion.actions.checkDomainsQuick);
  // Use Porkbun to get actual price for purchasing
  const getDomainPrice = useAction(api.expansion.actions.getDomainPrice);

  const handleCheck = async () => {
    setLoading(true);
    setResults([]);
    try {
      const domainsToCheck = customDomain
        ? [...allDomains, customDomain]
        : allDomains;

      // Check using Fastly Domain Research API - fast parallel checking
      const checkResults = await checkDomainsQuick({ domains: domainsToCheck });
      setResults(checkResults);
    } catch (error) {
      console.error('Domain check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWithPrice = async (domain: string) => {
    setFetchingPrice(domain);
    try {
      // Get actual price from Porkbun
      const priceResult = await getDomainPrice({ domain });
      if (priceResult.available && priceResult.price) {
        // Update the result with the price
        setResults(prev => prev.map(r =>
          r.domain === domain ? { ...r, price: priceResult.price } : r
        ));
        onSelect(domain, priceResult.price);
      } else {
        // Domain might have been taken - refresh availability
        onSelect(domain, undefined);
      }
    } catch (error) {
      console.error('Failed to get price:', error);
      onSelect(domain, undefined);
    } finally {
      setFetchingPrice(null);
    }
  };

  const handleAddCustom = () => {
    if (customDomain && !allDomains.includes(customDomain)) {
      setAllDomains(prev => [...prev, customDomain]);
      handleCheck();
    }
  };

  const handleGenerateMore = () => {
    const moreDomains = generateMoreDomains(marketName, allDomains);
    setAllDomains(prev => [...prev, ...moreDomains]);
    setShowMoreGenerated(true);
  };

  const availableCount = results.filter(r => r.available && !r.error).length;
  const allTaken = results.length > 0 && availableCount === 0;

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
          {allDomains.length} domains to check
        </span>
      </div>

      {/* Progress indicator */}
      {loading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Checking {allDomains.length} domains...
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

      {/* Generate More Button - show when all taken or when user wants more options */}
      {(allTaken || results.length > 0) && (
        <button
          onClick={handleGenerateMore}
          disabled={loading}
          className="w-full px-4 py-2 text-sm border border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 rounded-md hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {allTaken ? '😢 All taken - Generate more domain ideas' : '+ Generate more domain ideas'}
        </button>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          {/* Summary */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <span className="text-sm">
              {availableCount > 0 ? (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {availableCount} available
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400 font-medium">
                  All domains taken
                </span>
              )}
              <span className="text-slate-500"> of {results.length} checked</span>
            </span>
          </div>
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
                    {result.price ? `$${result.price}` : (result.available ? '~$10' : '-')}
                  </td>
                  <td className="px-4 py-2">
                    {result.available && !result.error && (
                      <button
                        onClick={() => handleSelectWithPrice(result.domain)}
                        disabled={fetchingPrice === result.domain}
                        className={`px-3 py-1 text-xs rounded disabled:opacity-50 ${
                          selectedDomain === result.domain
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        {fetchingPrice === result.domain ? (
                          <span className="flex items-center gap-1">
                            <span className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
                            Getting price...
                          </span>
                        ) : selectedDomain === result.domain ? (
                          'Selected'
                        ) : (
                          'Select'
                        )}
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
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Domains to check:</p>
          <ul className="space-y-1">
            {allDomains.map((domain) => (
              <li key={domain} className="text-sm font-mono text-slate-700 dark:text-slate-300">
                {domain}
              </li>
            ))}
          </ul>
          {!showMoreGenerated && (
            <button
              onClick={handleGenerateMore}
              className="mt-2 text-sm text-primary hover:text-primary-dark"
            >
              + Generate more domain ideas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
