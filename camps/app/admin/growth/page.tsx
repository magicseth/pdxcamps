'use client';

import { useState, Suspense, useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminTabs, StatCard } from '../../../components/admin';

export default function GrowthPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link href="/admin" className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          Admin Dashboard
        </Link>
        <h1 className="text-lg font-semibold">Growth & Expansion</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <Suspense fallback={<LoadingState />}>
            <GrowthContent />
          </Suspense>
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <p className="text-slate-600 dark:text-slate-400">
              Please sign in to access the admin dashboard.
            </p>
            <a
              href="/sign-in"
              className="bg-foreground text-background px-6 py-2 rounded-md"
            >
              Sign in
            </a>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function LoadingState() {
  return (
    <div className="max-w-6xl mx-auto py-8">
      <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
        <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
        <span className="sr-only">Loading growth data...</span>
      </div>
    </div>
  );
}

type TabType = 'seeding' | 'discovery' | 'organizations';

function GrowthContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialTab = (searchParams.get('tab') as TabType) || 'seeding';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const cities = useQuery(api.cities.queries.listActiveCities);

  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && ['seeding', 'discovery', 'organizations'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'seeding') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    router.push(`/admin/growth${params.toString() ? '?' + params.toString() : ''}`);
  };

  if (isAdmin === undefined) {
    return <LoadingState />;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400">
          You don't have permission to access the admin dashboard.
        </p>
        <Link href="/" className="inline-block mt-4 text-primary hover:underline">
          Return to Home
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'seeding', label: 'Market Seeding' },
    { id: 'discovery', label: 'Discovery Queue' },
    { id: 'organizations', label: 'Organizations' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Growth & Expansion
        </h2>
        <p className="text-slate-500 mt-1">
          Add new markets, discover sources, and manage organizations
        </p>
      </div>

      {/* Tabs */}
      <AdminTabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab Content */}
      {activeTab === 'seeding' && <MarketSeedingTab cities={cities} />}
      {activeTab === 'discovery' && <DiscoveryQueueTab cities={cities} />}
      {activeTab === 'organizations' && <OrganizationsTab cities={cities} />}
    </div>
  );
}

// ============================================
// MARKET SEEDING TAB
// ============================================

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

function MarketSeedingTab({ cities }: { cities: any[] | undefined }) {
  // New automated workflow
  const queueDirectoryUrls = useMutation(api.scraping.directoryDaemon.queueDirectoryUrls);
  const seedCampUrls = useMutation(api.scraping.directoryDaemon.seedCampUrls);
  const queueStatus = useQuery(api.scraping.directoryDaemon.getQueueStatus, {});

  // Legacy manual workflow
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

  // Manual URL input
  const [manualUrls, setManualUrls] = useState('');

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

  const handleAddManualUrls = () => {
    if (!manualUrls.trim()) {
      setError('Please enter at least one URL');
      return;
    }

    setError(null);

    // Parse URLs (one per line, skip empty lines)
    const urls = manualUrls
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && line.startsWith('http'));

    if (urls.length === 0) {
      setError('No valid URLs found. URLs must start with http:// or https://');
      return;
    }

    // Convert URLs to organization format
    const newOrgs: OrganizedOrg[] = urls.map((url) => {
      let domain = '';
      let suggestedName = '';
      try {
        const parsed = new URL(url);
        domain = parsed.hostname.replace(/^www\./, '');
        // Generate name from domain
        suggestedName = domain
          .replace(/\.(com|org|edu|net|gov|co|io)$/i, '')
          .split(/[.-]/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      } catch {
        domain = url;
        suggestedName = 'Unknown';
      }

      return {
        domain,
        suggestedName,
        bestUrl: url,
        alternateUrls: [],
        included: true,
      };
    });

    // Merge with existing orgs (avoid duplicates by domain)
    const existingDomains = new Set(organizations.map((o) => o.domain));
    const uniqueNewOrgs = newOrgs.filter((o) => !existingDomains.has(o.domain));

    setOrganizations([...organizations, ...uniqueNewOrgs]);
    setManualUrls('');
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
    <div className="space-y-6">
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

      {/* Direct Camp URL Seeding - No Scraping */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4">2. Add Camp URLs (Direct)</h3>
        <p className="text-sm text-slate-500 mb-4">
          Paste camp organization URLs below (one per line). Creates organizations and scrape sources immediately - no scraping needed.
        </p>
        <div className="space-y-4">
          <textarea
            value={manualUrls}
            onChange={(e) => setManualUrls(e.target.value)}
            placeholder="https://omsi.edu/camps&#10;https://oregonzoo.org/education/camps&#10;https://example.com/summer-camps"
            rows={8}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono text-sm"
          />
          <button
            onClick={async () => {
              if (!selectedCitySlug || !manualUrls.trim()) {
                setError('Select a city and enter at least one URL');
                return;
              }
              setIsLoading(true);
              setError(null);
              try {
                const urls = manualUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
                const result = await seedCampUrls({
                  citySlug: selectedCitySlug,
                  urls
                });
                setManualUrls('');
                setSeedingResult({
                  success: true,
                  cityId: null,
                  results: result.results.map(r => ({
                    url: r.url,
                    name: r.name,
                    organizationId: null,
                    sourceId: null,
                    developmentRequestId: null,
                    status: r.status as 'created' | 'exists' | 'error',
                  })),
                  summary: {
                    total: result.total,
                    created: result.created,
                    existing: result.existed,
                    errors: result.total - result.created - result.existed,
                  }
                });
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to seed URLs');
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading || !selectedCitySlug}
            className="px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Organizations'}
          </button>
        </div>
      </div>

      {/* Directory Queue (for automated scraping) */}
      <details className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <summary className="p-6 cursor-pointer text-lg font-semibold">Queue Directory URLs (Automated Scraping)</summary>
        <div className="p-6 pt-0">
        <p className="text-sm text-slate-500 mb-4">
          Queue directory/listing pages to be scraped. May fail with 403 if site blocks bots.
        </p>
        <div className="space-y-4">
          <textarea
            value={manualUrls}
            onChange={(e) => setManualUrls(e.target.value)}
            placeholder="https://example.com/summer-camps&#10;https://another-site.com/camps"
            rows={5}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono text-sm"
          />
          <div className="flex gap-4">
            <button
              onClick={async () => {
                if (!selectedCitySlug || !manualUrls.trim()) {
                  setError('Select a city and enter at least one URL');
                  return;
                }
                setIsLoading(true);
                setError(null);
                try {
                  const urls = manualUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
                  const result = await queueDirectoryUrls({ citySlug: selectedCitySlug, urls });
                  setManualUrls('');
                  alert(`Queued ${result.queued} URLs for processing`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to queue URLs');
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading || !selectedCitySlug}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Queuing...' : 'Queue for Processing'}
            </button>
          </div>

          {/* Queue Status */}
          {queueStatus && (
            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <h4 className="font-medium mb-2">Queue Status</h4>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Pending</p>
                  <p className="text-xl font-bold text-amber-600">{queueStatus.pending}</p>
                </div>
                <div>
                  <p className="text-slate-500">Processing</p>
                  <p className="text-xl font-bold text-blue-600">{queueStatus.processing}</p>
                </div>
                <div>
                  <p className="text-slate-500">Completed</p>
                  <p className="text-xl font-bold text-green-600">{queueStatus.completed}</p>
                </div>
                <div>
                  <p className="text-slate-500">Failed</p>
                  <p className="text-xl font-bold text-red-600">{queueStatus.failed}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </details>

      {/* Manual Directory Scraping (Legacy) */}
      <details className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <summary className="p-6 cursor-pointer text-lg font-semibold">Manual Scraping (Legacy)</summary>
        <div className="p-6 pt-0">
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
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
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
      </details>

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
                    ? 'border-primary/30 dark:border-primary-dark bg-primary/10 dark:bg-primary-dark/20'
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
                        className="font-medium bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary focus:outline-none px-1 -ml-1"
                      />
                      <span className="text-xs text-slate-500">{org.domain}</span>
                    </div>
                    <a
                      href={org.bestUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
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
              onClick={() => setOrganizations((prev) => prev.map((o) => ({ ...o, included: true })))}
              className="px-4 py-2 text-slate-600 hover:text-slate-900"
            >
              Select All
            </button>
            <button
              onClick={() => setOrganizations((prev) => prev.map((o) => ({ ...o, included: false })))}
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
            <div className="text-center p-3 bg-primary/10 dark:bg-primary-dark/20 rounded">
              <p className="text-2xl font-bold text-primary">{seedingResult.summary.existing}</p>
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
            <Link href="/admin/development" className="text-primary hover:underline">
              View Scraper Development Queue &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// DISCOVERY QUEUE TAB
// ============================================

type DiscoveredSourceStatus =
  | 'pending_analysis'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'scraper_generated'
  | 'duplicate';

function DiscoveryQueueTab({ cities }: { cities: any[] | undefined }) {
  const [statusFilter, setStatusFilter] = useState<DiscoveredSourceStatus | 'all'>('all');

  const cityId = cities?.[0]?._id;

  const discoveryQueue = useQuery(
    api.discovery.queries.getDiscoveryQueue,
    cityId
      ? {
          cityId,
          status: statusFilter !== 'all' ? (statusFilter as DiscoveredSourceStatus) : undefined,
        }
      : 'skip'
  );

  const reviewSource = useMutation(api.discovery.mutations.reviewSource);

  const handleApprove = async (sourceId: Id<'discoveredSources'>) => {
    try {
      await reviewSource({ sourceId, status: 'approved' });
    } catch (error) {
      console.error('Failed to approve source:', error);
    }
  };

  const handleReject = async (sourceId: Id<'discoveredSources'>) => {
    try {
      await reviewSource({ sourceId, status: 'rejected' });
    } catch (error) {
      console.error('Failed to reject source:', error);
    }
  };

  const statusFilters: Array<{ value: DiscoveredSourceStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All Pending' },
    { value: 'pending_analysis', label: 'Pending Analysis' },
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-2">
          Status:
        </span>
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              statusFilter === filter.value
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {discoveryQueue === undefined && <LoadingState />}

      {/* Empty State */}
      {discoveryQueue !== undefined && discoveryQueue.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="text-slate-400 mb-4">
            <EmptyIcon />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No sources found
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            {statusFilter !== 'all'
              ? `No sources with status "${statusFilter.replace(/_/g, ' ')}"`
              : 'No discovered sources in the queue'}
          </p>
        </div>
      )}

      {/* Discovery Queue List */}
      {discoveryQueue !== undefined && discoveryQueue.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
          {discoveryQueue.map((source) => (
            <DiscoverySourceRow
              key={source._id}
              source={source}
              onApprove={() => handleApprove(source._id)}
              onReject={() => handleReject(source._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DiscoverySourceRow({
  source,
  onApprove,
  onReject,
}: {
  source: any;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBadgeClass(source.status)}`}>
              {source.status.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {source.domain}
            </span>
          </div>

          <h3 className="font-semibold text-slate-900 dark:text-white mb-1 line-clamp-1">
            {source.title}
          </h3>

          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:text-primary-dark line-clamp-1 mb-2"
          >
            {source.url}
          </a>

          {source.snippet && (
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
              {source.snippet}
            </p>
          )}

          {source.aiAnalysis && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-md p-3 mb-3">
              <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300 uppercase mb-2">
                AI Analysis
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Likely Camp:</span>
                  <span
                    className={`ml-1 font-medium ${
                      source.aiAnalysis.isLikelyCampSite
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {source.aiAnalysis.isLikelyCampSite ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Confidence:</span>
                  <span className="ml-1 font-medium text-slate-900 dark:text-white">
                    {Math.round(source.aiAnalysis.confidence * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Page Type:</span>
                  <span className="ml-1 font-medium text-slate-900 dark:text-white">
                    {source.aiAnalysis.pageType.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Schedule Info:</span>
                  <span
                    className={`ml-1 font-medium ${
                      source.aiAnalysis.hasScheduleInfo
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {source.aiAnalysis.hasScheduleInfo ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              {source.aiAnalysis.detectedCampNames.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Detected camps:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {source.aiAnalysis.detectedCampNames.map((name: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-primary/20 dark:bg-primary-dark/30 text-primary-dark dark:text-white/60 text-xs rounded"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Discovered: {new Date(source.discoveredAt).toLocaleDateString()}
            </span>
            <span>Query: &quot;{source.discoveryQuery}&quot;</span>
          </div>
        </div>

        {(source.status === 'pending_review' || source.status === 'pending_analysis') && (
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={onApprove}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 flex items-center gap-2"
            >
              <CheckIcon />
              Approve
            </button>
            <button
              onClick={onReject}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 flex items-center gap-2"
            >
              <XIcon />
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'pending_analysis':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'pending_review':
      return 'bg-primary/20 text-primary dark:bg-primary-dark/30 dark:text-white/60';
    case 'approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'scraper_generated':
      return 'bg-surface/30 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'duplicate':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
  }
}

// ============================================
// ORGANIZATIONS TAB
// ============================================

function OrganizationsTab({ cities }: { cities: any[] | undefined }) {
  const [selectedCityId, setSelectedCityId] = useState<string>('');

  // Single query for both organizations and counts
  const organizationsData = useQuery(
    api.organizations.queries.listOrganizationsPaginated,
    {
      cityId: selectedCityId ? (selectedCityId as Id<'cities'>) : undefined,
      limit: 50,
    }
  );

  const organizations = organizationsData?.organizations ?? [];
  const counts = organizationsData?.counts;

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Market:</label>
        <select
          value={selectedCityId}
          onChange={(e) => setSelectedCityId(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm"
        >
          <option value="">All Markets</option>
          {cities?.map((city) => (
            <option key={city._id} value={city._id}>
              {city.name}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Organizations" value={counts?.total ?? 0} />
        <StatCard
          label="With Logo"
          value={counts?.withLogo ?? 0}
          variant="success"
        />
        <StatCard
          label="Without Logo"
          value={counts?.withoutLogo ?? 0}
          variant={(counts?.withoutLogo ?? 0) > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="With Website"
          value={counts?.withWebsite ?? 0}
        />
      </div>

      {/* Organizations List */}
      {organizationsData === undefined ? (
        <LoadingState />
      ) : organizations.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
          <p className="text-slate-500">No organizations found.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Organization
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Website
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {organizations.map((org: any) => (
                  <tr key={org._id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {(org.logoUrl || org.logoStorageId) ? (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 text-green-600">
                            <CheckIcon />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-slate-400">
                              {org.name.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{org.name}</p>
                          <p className="text-xs text-slate-500">{org.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {org.website ? (
                        <a
                          href={org.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {org.website}
                        </a>
                      ) : (
                        <span className="text-sm text-slate-400">Not set</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {(org.logoUrl || org.logoStorageId) && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                            Logo
                          </span>
                        )}
                        {!org.logoUrl && !org.logoStorageId && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                            No Logo
                          </span>
                        )}
                        {org.isVerified && (
                          <span className="px-2 py-0.5 text-xs bg-primary/20 dark:bg-primary-dark/30 text-primary-dark dark:text-white/60 rounded">
                            Verified
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination info */}
          {organizationsData && organizationsData.totalCount > organizations.length && (
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400">
              Showing {organizations.length} of {organizationsData.totalCount} organizations
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Icons
function EmptyIcon() {
  return (
    <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
