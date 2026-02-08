'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MARKETS } from '../../lib/markets';

const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://deafening-schnauzer-923.convex.site';

export function MixLandingPage() {
  const cities = useQuery(api.cities.queries.listActiveCities);
  const submitFeedback = useMutation(api.feedback.submit);
  const [cityName, setCityName] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleRequestCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityName.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      await submitFeedback({
        message: `City request: ${cityName.trim()} — ${email.trim()}`,
        page: 'city-request',
      });
      setSubmitted(true);
      setCityName('');
      setEmail('');
    } finally {
      setSubmitting(false);
    }
  };

  // Build city cards by matching DB cities to static market configs
  const cityCards = (cities ?? [])
    .map((city) => {
      const market = MARKETS.find(
        (m) => m.slug !== 'mix' && (m.slug === city.slug || m.name === city.name)
      );
      return { city, market };
    })
    .filter(
      (c): c is { city: (typeof cities extends (infer T)[] | undefined ? T : never); market: NonNullable<typeof c.market> } =>
        c.market != null
    );

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-900">Mix Camps</span>
          </a>
          <div className="flex items-center gap-2">
            <a
              href="#cities"
              className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cities
            </a>
            <a
              href="#request"
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Request Your City
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-amber-50/30" />
          <div className="absolute top-20 right-0 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-100/30 rounded-full blur-3xl" />

          <div className="relative max-w-5xl mx-auto px-4 py-24 md:py-32 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200 mb-8">
              <span className="text-sm text-slate-600">
                Now live in <span className="font-semibold text-slate-900">{cityCards.length} cities</span>
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
              Summer camp planning,
              <br />
              <span className="text-blue-600">made simple.</span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              Find camps near home, see your whole summer at a glance, and coordinate with friends.
              Free for families in every city we serve.
            </p>

            <a
              href="#cities"
              className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:-translate-y-0.5"
            >
              Find Your City
              <span className="inline-block group-hover:translate-x-1 transition-transform">→</span>
            </a>
          </div>
        </section>

        {/* City Grid */}
        <section id="cities" className="py-20 px-4 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Choose your city
              </h2>
              <p className="text-xl text-slate-600">
                Each city has its own camp database, curated by local parents.
              </p>
            </div>

            {cities === undefined ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse bg-white rounded-2xl h-48 border border-slate-200" />
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {cityCards.map(({ city, market }) => (
                  <a
                    key={city._id}
                    href={`https://${city.domain || market.domains[0]}`}
                    className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      {city.iconStorageId ? (
                        <img
                          src={`${CONVEX_SITE_URL}/city-icon/${city.slug}`}
                          alt={market.tagline}
                          className="w-12 h-12 rounded-xl object-contain"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                          style={{ backgroundColor: `${market.themeColor}15` }}
                        >
                          {market.emoji}
                        </div>
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {market.tagline}
                        </h3>
                        <p className="text-sm text-slate-500">{market.region}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                      {market.neighborhoods
                        ? `Camps in ${market.neighborhoods}`
                        : `Summer camps in ${market.name}`}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:gap-2 transition-all">
                      Explore camps <span>→</span>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                How it works
              </h2>
              <p className="text-xl text-slate-600">Plan your whole summer in minutes.</p>
            </div>

            <div className="space-y-12">
              {[
                {
                  num: 1,
                  title: 'Pick your city',
                  desc: 'Each city has a curated database of local summer camps with dates, prices, and availability.',
                },
                {
                  num: 2,
                  title: 'Add your kids',
                  desc: 'Tell us their ages and your neighborhood. We show camps nearby that fit.',
                },
                {
                  num: 3,
                  title: 'Plan your summer',
                  desc: 'See every week at a glance. Fill gaps, coordinate with friends, and book directly with camps.',
                },
              ].map((step) => (
                <div key={step.num} className="flex gap-6 items-start">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl text-slate-900 mb-1">{step.title}</h3>
                    <p className="text-slate-600 text-lg">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Request Your City */}
        <section id="request" className="py-20 px-4 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Don't see your city?
            </h2>
            <p className="text-xl text-white/80 mb-10">
              Tell us where you are and we'll let you know when we launch there.
            </p>

            {submitted ? (
              <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20">
                <div className="text-4xl mb-4">🎉</div>
                <h3 className="text-xl font-semibold mb-2">Request received!</h3>
                <p className="text-white/80">
                  We'll email you when we launch in your city.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 text-sm text-white/60 hover:text-white underline"
                >
                  Request another city
                </button>
              </div>
            ) : (
              <form onSubmit={handleRequestCity} className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="city-name" className="block text-sm font-medium text-white/80 mb-1 text-left">
                      City
                    </label>
                    <input
                      id="city-name"
                      type="text"
                      value={cityName}
                      onChange={(e) => setCityName(e.target.value)}
                      placeholder="e.g., Chicago, Los Angeles, Miami"
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="city-email" className="block text-sm font-medium text-white/80 mb-1 text-left">
                      Email
                    </label>
                    <input
                      id="city-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full px-6 py-3 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Notify Me'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-white">Mix Camps</span>
              <p className="text-xs text-slate-500">Summer camp planning for every city</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="#cities" className="hover:text-white transition-colors">
                Cities
              </a>
              <a href="#request" className="hover:text-white transition-colors">
                Request Your City
              </a>
              <a href="/terms" className="hover:text-white transition-colors">
                Terms
              </a>
              <a href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </a>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
            <p>© {new Date().getFullYear()} Mix Camps.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
