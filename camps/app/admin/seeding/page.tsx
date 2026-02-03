'use client';

import { useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { Id } from '../../../convex/_generated/dataModel';

export default function SeedingPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link href="/admin" className="font-semibold hover:underline">
          ← Admin Dashboard
        </Link>
        <h1 className="text-lg font-semibold">Market Seeding</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <SeedingContent />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <p className="text-slate-600 dark:text-slate-400">
              Please sign in to access market seeding.
            </p>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

interface ExtractedLink {
  url: string;
  text: string;
  domain: string;
}

interface OrganizedOrg {
  domain: string;
  suggestedName: string;
  bestUrl: string;
  alternateUrls: string[];
  included: boolean;
  customName?: string;
}

function SeedingContent() {
  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const cities = useQuery(api.cities.queries.listActiveCities);

  const scrapeDirectory = useAction(api.scraping.marketSeeding.scrapeDirectoryForCampUrls);
  const organizeUrls = useAction(api.scraping.marketSeeding.organizeExtractedUrls);
  const seedMarket = useAction(api.scraping.marketSeeding.seedMarket);
  const getMarketStatus = useAction(api.scraping.marketSeeding.getMarketStatus);

  const [selectedCitySlug, setSelectedCitySlug] = useState<string>('');
  const [directoryUrl, setDirectoryUrl] = useState('');
  const [linkPattern, setLinkPattern] = useState('');
  const [baseUrlFilter, setBaseUrlFilter] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [extractedLinks, setExtractedLinks] = useState<ExtractedLink[]>([]);
  const [organizations, setOrganizations] = useState<OrganizedOrg[]>([]);
  const [marketStatus, setMarketStatus] = useState<Awaited<ReturnType<typeof getMarketStatus>> | null>(null);

  const [seedingResult, setSeedingResult] = useState<Awaited<ReturnType<typeof seedMarket>> | null>(null);

  if (isAdmin === undefined || cities === undefined) {
    return <LoadingState />;
  }

  if (!isAdmin) {
    return <AccessDenied />;
  }

  const handleScrapeDirectory = async () => {
    if (!directoryUrl) {
      setError('Please enter a directory URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtractedLinks([]);
    setOrganizations([]);

    try {
      const result = await scrapeDirectory({
        directoryUrl,
        linkPattern: linkPattern || undefined,
        baseUrlFilter: baseUrlFilter || undefined,
      });

      if (!result.success) {
        setError(result.error || 'Failed to scrape directory');
        return;
      }

      setExtractedLinks(result.links);

      // Automatically organize the links
      if (result.links.length > 0) {
        const organized = await organizeUrls({ links: result.links });
        setOrganizations(
          organized.organizations.map((org) => ({
            ...org,
            included: true,
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedMarket = async () => {
    if (!selectedCitySlug) {
      setError('Please select a city');
      return;
    }

    const includedOrgs = organizations.filter((org) => org.included);
    if (includedOrgs.length === 0) {
      setError('Please select at least one organization to seed');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await seedMarket({
        citySlug: selectedCitySlug,
        camps: includedOrgs.map((org) => ({
          url: org.bestUrl,
          name: org.customName || org.suggestedName,
        })),
      });

      setSeedingResult(result);

      // Refresh market status
      const status = await getMarketStatus({ citySlug: selectedCitySlug });
      setMarketStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!selectedCitySlug) return;

    setIsLoading(true);
    try {
      const status = await getMarketStatus({ citySlug: selectedCitySlug });
      setMarketStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOrg = (domain: string) => {
    setOrganizations((prev) =>
      prev.map((org) =>
        org.domain === domain ? { ...org, included: !org.included } : org
      )
    );
  };

  const updateOrgName = (domain: string, name: string) => {
    setOrganizations((prev) =>
      prev.map((org) =>
        org.domain === domain ? { ...org, customName: name } : org
      )
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Market Seeding
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Seed a new market by scraping a directory of camp URLs.
        </p>
      </div>

      {/* City Selection */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4">1. Select Market</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              City
            </label>
            <select
              value={selectedCitySlug}
              onChange={(e) => {
                setSelectedCitySlug(e.target.value);
                setMarketStatus(null);
              }}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <option value="">Select a city...</option>
              {cities?.map((city) => (
                <option key={city._id} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleRefreshStatus}
            disabled={!selectedCitySlug || isLoading}
            className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 disabled:opacity-50"
          >
            Check Status
          </button>
        </div>

        {/* Market Status */}
        {marketStatus && (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <h4 className="font-medium mb-2">{marketStatus.city.name} Status</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Organizations</p>
                <p className="text-xl font-bold">{marketStatus.organizations}</p>
              </div>
              <div>
                <p className="text-slate-500">Scrape Sources</p>
                <p className="text-xl font-bold">{marketStatus.scrapeSources}</p>
              </div>
              <div>
                <p className="text-slate-500">Pending Scrapers</p>
                <p className="text-xl font-bold">{marketStatus.scraperDevelopment.pending}</p>
              </div>
              <div>
                <p className="text-slate-500">Completed Scrapers</p>
                <p className="text-xl font-bold">{marketStatus.scraperDevelopment.completed}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Directory Scraping */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4">2. Scrape Directory</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Directory URL
            </label>
            <input
              type="url"
              value={directoryUrl}
              onChange={(e) => setDirectoryUrl(e.target.value)}
              placeholder="https://example.com/portland-summer-camps"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Link Pattern (optional regex)
              </label>
              <input
                type="text"
                value={linkPattern}
                onChange={(e) => setLinkPattern(e.target.value)}
                placeholder="camp|program|summer"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Domain Filter (optional)
              </label>
              <input
                type="text"
                value={baseUrlFilter}
                onChange={(e) => setBaseUrlFilter(e.target.value)}
                placeholder="example.com"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <button
            onClick={handleScrapeDirectory}
            disabled={isLoading || !directoryUrl}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Scraping...' : 'Scrape Directory'}
          </button>
        </div>

        {extractedLinks.length > 0 && (
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Found {extractedLinks.length} links, organized into {organizations.length} organizations
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Organizations Preview */}
      {organizations.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">3. Review Organizations</h3>
            <div className="text-sm text-slate-500">
              {organizations.filter((o) => o.included).length} of {organizations.length} selected
            </div>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {organizations.map((org) => (
              <div
                key={org.domain}
                className={`p-4 rounded-lg border ${
                  org.included
                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={org.included}
                    onChange={() => toggleOrg(org.domain)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="text"
                        value={org.customName ?? org.suggestedName}
                        onChange={(e) => updateOrgName(org.domain, e.target.value)}
                        className="font-medium bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-1 -ml-1"
                      />
                      <span className="text-xs text-slate-500">{org.domain}</span>
                    </div>
                    <a
                      href={org.bestUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline break-all"
                    >
                      {org.bestUrl}
                    </a>
                    {org.alternateUrls.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-slate-500 cursor-pointer">
                          {org.alternateUrls.length} alternate URLs
                        </summary>
                        <ul className="mt-1 text-xs text-slate-500 space-y-1">
                          {org.alternateUrls.slice(0, 5).map((url) => (
                            <li key={url} className="truncate">
                              {url}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={handleSeedMarket}
              disabled={isLoading || !selectedCitySlug || organizations.filter((o) => o.included).length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Seeding...' : `Seed ${organizations.filter((o) => o.included).length} Organizations`}
            </button>
            <button
              onClick={() => {
                setOrganizations((prev) => prev.map((o) => ({ ...o, included: true })));
              }}
              className="px-4 py-2 text-slate-600 hover:text-slate-900"
            >
              Select All
            </button>
            <button
              onClick={() => {
                setOrganizations((prev) => prev.map((o) => ({ ...o, included: false })));
              }}
              className="px-4 py-2 text-slate-600 hover:text-slate-900"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Seeding Result */}
      {seedingResult && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold mb-4">Seeding Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded">
              <p className="text-2xl font-bold">{seedingResult.summary.total}</p>
              <p className="text-sm text-slate-500">Total</p>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
              <p className="text-2xl font-bold text-green-600">{seedingResult.summary.created}</p>
              <p className="text-sm text-slate-500">Created</p>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
              <p className="text-2xl font-bold text-blue-600">{seedingResult.summary.existing}</p>
              <p className="text-sm text-slate-500">Already Existed</p>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded">
              <p className="text-2xl font-bold text-red-600">{seedingResult.summary.errors}</p>
              <p className="text-sm text-slate-500">Errors</p>
            </div>
          </div>

          {seedingResult.results.some((r) => r.status === 'error') && (
            <div className="mt-4">
              <h4 className="font-medium text-red-600 mb-2">Errors:</h4>
              <ul className="text-sm space-y-1">
                {seedingResult.results
                  .filter((r) => r.status === 'error')
                  .map((r) => (
                    <li key={r.url} className="text-red-600">
                      {r.name}: {r.error}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <Link
              href="/admin/scraper-dev"
              className="text-blue-600 hover:underline"
            >
              View Scraper Development Queue →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
      <p className="text-slate-600 dark:text-slate-400">
        You don't have permission to access market seeding.
      </p>
      <Link href="/" className="inline-block mt-4 text-blue-600 hover:underline">
        Return to Home
      </Link>
    </div>
  );
}
