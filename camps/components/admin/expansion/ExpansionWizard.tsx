'use client';

import { useState, useEffect } from 'react';
import { MarketWithStatus, STATUS_LABELS, DomainEntry } from './types';
import { DomainChecker } from './DomainChecker';
import { ProgressIndicator } from './ProgressIndicator';

interface ExpansionWizardProps {
  market: MarketWithStatus;
  onClose: () => void;
  onInitialize: () => Promise<void>;
  onStartDomainCheck: (domains: string[]) => Promise<string>; // Returns workflow ID
  onSelectDomain: (domain: string) => Promise<void>;
  onPurchaseDomain: (domain: string, price: string) => Promise<{ success: boolean; orderId?: string; error?: string }>;
  onSetupDns: (domain: string) => Promise<{ success: boolean; zoneId?: string; nameservers?: string[]; error?: string }>;
  onCreateCity: (cityData: {
    name: string;
    slug: string;
    state: string;
    timezone: string;
    centerLatitude: number;
    centerLongitude: number;
    brandName: string;
    domain: string;
    fromEmail: string;
  }) => Promise<{ cityId?: string; success: boolean }>;
  onLaunch: () => Promise<void>;
  onGenerateIcons?: (customGuidance?: string) => Promise<{ success: boolean; images?: string[]; error?: string }>;
  onSelectIcon?: (imageUrl: string) => Promise<{ success: boolean; error?: string }>;
  // New callbacks for multi-domain support
  onAddDomain?: (domain: string, orderId?: string, makePrimary?: boolean) => Promise<void>;
  onRemoveDomain?: (domain: string) => Promise<void>;
  onSetPrimaryDomain?: (domain: string) => Promise<void>;
  onSetupDomainDns?: (domain: string) => Promise<{ success: boolean; zoneId?: string; error?: string }>;
}

type WizardStep = 'overview' | 'domain' | 'purchase' | 'dns' | 'city' | 'launch';

export function ExpansionWizard({
  market,
  onClose,
  onInitialize,
  onStartDomainCheck,
  onSelectDomain,
  onPurchaseDomain,
  onSetupDns,
  onCreateCity,
  onLaunch,
  onGenerateIcons,
  onSelectIcon,
  onAddDomain,
  onRemoveDomain,
  onSetPrimaryDomain,
  onSetupDomainDns,
}: ExpansionWizardProps) {
  const [step, setStep] = useState<WizardStep>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState(market.selectedDomain || '');
  const [selectedDomainPrice, setSelectedDomainPrice] = useState<string>('');

  // City form state
  const [cityName, setCityName] = useState(market.name);
  const [citySlug, setCitySlug] = useState(market.key.split('-').slice(0, -1).join('-') || market.name.toLowerCase().replace(/\s+/g, '-'));
  const [brandName, setBrandName] = useState(market.suggestedBrandName);
  const [fromEmail, setFromEmail] = useState('');

  // Icon generation state
  const [iconGuidance, setIconGuidance] = useState('');

  // Determine which step we should be on based on market status
  useEffect(() => {
    if (market.status === 'not_started') {
      setStep('overview');
    } else if (market.status === 'domain_purchased' && !market.dnsConfigured) {
      setStep('dns');
      // Also set the selected domain from market data
      if (market.selectedDomain) {
        setSelectedDomain(market.selectedDomain);
      }
    } else if (market.status === 'dns_configured' && !market.cityId) {
      setStep('city');
    } else if (market.status === 'city_created') {
      setStep('launch');
    } else if (market.status === 'launched') {
      setStep('overview');
    }
  }, [market.status, market.dnsConfigured, market.cityId, market.selectedDomain]);

  // Update fromEmail when domain changes
  useEffect(() => {
    if (selectedDomain) {
      setFromEmail(`hello@${selectedDomain}`);
    }
  }, [selectedDomain]);

  const statusToStepNumber = {
    not_started: 0,
    domain_purchased: 1,
    dns_configured: 2,
    city_created: 3,
    launched: 4,
  };

  const stepToNumber = {
    overview: 0,
    domain: 1,
    purchase: 1,
    dns: 2,
    city: 3,
    launch: 4,
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await onInitialize();
      setStep('domain');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize');
    } finally {
      setLoading(false);
    }
  };

  const handleDomainSelect = async (domain: string, price?: string) => {
    setSelectedDomain(domain);
    if (price) {
      setSelectedDomainPrice(price);
    }
    await onSelectDomain(domain);
  };

  const handlePurchase = async () => {
    if (!selectedDomain) {
      setError('Please select a domain first');
      return;
    }
    if (!selectedDomainPrice) {
      setError('No price available - please check domain availability first');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await onPurchaseDomain(selectedDomain, selectedDomainPrice);
      if (!result.success) {
        setError(result.error || 'Purchase failed');
        return;
      }
      // If onAddDomain is available, use it to add to domains array
      // Otherwise fall back to the page handler which calls recordDomainPurchase
      if (onAddDomain) {
        const isFirstDomain = !market.domains || market.domains.length === 0;
        await onAddDomain(selectedDomain, result.orderId, isFirstDomain);
      }
      // Clear selected domain so user can add another
      setSelectedDomain('');
      setSelectedDomainPrice('');
      // If this is the first domain, auto-advance to DNS
      if (!market.domains || market.domains.length === 0) {
        setStep('dns');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDnsSetup = async () => {
    if (!selectedDomain && !market.selectedDomain) {
      setError('No domain configured');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await onSetupDns(selectedDomain || market.selectedDomain!);
      if (!result.success) {
        setError(result.error || 'DNS setup failed');
        return;
      }
      setStep('city');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DNS setup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCity = async () => {
    if (!cityName || !citySlug || !brandName) {
      setError('Please fill in all city fields');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await onCreateCity({
        name: cityName,
        slug: citySlug,
        state: market.state,
        timezone: market.timezone,
        centerLatitude: market.coordinates.latitude,
        centerLongitude: market.coordinates.longitude,
        brandName,
        domain: selectedDomain || market.selectedDomain || '',
        fromEmail,
      });
      if (!result.success) {
        setError('City creation failed');
        return;
      }
      setStep('launch');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'City creation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async () => {
    setLoading(true);
    setError(null);
    try {
      await onLaunch();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {market.name}, {market.state}
            </h2>
            <p className="text-sm text-slate-500">
              Tier {market.tier} · {STATUS_LABELS[market.status]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <XIcon />
          </button>
        </div>

        {/* Progress - clickable for navigation */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <ProgressIndicator
            currentStatus={market.status}
            activeStep={stepToNumber[step]}
            onStepClick={(stepNum) => {
              // Map step number back to step name
              const stepNames: WizardStep[] = ['overview', 'domain', 'dns', 'city', 'launch'];
              if (stepNames[stepNum]) {
                setStep(stepNames[stepNum]);
              }
            }}
          />
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Overview Step */}
          {step === 'overview' && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                <h3 className="font-medium text-slate-900 dark:text-white mb-2">Market Overview</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Key Stats</dt>
                    <dd className="text-slate-900 dark:text-white">{market.keyStats}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Why Strong</dt>
                    <dd className="text-slate-900 dark:text-white">{market.whyStrong}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Timezone</dt>
                    <dd className="text-slate-900 dark:text-white">{market.timezone}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Suggested Brand</dt>
                    <dd className="text-slate-900 dark:text-white">{market.suggestedBrandName}</dd>
                  </div>
                </dl>
              </div>

              {market.status === 'launched' ? (
                <>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                    <p className="text-green-700 dark:text-green-300 font-medium">
                      This market is live!
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Domain: {market.selectedDomain}
                    </p>
                  </div>

                  {/* Icon Generation for launched markets */}
                  {onGenerateIcons && (
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                      <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3">City Icon</h4>
                      {market.iconOptions && market.iconOptions.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-sm text-slate-600 dark:text-slate-400">Select an icon:</p>
                          <div className="grid grid-cols-4 gap-2">
                            {market.iconOptions.map((url, i) => (
                              <button
                                key={i}
                                onClick={async () => {
                                  if (onSelectIcon) {
                                    setLoading(true);
                                    await onSelectIcon(url);
                                    setLoading(false);
                                  }
                                }}
                                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                  market.selectedIconSourceUrl === url
                                    ? 'border-primary ring-2 ring-primary'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                }`}
                              >
                                <img src={url} alt={`Icon option ${i + 1}`} className="w-full h-full object-cover" />
                                {market.selectedIconSourceUrl === url && (
                                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                    <span className="text-white text-xl">✓</span>
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={iconGuidance}
                            onChange={(e) => setIconGuidance(e.target.value)}
                            placeholder="Optional: Custom guidance for regeneration"
                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 resize-none"
                            rows={2}
                          />
                          <button
                            onClick={async () => {
                              setLoading(true);
                              await onGenerateIcons(iconGuidance || undefined);
                              setLoading(false);
                            }}
                            disabled={loading}
                            className="text-sm text-primary hover:underline disabled:opacity-50"
                          >
                            {loading ? 'Generating...' : 'Regenerate icons'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Generate AI-powered city icons featuring local landmarks.
                          </p>
                          <textarea
                            value={iconGuidance}
                            onChange={(e) => setIconGuidance(e.target.value)}
                            placeholder="Optional: Add custom guidance (e.g., 'include Space Needle prominently', 'use sunset colors', 'add palm trees')"
                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 resize-none"
                            rows={2}
                          />
                          <button
                            onClick={async () => {
                              setLoading(true);
                              setError(null);
                              const result = await onGenerateIcons(iconGuidance || undefined);
                              if (!result.success) {
                                setError(result.error || 'Failed to generate icons');
                              }
                              setLoading(false);
                            }}
                            disabled={loading}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                          >
                            {loading ? 'Generating Icons...' : 'Generate City Icons'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 font-medium"
                >
                  {loading ? 'Starting...' : market.status === 'not_started' ? 'Start Expansion' : 'Continue Expansion'}
                </button>
              )}
            </div>
          )}

          {/* Domain Step */}
          {step === 'domain' && (
            <div className="space-y-4">
              <h3 className="font-medium text-slate-900 dark:text-white">
                Step 1: Manage Domains
              </h3>

              {/* Registered Domains List */}
              {market.domains && market.domains.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Registered Domains ({market.domains.length})
                  </h4>
                  <div className="space-y-2">
                    {market.domains.map((d) => (
                      <div
                        key={d.domain}
                        className={`flex items-center justify-between p-3 rounded-md border ${
                          d.isPrimary
                            ? 'border-primary bg-primary/5'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm">{d.domain}</span>
                          {d.isPrimary && (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                          {d.dnsConfigured && (
                            <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded">
                              DNS OK
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!d.isPrimary && onSetPrimaryDomain && (
                            <button
                              onClick={async () => {
                                setLoading(true);
                                await onSetPrimaryDomain(d.domain);
                                setLoading(false);
                              }}
                              disabled={loading}
                              className="text-xs text-primary hover:underline disabled:opacity-50"
                            >
                              Make Primary
                            </button>
                          )}
                          {!d.dnsConfigured && onSetupDomainDns && (
                            <button
                              onClick={async () => {
                                setLoading(true);
                                setError(null);
                                const result = await onSetupDomainDns(d.domain);
                                if (!result.success) {
                                  setError(result.error || 'DNS setup failed');
                                }
                                setLoading(false);
                              }}
                              disabled={loading}
                              className="text-xs text-purple-600 hover:underline disabled:opacity-50"
                            >
                              Setup DNS
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Domain */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  {market.domains?.length ? 'Add Another Domain' : 'Find & Purchase Domain'}
                </h4>
                <DomainChecker
                  marketKey={market.key}
                  suggestedDomains={market.suggestedDomains}
                  selectedDomain={selectedDomain}
                  onStartCheck={onStartDomainCheck}
                  onSelect={handleDomainSelect}
                />
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep('overview')}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Back
                </button>
                <div className="flex gap-2">
                  {market.domains && market.domains.length > 0 && (
                    <button
                      onClick={() => setStep('dns')}
                      className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Skip to DNS
                    </button>
                  )}
                  <button
                    onClick={handlePurchase}
                    disabled={!selectedDomain || loading}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
                  >
                    {loading ? 'Purchasing...' : `Purchase ${selectedDomain || 'Domain'}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DNS Step */}
          {step === 'dns' && (
            <div className="space-y-4">
              <h3 className="font-medium text-slate-900 dark:text-white">
                Step 2: Configure DNS
              </h3>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  This will create a Netlify DNS zone for{' '}
                  <span className="font-mono text-slate-900 dark:text-white">
                    {selectedDomain || market.selectedDomain}
                  </span>{' '}
                  and configure the necessary records.
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <li>• A record for root domain pointing to Netlify</li>
                  <li>• CNAME for www subdomain</li>
                  <li>• Nameservers updated at Porkbun</li>
                </ul>
              </div>
              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep('domain')}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Back
                </button>
                <button
                  onClick={handleDnsSetup}
                  disabled={loading}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
                >
                  {loading ? 'Configuring...' : 'Configure DNS'}
                </button>
              </div>
            </div>
          )}

          {/* City Step */}
          {step === 'city' && (
            <div className="space-y-4">
              <h3 className="font-medium text-slate-900 dark:text-white">
                Step 3: Create City Record
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    City Name
                  </label>
                  <input
                    type="text"
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Slug (URL-friendly)
                  </label>
                  <input
                    type="text"
                    value={citySlug}
                    onChange={(e) => setCitySlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    From Email
                  </label>
                  <input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={market.state}
                      disabled
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-100 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Timezone
                    </label>
                    <input
                      type="text"
                      value={market.timezone}
                      disabled
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-100 dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep('dns')}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateCity}
                  disabled={loading || !cityName || !citySlug || !brandName}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create City'}
                </button>
              </div>
            </div>
          )}

          {/* Launch Step */}
          {step === 'launch' && (
            <div className="space-y-4">
              <h3 className="font-medium text-slate-900 dark:text-white">
                Step 4: Launch Market
              </h3>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Ready to Launch!</h4>
                <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <li>Domain: {market.selectedDomain || selectedDomain}</li>
                  <li>DNS: Configured</li>
                  <li>City: Created</li>
                </ul>
              </div>

              {/* Icon Generation */}
              {onGenerateIcons && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                  <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3">City Icon</h4>
                  {market.iconOptions && market.iconOptions.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">Select an icon for this market:</p>
                      <div className="grid grid-cols-4 gap-2">
                        {market.iconOptions.map((url, i) => (
                          <button
                            key={i}
                            onClick={async () => {
                              if (onSelectIcon) {
                                setLoading(true);
                                await onSelectIcon(url);
                                setLoading(false);
                              }
                            }}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                              market.selectedIconSourceUrl === url
                                ? 'border-primary ring-2 ring-primary'
                                : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                            }`}
                          >
                            <img src={url} alt={`Icon option ${i + 1}`} className="w-full h-full object-cover" />
                            {market.selectedIconSourceUrl === url && (
                              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                <span className="text-white text-xl">✓</span>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={iconGuidance}
                        onChange={(e) => setIconGuidance(e.target.value)}
                        placeholder="Optional: Custom guidance for regeneration"
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 resize-none"
                        rows={2}
                      />
                      <button
                        onClick={async () => {
                          setLoading(true);
                          await onGenerateIcons(iconGuidance || undefined);
                          setLoading(false);
                        }}
                        disabled={loading}
                        className="text-sm text-primary hover:underline disabled:opacity-50"
                      >
                        {loading ? 'Generating...' : 'Regenerate icons'}
                      </button>
                      {market.selectedIconStorageId && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                          ✓ Icon saved to city record
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Generate AI-powered city icons featuring {market.name} landmarks.
                      </p>
                      <textarea
                        value={iconGuidance}
                        onChange={(e) => setIconGuidance(e.target.value)}
                        placeholder="Optional: Add custom guidance (e.g., 'include Space Needle prominently', 'use sunset colors')"
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 resize-none"
                        rows={2}
                      />
                      <button
                        onClick={async () => {
                          setLoading(true);
                          setError(null);
                          const result = await onGenerateIcons(iconGuidance || undefined);
                          if (!result.success) {
                            setError(result.error || 'Failed to generate icons');
                          }
                          setLoading(false);
                        }}
                        disabled={loading}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                      >
                        {loading ? 'Generating Icons...' : 'Generate City Icons'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">Next Steps After Launch</h4>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <li>1. Add market to lib/markets.ts for multi-tenant routing</li>
                  <li>2. Create market discovery task to seed camp data</li>
                  <li>3. Configure Netlify site for the new domain</li>
                  <li>4. Start marketing outreach</li>
                </ul>
              </div>
              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep('city')}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Back
                </button>
                <button
                  onClick={handleLaunch}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {loading ? 'Launching...' : 'Launch Market'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
