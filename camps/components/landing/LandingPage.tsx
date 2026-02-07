'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '../../convex/_generated/api';
import { useMarket, type Market } from '../../hooks/useMarket';

// Convex HTTP actions URL for serving dynamic assets
const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://deafening-schnauzer-923.convex.site';

/**
 * Get icon URL - uses Convex storage if available, otherwise static path
 */
function getIconUrl(market: Market): string {
  if (market.iconStorageId) {
    return `${CONVEX_SITE_URL}/city-icon/${market.slug}`;
  }
  return `${market.iconPath}/apple-icon.png`;
}

export function LandingPage() {
  const market = useMarket();

  const featuredSessions = useQuery(api.sessions.queries.getFeaturedSessions, {
    citySlug: market.slug,
    limit: 16,
  });

  const organizationsWithLogos = useQuery(api.organizations.queries.getOrganizationsWithLogos, {
    citySlug: market.slug,
  });

  // Count stats
  const campCount = organizationsWithLogos?.length ? organizationsWithLogos.length * 3 : 100; // Rough estimate

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src={getIconUrl(market)}
              alt={market.tagline}
              width={120}
              height={40}
              className="h-10 w-auto"
              priority
              unoptimized={!!market.iconStorageId}
            />
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={`/discover/${market.slug}`}
              className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Browse Camps
            </a>
            <a
              href="/sign-in"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign in
            </a>
            <a
              href="/sign-up"
              className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
            >
              Get Started Free
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Background gradient - sky tones from logo */}
          <div className="absolute inset-0 bg-gradient-to-br from-surface/30 via-white to-accent/10" />
          <div className="absolute top-20 right-0 w-96 h-96 bg-surface/40 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />

          <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28">
            <div className="max-w-3xl">
              {/* Social proof badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200 mb-8">
                <div className="flex -space-x-2">
                  {organizationsWithLogos?.slice(0, 4).map((org, i) => (
                    <div key={org._id} className="w-6 h-6 rounded-full bg-white border-2 border-white overflow-hidden shadow-sm">
                      {org.logoUrl && <img src={org.logoUrl} alt="" className="w-full h-full object-contain" />}
                    </div>
                  ))}
                </div>
                <span className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{campCount}+ camps</span> from trusted {market.name} organizations
                </span>
              </div>

              {/* Main headline - Emotional, benefit-focused */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
                Give your kids
                <br />
                <span className="relative">
                  <span className="relative z-10">an amazing summer.</span>
                  <span className="absolute bottom-2 left-0 right-0 h-3 bg-accent/40 -z-0" />
                </span>
                <br />
                <span className="text-primary">Without losing your mind.</span>
              </h1>

              {/* Subheadline - Focus on parent benefits */}
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                Find camps near home, coordinate with friends for carpools, and see your whole summer at a glance.
                {market.popularOrgs} & 100+ more—all in one place.{' '}
                <span className="font-semibold text-slate-900">Free for {market.name} families.</span>
              </p>

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-4 mb-12">
                <a
                  href="/sign-up"
                  className="group px-8 py-4 text-lg font-semibold bg-accent text-white rounded-xl hover:bg-accent-dark shadow-lg shadow-accent/25 transition-all hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5"
                >
                  Start Planning Free
                  <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </a>
                <a
                  href={`/discover/${market.slug}`}
                  className="px-8 py-4 text-lg font-semibold text-slate-700 bg-white border-2 border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all"
                >
                  Browse All Camps
                </a>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  <span>Free forever for families</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  <span>Data updated daily</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scrolling Organization Logos - Trust Bar */}
        {organizationsWithLogos && organizationsWithLogos.length > 0 && (
          <section className="bg-slate-50 py-8 border-y border-slate-200 overflow-hidden">
            <div className="max-w-6xl mx-auto px-4 mb-6">
              <p className="text-center text-sm text-slate-500 font-medium uppercase tracking-wider">
                Trusted by {market.name} families for camps from
              </p>
            </div>
            <div className="relative">
              <div className="flex items-center gap-12 animate-scroll-slow">
                {organizationsWithLogos.map((org) => (
                  <a
                    key={org._id}
                    href={`/discover/${market.slug}?org=${org.slug}`}
                    className="flex-shrink-0 flex flex-col items-center gap-2 grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300 group"
                  >
                    <div className="h-12 w-28 flex items-center justify-center">
                      <img
                        src={org.logoUrl!}
                        alt={org.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors text-center whitespace-nowrap max-w-[112px] truncate">
                      {org.name}
                    </span>
                  </a>
                ))}
                {organizationsWithLogos.map((org) => (
                  <a
                    key={`dup-${org._id}`}
                    href={`/discover/${market.slug}?org=${org.slug}`}
                    className="flex-shrink-0 flex flex-col items-center gap-2 grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300 group"
                  >
                    <div className="h-12 w-28 flex items-center justify-center">
                      <img
                        src={org.logoUrl!}
                        alt={org.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors text-center whitespace-nowrap max-w-[112px] truncate">
                      {org.name}
                    </span>
                  </a>
                ))}
              </div>
            </div>
            <style jsx>{`
              @keyframes scroll-slow {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .animate-scroll-slow {
                animation: scroll-slow 40s linear infinite;
              }
              .animate-scroll-slow:hover {
                animation-play-state: paused;
              }
            `}</style>
          </section>
        )}

        {/* Pain Point Section - Parent-focused */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Summer should be<br />
                fun for everyone.<br />
                <span className="text-slate-500">Including you.</span>
              </h2>
              <p className="text-xl text-slate-600">
                Sound familiar?
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-16">
              {/* Pain points - real parent problems */}
              <div className="bg-surface/15 rounded-2xl p-6 border border-surface/30">
                <div className="text-3xl mb-4">🚗</div>
                <h3 className="font-semibold text-slate-900 mb-2">"I'm driving across town twice a day"</h3>
                <p className="text-slate-600">
                  One kid at one camp, another across town. Your summer is spent in traffic.
                </p>
              </div>
              <div className="bg-surface/15 rounded-2xl p-6 border border-surface/30">
                <div className="text-3xl mb-4">😢</div>
                <h3 className="font-semibold text-slate-900 mb-2">"But none of my friends are going!"</h3>
                <p className="text-slate-600">
                  You finally found a camp, but your kid doesn't know anyone there. Coordinating with other parents is a nightmare.
                </p>
              </div>
              <div className="bg-surface/15 rounded-2xl p-6 border border-surface/30">
                <div className="text-3xl mb-4">😫</div>
                <h3 className="font-semibold text-slate-900 mb-2">"I have 15 browser tabs open..."</h3>
                <p className="text-slate-600">
                  {market.popularOrgs}... Each with different dates, prices, and age ranges. Where's the spreadsheet?
                </p>
              </div>
              <div className="bg-surface/15 rounded-2xl p-6 border border-surface/30">
                <div className="text-3xl mb-4">😰</div>
                <h3 className="font-semibold text-slate-900 mb-2">"Wait, what about that week?"</h3>
                <p className="text-slate-600">
                  You thought summer was planned, but there's a gap. The good camps are already full. Time to scramble.
                </p>
              </div>
            </div>

            {/* Empathy statement */}
            <div className="bg-gradient-to-r from-accent/10 to-accent/5 rounded-2xl p-8 text-center border border-accent/30">
              <p className="text-xl text-slate-700 leading-relaxed">
                Planning summer shouldn't take more time than <em>enjoying</em> summer.
                <br />
                <span className="font-semibold text-slate-900">You deserve easier.</span>
              </p>
            </div>
          </div>
        </section>

        {/* Solution Section - Focus on real benefits */}
        <section className="py-20 px-4 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-4">
                <span>✨</span> A better way
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Plan smarter. Drive less. Enjoy more.
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                {campCount}+ camps from every provider in {market.name}.
                Filter by neighborhood, coordinate with friends, and see your whole summer in one view.
              </p>
            </div>

            {/* Feature grid - parent benefits focused */}
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                icon="📍"
                title="Find Camps Near You"
                description="Filter by neighborhood to cut commute time. Find camps near home, work, or your kids' school."
              />
              <FeatureCard
                icon="👯"
                title="Coordinate with Friends"
                description="Share your calendar link with other parents. See which camps your kids' friends are attending. Plan together."
              />
              <FeatureCard
                icon="🚗"
                title="Carpool Ready"
                description="When friends are at the same camp, carpooling is easy. Less driving, more summer for everyone."
              />
              <FeatureCard
                icon="📅"
                title="See Every Week"
                description="Visual planner shows your whole summer. Green = covered. Red = needs a camp. No spreadsheets needed."
              />
              <FeatureCard
                icon="👨‍👩‍👧‍👦"
                title="All Your Kids, One View"
                description="Different ages, different interests? Plan for everyone side by side. Find camps that work for siblings."
              />
              <FeatureCard
                icon="✈️"
                title="Vacations Built In"
                description="Add family trips and camp-free weeks. Your planner works around what matters to your family."
              />
            </div>
          </div>
        </section>

        {/* Friends & Carpool Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-surface/20 to-accent/10">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface/30 text-primary rounded-full text-sm font-medium mb-4">
                  <span>👯</span> Coming soon
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                  "Are any of Emma's friends going?"
                </h2>
                <p className="text-xl text-slate-600 mb-6">
                  The hardest part of camp isn't finding one—it's finding one where your kid knows someone.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-surface/30 rounded-full flex items-center justify-center text-primary font-bold text-sm">1</span>
                    <div>
                      <span className="font-medium text-slate-900">Share your planning link</span>
                      <p className="text-slate-600 text-sm">Send it to other parents from school or the neighborhood.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-surface/30 rounded-full flex items-center justify-center text-primary font-bold text-sm">2</span>
                    <div>
                      <span className="font-medium text-slate-900">See where friends are going</span>
                      <p className="text-slate-600 text-sm">Camps show how many friends are registered for each week.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-surface/30 rounded-full flex items-center justify-center text-primary font-bold text-sm">3</span>
                    <div>
                      <span className="font-medium text-slate-900">Coordinate carpools</span>
                      <p className="text-slate-600 text-sm">Same camp + same neighborhood = easy carpooling.</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
                {/* Mock UI preview */}
                <div className="text-sm font-medium text-slate-500 mb-3">Camp Preview</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                    <div>
                      <div className="font-medium text-slate-900">OMSI Science Camp</div>
                      <div className="text-sm text-slate-500">Week of June 16</div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-green-600 font-medium">
                        <span>👯</span> 3 friends going
                      </div>
                      <div className="text-xs text-slate-500">from your circle</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <div className="font-medium text-slate-900">Trackers Earth</div>
                      <div className="text-sm text-slate-500">Week of June 23</div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-slate-600 font-medium">
                        <span>👤</span> 1 friend going
                      </div>
                      <div className="text-xs text-slate-500">from your circle</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-surface/20 rounded-lg border border-surface/30">
                    <div>
                      <div className="font-medium text-slate-900">Oregon Zoo Camp</div>
                      <div className="text-sm text-slate-500">Week of June 30</div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-primary font-medium">
                        <span>🚗</span> Carpool available
                      </div>
                      <div className="text-xs text-slate-500">2 families nearby</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works - Outcome focused */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                From chaos to planned in minutes
              </h2>
              <p className="text-xl text-slate-600">
                No spreadsheets. No 20 browser tabs. Just clarity.
              </p>
            </div>

            <div className="space-y-12">
              <StepCard
                number={1}
                title="Add your kids and your neighborhood"
                description="Tell us their ages and where you live. We'll show camps nearby that actually fit."
              />
              <StepCard
                number={2}
                title="See your whole summer"
                description="A visual calendar shows every week. Green means covered, red means you need to find something. No more guessing."
              />
              <StepCard
                number={3}
                title="Fill gaps with camps your kids will love"
                description="Click any open week to see options. Filter by what matters—location, price, what their friends are doing. Book directly with the camp."
              />
            </div>

            <div className="text-center mt-16">
              {/* Testimonial-style quote */}
              <div className="bg-surface/20 rounded-2xl p-8 mb-8 max-w-2xl mx-auto">
                <p className="text-lg text-slate-700 italic mb-4">
                  "I used to spend entire weekends planning summer camps. Now I can see everything in one place and actually coordinate with other parents. Game changer."
                </p>
                <p className="text-sm text-slate-500">— {market.testimonialAttribution}</p>
              </div>

              <a
                href="/sign-up"
                className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold bg-primary text-white rounded-xl hover:bg-primary-dark shadow-lg shadow-primary/25 transition-all hover:shadow-xl"
              >
                Start Planning Now
                <span>→</span>
              </a>
              <p className="text-sm text-slate-500 mt-3">Free forever. No credit card required.</p>
            </div>
          </div>
        </section>

        {/* Scrolling Sessions Showcase */}
        {featuredSessions && featuredSessions.length > 0 && (
          <section className="bg-slate-900 py-16 overflow-hidden">
            <div className="max-w-6xl mx-auto px-4 mb-8">
              <h2 className="text-2xl font-bold text-white">
                Real camps, real spots available
              </h2>
              <p className="text-slate-400 mt-1">Browse camps happening this summer in {market.name}</p>
            </div>

            <div className="relative">
              <div className="flex gap-4 animate-scroll hover:pause-animation">
                {featuredSessions.map((session) => (
                  <SessionShowcaseCard key={session._id} session={session} citySlug={market.slug} />
                ))}
                {featuredSessions.map((session) => (
                  <SessionShowcaseCard key={`dup-${session._id}`} session={session} citySlug={market.slug} />
                ))}
              </div>
            </div>

            <style jsx>{`
              @keyframes scroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .animate-scroll {
                animation: scroll 60s linear infinite;
              }
              .animate-scroll:hover {
                animation-play-state: paused;
              }
            `}</style>
          </section>
        )}

        {/* Pricing Section */}
        <section className="py-20 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Simple pricing. Start free.
              </h2>
              <p className="text-xl text-slate-600">
                Try everything with our free plan. Upgrade when you need more.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Plan */}
              <div className="bg-slate-50 rounded-2xl p-8 border-2 border-slate-200">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Free</h3>
                  <div className="text-4xl font-bold text-slate-900">$0</div>
                  <p className="text-slate-500 mt-1">forever</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <PricingFeature included>Browse all {market.name} camps</PricingFeature>
                  <PricingFeature included>Plan for all your kids</PricingFeature>
                  <PricingFeature included>See 4 weeks of summer</PricingFeature>
                  <PricingFeature included>Save up to 5 camps</PricingFeature>
                  <PricingFeature>All 12 weeks visible</PricingFeature>
                  <PricingFeature>Unlimited saved camps</PricingFeature>
                  <PricingFeature>Calendar export</PricingFeature>
                </ul>
                <a
                  href="/sign-up"
                  className="block w-full py-3 px-6 text-center font-semibold bg-white border-2 border-slate-300 rounded-xl text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
                >
                  Get Started Free
                </a>
              </div>

              {/* Premium Plan */}
              <div className="bg-gradient-to-br from-primary via-primary-dark to-surface-dark rounded-2xl p-8 text-white relative overflow-hidden">
                {/* Popular badge */}
                <div className="absolute top-4 right-4 px-3 py-1 bg-accent text-white text-xs font-bold rounded-full shadow-lg">
                  BEST VALUE
                </div>
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold mb-2">Premium</h3>
                  <div className="text-4xl font-bold">From $4.99</div>
                  <p className="text-white/70 mt-1">Plan your entire summer</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <PricingFeature included light>Browse all {market.name} camps</PricingFeature>
                  <PricingFeature included light>Plan for all your kids</PricingFeature>
                  <PricingFeature included light>All 12 weeks of summer</PricingFeature>
                  <PricingFeature included light>Unlimited saved camps</PricingFeature>
                  <PricingFeature included light>Export to Google/Apple Calendar</PricingFeature>
                  <PricingFeature included light>Share calendar with co-parent</PricingFeature>
                  <PricingFeature included light>Priority support</PricingFeature>
                </ul>
                <a
                  href="/sign-up"
                  className="block w-full py-3 px-6 text-center font-semibold bg-white text-primary rounded-xl hover:bg-primary/10 transition-colors shadow-lg"
                >
                  Start Free, Upgrade Anytime
                </a>
              </div>
            </div>

            <p className="text-center text-slate-500 mt-8 text-sm">
              All plans include access to 100+ camps. Premium features unlock after free trial.
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 px-4 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">
                Frequently asked questions
              </h2>
            </div>

            <div className="space-y-4">
              <FAQItem
                question="Is this really free? What's the catch?"
                answer={`The free plan lets you browse all camps, plan for all your kids, and see 4 weeks of summer. That's enough for many families! If you need to see all 12 weeks, save unlimited camps, or export to your calendar, Premium starts at just $4.99. We're ${market.name} parents too—we keep it affordable.`}
              />
              <FAQItem
                question="How do I actually book a camp?"
                answer={`You book directly with each camp—${market.popularOrgs}, whoever. We link you straight to their registration page. We're here to help you find and plan, not to be another middleman.`}
              />
              <FAQItem
                question="Can I see camps near my neighborhood?"
                answer={`Yes! Filter by area to find camps close to home, work, or your kids' school. Less driving = more summer. We cover ${market.neighborhoods}, and surrounding areas.`}
              />
              <FAQItem
                question="How does the friends feature work?"
                answer="Share your planning link with other parents you know. When they're planning too, you can see which camps have friends signed up. Great for coordinating carpools and making sure your kid knows someone at camp."
              />
              <FAQItem
                question="My kids are different ages. Does this help?"
                answer="Absolutely. Add all your kids with their ages/grades, and the planner shows each child's schedule side by side. Filter camps by age to see what works for each kid—or find camps that take siblings together."
              />
              <FAQItem
                question="What if a camp isn't listed?"
                answer={`We're constantly adding camps, but if you notice one missing, let us know! We want to have every option available to ${market.name} families.`}
              />
            </div>
          </div>
        </section>

        {/* Final CTA Section - Emotional close */}
        <section className="py-20 px-4 bg-gradient-to-br from-primary via-primary-dark to-surface-dark text-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              This summer, be the parent with the plan.
            </h2>
            <p className="text-xl text-white/80 mb-8">
              While other families scramble, you'll have camps booked, carpools arranged, and weekends free to actually enjoy summer with your kids.
            </p>
            <a
              href="/sign-up"
              className="inline-block px-10 py-5 text-xl font-semibold bg-accent text-white rounded-xl hover:bg-accent-dark shadow-xl shadow-accent/30 transition-all hover:scale-105"
            >
              Start Planning — It's Free
            </a>
            <p className="text-white/70 text-sm mt-4">
              Takes 2 minutes. No credit card. Just less stress.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image
                src={getIconUrl(market)}
                alt={market.tagline}
                width={100}
                height={32}
                className="h-8 w-auto brightness-0 invert"
                unoptimized={!!market.iconStorageId}
              />
              <p className="text-xs text-slate-500">By {market.name} parents, for {market.name} parents</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href={`/discover/${market.slug}`} className="hover:text-white transition-colors">Browse Camps</a>
              <a href="/sign-in" className="hover:text-white transition-colors">Sign In</a>
              <a href="/sign-up" className="hover:text-white transition-colors">Get Started</a>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
            <p>© {new Date().getFullYear()} {market.tagline}. Made with ☀️ in {market.name}.</p>
            <p className="text-slate-500 mt-1">
              We built this because we needed it too.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// LANDING PAGE COMPONENTS
// ============================================================================

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-primary/30 hover:shadow-lg transition-all">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="font-semibold text-lg text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}

function PricingFeature({ children, included = false, light = false }: { children: React.ReactNode; included?: boolean; light?: boolean }) {
  return (
    <li className={`flex items-center gap-3 ${light ? 'text-white' : included ? 'text-slate-900' : 'text-slate-400'}`}>
      {included ? (
        <CheckCircleIcon className={`w-5 h-5 flex-shrink-0 ${light ? 'text-green-300' : 'text-green-500'}`} />
      ) : (
        <svg className="w-5 h-5 flex-shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
        </svg>
      )}
      <span className={!included ? 'line-through' : ''}>{children}</span>
    </li>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl">
        {number}
      </div>
      <div>
        <h3 className="font-semibold text-xl text-slate-900 mb-1">{title}</h3>
        <p className="text-slate-600 text-lg">{description}</p>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
      >
        <span className="font-medium text-slate-900">{question}</span>
        <span className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDownIcon />
        </span>
      </button>
      {isOpen && (
        <div className="px-6 pb-4 text-slate-600">
          {answer}
        </div>
      )}
    </div>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// Session showcase card for scrolling display
function SessionShowcaseCard({ session, citySlug }: {
  session: {
    _id: string;
    campName: string;
    campSlug: string;
    organizationName?: string;
    organizationLogoUrl?: string;
    imageUrl?: string;
    startDate: string;
    endDate: string;
    price: number;
    locationName?: string;
    ageRequirements?: { minAge?: number; maxAge?: number; minGrade?: number; maxGrade?: number };
    categories: string[];
    spotsLeft: number;
    isSoldOut: boolean;
  };
  citySlug: string;
}) {
  const formatDateRange = () => {
    const start = new Date(session.startDate + 'T12:00:00');
    const end = new Date(session.endDate + 'T12:00:00');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (start.getMonth() === end.getMonth()) {
      return `${monthNames[start.getMonth()]} ${start.getDate()}-${end.getDate()}`;
    }
    return `${monthNames[start.getMonth()]} ${start.getDate()} - ${monthNames[end.getMonth()]} ${end.getDate()}`;
  };

  const formatPrice = () => {
    return `$${(session.price / 100).toFixed(0)}`;
  };

  const formatAges = () => {
    if (!session.ageRequirements) return null;
    const { minAge, maxAge, minGrade, maxGrade } = session.ageRequirements;
    if (minGrade !== undefined || maxGrade !== undefined) {
      const gradeLabel = (g: number) => (g === 0 ? 'K' : `${g}`);
      if (minGrade !== undefined && maxGrade !== undefined) {
        return `Gr ${gradeLabel(minGrade)}-${gradeLabel(maxGrade)}`;
      }
    }
    if (minAge !== undefined && maxAge !== undefined) {
      return `${minAge}-${maxAge}y`;
    }
    return null;
  };

  return (
    <a
      href={`/discover/${citySlug}?camp=${session.campSlug}`}
      className="flex-shrink-0 w-72 bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-accent transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-accent/20 group"
    >
      <div className="aspect-[16/10] bg-slate-700 relative overflow-hidden">
        {session.imageUrl ? (
          <img
            src={session.imageUrl}
            alt={session.campName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-primary to-surface-dark">
            🏕️
          </div>
        )}
        <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-lg text-white text-sm font-medium">
          {formatDateRange()}
        </div>
        {session.isSoldOut ? (
          <div className="absolute top-3 right-3 px-2 py-1 bg-red-500 rounded-lg text-white text-xs font-bold">
            SOLD OUT
          </div>
        ) : session.spotsLeft <= 5 && session.spotsLeft > 0 ? (
          <div className="absolute top-3 right-3 px-2 py-1 bg-orange-500 rounded-lg text-white text-xs font-bold">
            {session.spotsLeft} left!
          </div>
        ) : null}
        {session.organizationLogoUrl && (
          <div className="absolute bottom-2 left-2 w-10 h-10 rounded-lg bg-white shadow-lg overflow-hidden border border-white/50">
            <img
              src={session.organizationLogoUrl}
              alt={session.organizationName || 'Organization'}
              className="w-full h-full object-contain p-1"
            />
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-white text-sm line-clamp-1 group-hover:text-accent transition-colors">
          {session.campName}
        </h3>
        {session.organizationName && (
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
            {session.organizationName}
          </p>
        )}

        <div className="flex items-center justify-between mt-3">
          {session.price > 0 ? (
            <span className="text-lg font-bold text-green-400">{formatPrice()}</span>
          ) : (
            <span className="text-sm text-slate-500">Price TBD</span>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {formatAges() && <span>{formatAges()}</span>}
            {session.categories[0] && (
              <span className="px-2 py-0.5 bg-slate-700 rounded-full">{session.categories[0]}</span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
