'use client';

import { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { StatCard, AdminTabs } from '../../../components/admin';
import { MarketCard, ExpansionWizard, type MarketWithStatus } from '../../../components/admin/expansion';

export default function ExpansionPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <ArrowLeftIcon />
          </Link>
          <Link
            href="/"
            className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            PDX Camps
          </Link>
        </div>
        <h1 className="text-lg font-semibold">Market Expansion</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <ExpansionContent />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <p className="text-slate-600 dark:text-slate-400">Please sign in to access market expansion.</p>
            <a href="/sign-in" className="bg-foreground text-background px-6 py-2 rounded-md">
              Sign in
            </a>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function ExpansionContent() {
  const [selectedTier, setSelectedTier] = useState<'all' | '1' | '2' | '3'>('all');
  const [selectedMarketKey, setSelectedMarketKey] = useState<string | null>(null);

  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const summary = useQuery(api.expansion.queries.getExpansionSummary);
  const markets = useQuery(
    api.expansion.queries.listExpansionMarkets,
    selectedTier === 'all' ? {} : { tier: parseInt(selectedTier) },
  );

  // Derive selectedMarket from current markets data so it stays in sync
  const selectedMarket =
    selectedMarketKey && markets
      ? ((markets.find((m) => m.key === selectedMarketKey) as MarketWithStatus | undefined) ?? null)
      : null;

  // Mutations and actions for the wizard
  const initializeMarket = useMutation(api.expansion.mutations.initializeMarket);
  const selectDomain = useMutation(api.expansion.mutations.selectDomain);
  const recordDomainPurchase = useMutation(api.expansion.mutations.recordDomainPurchase);
  const recordDnsConfiguration = useMutation(api.expansion.mutations.recordDnsConfiguration);
  const createCityForMarket = useMutation(api.expansion.mutations.createCityForMarket);
  const launchMarket = useMutation(api.expansion.mutations.launchMarket);

  // Multi-domain mutations
  const addDomain = useMutation(api.expansion.mutations.addDomain);
  const removeDomain = useMutation(api.expansion.mutations.removeDomain);
  const setPrimaryDomain = useMutation(api.expansion.mutations.setPrimaryDomain);
  const recordDomainDnsConfiguration = useMutation(api.expansion.mutations.recordDomainDnsConfiguration);

  // Domain check workflow
  const startDomainCheck = useMutation(api.expansion.domainWorkflow.startDomainCheck);

  const recordResendDomain = useMutation(api.expansion.mutations.recordResendDomain);

  const purchaseDomain = useAction(api.expansion.actions.purchaseDomain);
  const setupDns = useAction(api.expansion.actions.setupDnsForDomain);
  const provisionSsl = useAction(api.expansion.actions.provisionSsl);
  const setupEmailForDomain = useAction(api.expansion.actions.setupEmailForDomain);
  const checkResendDomainStatus = useAction(api.expansion.actions.checkResendDomainStatus);
  const generateIcons = useAction(api.expansion.iconGeneration.generateCityIcons);
  const selectIcon = useAction(api.expansion.iconGeneration.selectCityIcon);

  if (isAdmin === undefined) {
    return <LoadingState />;
  }

  if (!isAdmin) {
    return <AccessDenied />;
  }

  const tabs = [
    { id: 'all', label: 'All Markets', count: summary?.total },
    { id: '1', label: 'Tier 1', count: summary?.tiers.tier1.total },
    { id: '2', label: 'Tier 2', count: summary?.tiers.tier2.total },
    { id: '3', label: 'Tier 3', count: summary?.tiers.tier3.total },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Market Expansion</h2>
        <span className="text-xs text-slate-500">30 markets from research</span>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Launched"
            value={summary.launched}
            subtext={`of ${summary.total} markets`}
            variant="success"
          />
          <StatCard label="In Progress" value={summary.inProgress} subtext="domain/dns/city" variant="info" />
          <StatCard label="Not Started" value={summary.notStarted} subtext="ready to launch" variant="default" />
          <StatCard label="Total Markets" value={summary.total} subtext="Tier 1/2/3 prioritized" />
        </div>
      )}

      {/* Tier Progress */}
      {summary && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Progress by Tier</h3>
          <div className="grid grid-cols-3 gap-4">
            <TierProgress
              tier={1}
              launched={summary.tiers.tier1.launched}
              total={summary.tiers.tier1.total}
              label="Premier Markets"
            />
            <TierProgress
              tier={2}
              launched={summary.tiers.tier2.launched}
              total={summary.tiers.tier2.total}
              label="High-Growth"
            />
            <TierProgress
              tier={3}
              launched={summary.tiers.tier3.launched}
              total={summary.tiers.tier3.total}
              label="Regional"
            />
          </div>
        </div>
      )}

      {/* Tier Tabs */}
      <AdminTabs
        tabs={tabs}
        activeTab={selectedTier}
        onTabChange={(tab) => setSelectedTier(tab as 'all' | '1' | '2' | '3')}
      />

      {/* Markets Grid */}
      {markets ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((market) => (
            <MarketCard
              key={market.key}
              market={market as MarketWithStatus}
              onSelect={() => setSelectedMarketKey(market.key)}
              isSelected={selectedMarket?.key === market.key}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Expansion Wizard Modal */}
      {selectedMarket && (
        <ExpansionWizard
          market={selectedMarket}
          onClose={() => setSelectedMarketKey(null)}
          onInitialize={async () => {
            await initializeMarket({ marketKey: selectedMarket.key });
          }}
          onStartDomainCheck={async (domains) => {
            return await startDomainCheck({ marketKey: selectedMarket.key, domains });
          }}
          onSelectDomain={async (domain) => {
            await selectDomain({ marketKey: selectedMarket.key, domain });
          }}
          onPurchaseDomain={async (domain, price) => {
            const result = await purchaseDomain({ domain, price });
            if (result.success) {
              await recordDomainPurchase({
                marketKey: selectedMarket.key,
                domain,
                porkbunOrderId: result.orderId,
              });
            }
            return result;
          }}
          onSetupDns={async (domain) => {
            const result = await setupDns({ domain });
            if (result.success && result.zoneId) {
              await recordDnsConfiguration({
                marketKey: selectedMarket.key,
                netlifyZoneId: result.zoneId,
              });
            }
            return result;
          }}
          onCreateCity={async (cityData) => {
            return await createCityForMarket({
              marketKey: selectedMarket.key,
              ...cityData,
            });
          }}
          onLaunch={async () => {
            await launchMarket({ marketKey: selectedMarket.key });
          }}
          onGenerateIcons={async (customGuidance) => {
            // Extract 3-letter code from brand name (e.g., "DEN Camps" -> "DEN")
            const cityCode = selectedMarket.suggestedBrandName.split(' ')[0];
            return await generateIcons({
              marketKey: selectedMarket.key,
              cityName: selectedMarket.name,
              cityCode,
              customGuidance,
            });
          }}
          onSelectIcon={async (imageUrl) => {
            return await selectIcon({
              marketKey: selectedMarket.key,
              imageUrl,
            });
          }}
          onAddDomain={async (domain, orderId, makePrimary) => {
            await addDomain({
              marketKey: selectedMarket.key,
              domain,
              orderId,
              makePrimary,
            });
          }}
          onRemoveDomain={async (domain) => {
            await removeDomain({
              marketKey: selectedMarket.key,
              domain,
            });
          }}
          onSetPrimaryDomain={async (domain) => {
            await setPrimaryDomain({
              marketKey: selectedMarket.key,
              domain,
            });
          }}
          onProvisionSsl={async () => {
            const result = await provisionSsl({});
            return result;
          }}
          onSetupDomainDns={async (domain) => {
            const result = await setupDns({ domain });
            if (result.success && result.zoneId) {
              await recordDomainDnsConfiguration({
                marketKey: selectedMarket.key,
                domain,
                netlifyZoneId: result.zoneId,
              });
            }
            return result;
          }}
          onSetupEmail={async (domain, netlifyZoneId) => {
            return await setupEmailForDomain({
              marketKey: selectedMarket.key,
              domain,
              netlifyZoneId,
            });
          }}
          onCheckEmailStatus={async (domainId) => {
            return await checkResendDomainStatus({ domainId });
          }}
        />
      )}
    </div>
  );
}

function TierProgress({
  tier,
  launched,
  total,
  label,
}: {
  tier: number;
  launched: number;
  total: number;
  label: string;
}) {
  const percentage = total > 0 ? Math.round((launched / total) * 100) : 0;
  const tierColors = {
    1: 'bg-amber-500',
    2: 'bg-blue-500',
    3: 'bg-slate-500',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Tier {tier}: {label}
        </span>
        <span className="text-xs text-slate-500">
          {launched}/{total}
        </span>
      </div>
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${tierColors[tier as 1 | 2 | 3]} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
      <p className="text-slate-600 dark:text-slate-400">You don't have permission to access market expansion.</p>
      <Link href="/" className="inline-block mt-4 text-primary hover:underline">
        Return to Home
      </Link>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}
