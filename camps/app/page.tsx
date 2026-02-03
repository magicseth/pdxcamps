'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Authenticated, Unauthenticated, useQuery, useMutation } from 'convex/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import Link from 'next/link';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import type { User } from '@workos-inc/node';
import { WeekRow, MonthHeader } from '../components/planner/WeekRow';
import { PlannerGrid } from '../components/planner/PlannerGrid';
import { CoverageLegend } from '../components/planner/CoverageIndicator';
import { AddEventModal } from '../components/planner/AddEventModal';
import { BottomNav } from '../components/shared/BottomNav';

export default function Home() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Authenticated>
        <AuthenticatedHub user={user} onSignOut={signOut} />
      </Authenticated>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
    </div>
  );
}

// Market configuration
const CURRENT_MARKET = {
  slug: 'portland',
  name: 'Portland',
  tagline: 'PDX Camps',
  region: 'Portland Metro Area',
};

// ============================================================================
// LANDING PAGE - Conversion-focused design
// ============================================================================
function LandingPage() {
  const featuredSessions = useQuery(api.sessions.queries.getFeaturedSessions, {
    citySlug: CURRENT_MARKET.slug,
    limit: 16,
  });

  const organizationsWithLogos = useQuery(api.organizations.queries.getOrganizationsWithLogos, {
    citySlug: CURRENT_MARKET.slug,
  });

  // Count stats
  const campCount = organizationsWithLogos?.length ? organizationsWithLogos.length * 3 : 100; // Rough estimate

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☀️</span>
            <span className="font-bold text-xl text-slate-900">{CURRENT_MARKET.tagline}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/discover/${CURRENT_MARKET.slug}`}
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
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Get Started Free
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-amber-50" />
          <div className="absolute top-20 right-0 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl" />

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
                  <span className="font-semibold text-slate-900">{campCount}+ camps</span> from trusted {CURRENT_MARKET.name} organizations
                </span>
              </div>

              {/* Main headline - Emotional, benefit-focused */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
                Give your kids an{' '}
                <span className="relative">
                  <span className="relative z-10">amazing summer.</span>
                  <span className="absolute bottom-2 left-0 right-0 h-3 bg-amber-300/50 -z-0" />
                </span>
                <br />
                <span className="text-blue-600">Without losing your mind.</span>
              </h1>

              {/* Subheadline - Focus on parent benefits */}
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                Find camps near home, coordinate with friends for carpools, and see your whole summer at a glance.
                OMSI, Oregon Zoo, Portland Parks & 100+ more—all in one place.{' '}
                <span className="font-semibold text-slate-900">Free for Portland families.</span>
              </p>

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-4 mb-12">
                <a
                  href="/sign-up"
                  className="group px-8 py-4 text-lg font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5"
                >
                  Start Planning Free
                  <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </a>
                <a
                  href={`/discover/${CURRENT_MARKET.slug}`}
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
            <div className="max-w-6xl mx-auto px-4 mb-4">
              <p className="text-center text-sm text-slate-500 font-medium uppercase tracking-wider">
                Trusted by {CURRENT_MARKET.name} families for camps from
              </p>
            </div>
            <div className="relative">
              <div className="flex items-center gap-16 animate-scroll-slow">
                {organizationsWithLogos.map((org) => (
                  <a
                    key={org._id}
                    href={`/discover/${CURRENT_MARKET.slug}?org=${org.slug}`}
                    className="flex-shrink-0 h-12 w-28 flex items-center justify-center grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300"
                    title={org.name}
                  >
                    <img
                      src={org.logoUrl!}
                      alt={org.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </a>
                ))}
                {organizationsWithLogos.map((org) => (
                  <a
                    key={`dup-${org._id}`}
                    href={`/discover/${CURRENT_MARKET.slug}?org=${org.slug}`}
                    className="flex-shrink-0 h-12 w-28 flex items-center justify-center grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300"
                    title={org.name}
                  >
                    <img
                      src={org.logoUrl!}
                      alt={org.name}
                      className="max-h-full max-w-full object-contain"
                    />
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
                Summer should be fun for everyone.<br />
                <span className="text-slate-500">Including you.</span>
              </h2>
              <p className="text-xl text-slate-600">
                Sound familiar?
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-16">
              {/* Pain points - real parent problems */}
              <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                <div className="text-3xl mb-4">🚗</div>
                <h3 className="font-semibold text-slate-900 mb-2">"I'm driving across town twice a day"</h3>
                <p className="text-slate-600">
                  One kid at OMSI, one at Portland Parks... across town from each other. Your summer is spent in traffic.
                </p>
              </div>
              <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                <div className="text-3xl mb-4">😢</div>
                <h3 className="font-semibold text-slate-900 mb-2">"But none of my friends are going!"</h3>
                <p className="text-slate-600">
                  You finally found a camp, but your kid doesn't know anyone there. Coordinating with other parents is a nightmare.
                </p>
              </div>
              <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                <div className="text-3xl mb-4">😫</div>
                <h3 className="font-semibold text-slate-900 mb-2">"I have 15 browser tabs open..."</h3>
                <p className="text-slate-600">
                  OMSI, Portland Parks, Oregon Zoo, Trackers... Each with different dates, prices, and age ranges. Where's the spreadsheet?
                </p>
              </div>
              <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                <div className="text-3xl mb-4">😰</div>
                <h3 className="font-semibold text-slate-900 mb-2">"Wait, what about that week?"</h3>
                <p className="text-slate-600">
                  You thought summer was planned, but there's a gap. The good camps are already full. Time to scramble.
                </p>
              </div>
            </div>

            {/* Empathy statement */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-8 text-center border border-amber-200">
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
                {campCount}+ camps from every provider in {CURRENT_MARKET.name}.
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
        <section className="py-20 px-4 bg-gradient-to-br from-purple-50 to-blue-50">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
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
                    <span className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">1</span>
                    <div>
                      <span className="font-medium text-slate-900">Share your planning link</span>
                      <p className="text-slate-600 text-sm">Send it to other parents from school or the neighborhood.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">2</span>
                    <div>
                      <span className="font-medium text-slate-900">See where friends are going</span>
                      <p className="text-slate-600 text-sm">Camps show how many friends are registered for each week.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">3</span>
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
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <div>
                      <div className="font-medium text-slate-900">Oregon Zoo Camp</div>
                      <div className="text-sm text-slate-500">Week of June 30</div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-purple-600 font-medium">
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
              <div className="bg-blue-50 rounded-2xl p-8 mb-8 max-w-2xl mx-auto">
                <p className="text-lg text-slate-700 italic mb-4">
                  "I used to spend entire weekends planning summer camps. Now I can see everything in one place and actually coordinate with other parents. Game changer."
                </p>
                <p className="text-sm text-slate-500">— Portland parent of 2</p>
              </div>

              <a
                href="/sign-up"
                className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl"
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
              <p className="text-slate-400 mt-1">Browse camps happening this summer in {CURRENT_MARKET.name}</p>
            </div>

            <div className="relative">
              <div className="flex gap-4 animate-scroll hover:pause-animation">
                {featuredSessions.map((session) => (
                  <SessionShowcaseCard key={session._id} session={session} citySlug={CURRENT_MARKET.slug} />
                ))}
                {featuredSessions.map((session) => (
                  <SessionShowcaseCard key={`dup-${session._id}`} session={session} citySlug={CURRENT_MARKET.slug} />
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
                  <PricingFeature included>Browse all {CURRENT_MARKET.name} camps</PricingFeature>
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
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white relative overflow-hidden">
                {/* Popular badge */}
                <div className="absolute top-4 right-4 px-3 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded-full">
                  BEST VALUE
                </div>
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold mb-2">Summer Pass</h3>
                  <div className="text-4xl font-bold">$29</div>
                  <p className="text-blue-200 mt-1">one-time for summer 2025</p>
                  <p className="text-sm text-blue-300 mt-2">or $5/month</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <PricingFeature included light>Browse all {CURRENT_MARKET.name} camps</PricingFeature>
                  <PricingFeature included light>Plan for all your kids</PricingFeature>
                  <PricingFeature included light>All 12 weeks of summer</PricingFeature>
                  <PricingFeature included light>Unlimited saved camps</PricingFeature>
                  <PricingFeature included light>Export to Google/Apple Calendar</PricingFeature>
                  <PricingFeature included light>Share calendar with co-parent</PricingFeature>
                  <PricingFeature included light>Priority support</PricingFeature>
                </ul>
                <a
                  href="/sign-up"
                  className="block w-full py-3 px-6 text-center font-semibold bg-white text-blue-700 rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
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
                answer="The free plan lets you browse all camps, plan for all your kids, and see 4 weeks of summer. That's enough for many families! If you need to see all 12 weeks, save unlimited camps, or export to your calendar, our Summer Pass is $29 one-time (or $5/month). We're Portland parents too—we keep it affordable."
              />
              <FAQItem
                question="How do I actually book a camp?"
                answer="You book directly with each camp—OMSI, Portland Parks, Oregon Zoo, whoever. We link you straight to their registration page. We're here to help you find and plan, not to be another middleman."
              />
              <FAQItem
                question="Can I see camps near my neighborhood?"
                answer="Yes! Filter by area to find camps close to home, work, or your kids' school. Less driving = more summer. We cover Portland, Beaverton, Lake Oswego, Tigard, West Linn, and surrounding areas."
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
                answer="We're constantly adding camps, but if you notice one missing, let us know! We want to have every option available to Portland families."
              />
            </div>
          </div>
        </section>

        {/* Final CTA Section - Emotional close */}
        <section className="py-20 px-4 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              This summer, be the parent with the plan.
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              While other families scramble, you'll have camps booked, carpools arranged, and weekends free to actually enjoy summer with your kids.
            </p>
            <a
              href="/sign-up"
              className="inline-block px-10 py-5 text-xl font-semibold bg-white text-blue-700 rounded-xl hover:bg-blue-50 shadow-xl transition-all hover:scale-105"
            >
              Start Planning — It's Free
            </a>
            <p className="text-blue-200 text-sm mt-4">
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
              <span className="text-2xl">☀️</span>
              <div>
                <span className="font-bold text-lg text-white">{CURRENT_MARKET.tagline}</span>
                <p className="text-xs text-slate-500">By Portland parents, for Portland parents</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href={`/discover/${CURRENT_MARKET.slug}`} className="hover:text-white transition-colors">Browse Camps</a>
              <a href="/sign-in" className="hover:text-white transition-colors">Sign In</a>
              <a href="/sign-up" className="hover:text-white transition-colors">Get Started</a>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
            <p>© {new Date().getFullYear()} {CURRENT_MARKET.tagline}. Made with ☀️ in {CURRENT_MARKET.name}.</p>
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
    <div className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-blue-200 hover:shadow-lg transition-all">
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
      <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
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
      className="flex-shrink-0 w-72 bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/20 group"
    >
      <div className="aspect-[16/10] bg-slate-700 relative overflow-hidden">
        {session.imageUrl ? (
          <img
            src={session.imageUrl}
            alt={session.campName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-blue-600 to-purple-600">
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
        <h3 className="font-semibold text-white text-sm line-clamp-1 group-hover:text-blue-400 transition-colors">
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

// ============================================================================
// AUTHENTICATED SECTIONS (unchanged from original)
// ============================================================================

function AuthenticatedHub({ user, onSignOut }: { user: User | null; onSignOut: () => void }) {
  const family = useQuery(api.families.queries.getCurrentFamily);
  const children = useQuery(api.children.queries.listChildren);
  const cities = useQuery(api.cities.queries.listActiveCities);

  if (family === undefined || children === undefined) {
    return <LoadingState />;
  }

  if (!family || children.length === 0) {
    return <OnboardingPrompt user={user} onSignOut={onSignOut} hasFamily={!!family} />;
  }

  return <PlannerHub user={user} onSignOut={onSignOut} children={children} cities={cities || []} />;
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-blue-200 dark:bg-blue-800 rounded-full" aria-hidden="true"></div>
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}

function OnboardingPrompt({ user, onSignOut, hasFamily }: { user: User | null; onSignOut: () => void; hasFamily: boolean }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader user={user} onSignOut={onSignOut} />
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">👨‍👩‍👧‍👦</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            {hasFamily ? "Add your children" : "Welcome! Let's get started"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            {hasFamily
              ? "Add your children to start planning their summer camps."
              : "Set up your family profile to discover and plan summer camps."
            }
          </p>
          <Link
            href={hasFamily ? "/onboarding/children" : "/onboarding"}
            className="inline-block px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            {hasFamily ? "Add Children" : "Complete Setup"}
          </Link>
        </div>
      </main>
    </div>
  );
}

function PlannerHub({
  user,
  onSignOut,
  children,
  cities
}: {
  user: User | null;
  onSignOut: () => void;
  children: { _id: Id<'children'>; firstName: string; lastName?: string; birthdate?: string; currentGrade?: number }[];
  cities: { _id: Id<'cities'>; slug: string; name: string }[];
}) {
  const currentYear = new Date().getFullYear();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const yearParam = searchParams.get('year');
    return yearParam ? parseInt(yearParam) : currentYear;
  });
  const [selectedChildId, setSelectedChildId] = useState<Id<'children'> | 'all'>(() => {
    const childParam = searchParams.get('child');
    return childParam && childParam !== 'all' ? childParam as Id<'children'> : 'all';
  });
  const [showOnlyGaps, setShowOnlyGaps] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedYear !== currentYear) params.set('year', selectedYear.toString());
    if (selectedChildId !== 'all') params.set('child', selectedChildId);
    const queryString = params.toString();
    router.replace(`/${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }, [selectedYear, selectedChildId, currentYear, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }
      if ((e.key === 'e' || e.key === 'E') && !showAddEventModal) {
        e.preventDefault();
        setShowAddEventModal(true);
      }
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setShowOnlyGaps((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddEventModal]);

  const coverage = useQuery(api.planner.queries.getSummerCoverage, {
    year: selectedYear,
  });

  const filteredCoverage = useMemo(() => {
    if (!coverage) return [];
    let result = coverage;

    if (selectedChildId !== 'all') {
      result = result.map((week) => ({
        ...week,
        childCoverage: week.childCoverage.filter((c) => c.childId === selectedChildId),
        hasGap: week.childCoverage
          .filter((c) => c.childId === selectedChildId)
          .some((c) => c.status === 'gap'),
      }));
    }

    if (showOnlyGaps) {
      result = result.filter((week) => week.hasGap);
    }

    return result;
  }, [coverage, selectedChildId, showOnlyGaps]);

  const coverageByMonth = useMemo(() => {
    const groups: Map<string, typeof filteredCoverage> = new Map();
    for (const week of filteredCoverage) {
      const month = week.week.monthName;
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(week);
    }
    return Array.from(groups.entries());
  }, [filteredCoverage]);

  const stats = useMemo(() => {
    if (!coverage) return null;
    const totalWeeks = coverage.length;
    const weeksWithGaps = coverage.filter((w) => w.hasGap).length;
    const fullyPlannedWeeks = coverage.filter(
      (w) => w.childCoverage.every((c) => c.status === 'full' || c.status === 'event')
    ).length;

    const registeredSessionIds = new Set<string>();
    const interestedSessionIds = new Set<string>();
    let totalGaps = 0;
    for (const week of coverage) {
      for (const child of week.childCoverage) {
        if (child.status === 'gap') {
          totalGaps++;
        }
        for (const reg of child.registrations) {
          if (reg.status === 'registered') {
            registeredSessionIds.add(reg.sessionId);
          } else if (reg.status === 'interested' || reg.status === 'waitlisted') {
            interestedSessionIds.add(reg.sessionId);
          }
        }
      }
    }

    return {
      totalWeeks,
      weeksWithGaps,
      fullyPlannedWeeks,
      coverage: totalWeeks > 0 ? Math.round((fullyPlannedWeeks / totalWeeks) * 100) : 0,
      registeredCount: registeredSessionIds.size,
      savedCount: interestedSessionIds.size,
      totalGaps,
    };
  }, [coverage]);

  const defaultCity = cities.find(c => c.slug === 'portland') || cities[0];

  const handleGapClick = useCallback((weekStart: string, weekEnd: string, childId: Id<'children'>) => {
    const child = children.find(c => c._id === childId);
    if (!defaultCity) return;

    const params = new URLSearchParams();
    params.set('from', weekStart);
    params.set('to', weekEnd);

    if (child?.birthdate) {
      const birthDate = new Date(child.birthdate);
      const weekStartDate = new Date(weekStart);
      let age = weekStartDate.getFullYear() - birthDate.getFullYear();
      const monthDiff = weekStartDate.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && weekStartDate.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age > 0) {
        params.set('age', age.toString());
      }
    }

    if (child?.currentGrade !== undefined) {
      params.set('grade', child.currentGrade.toString());
    }

    router.push(`/discover/${defaultCity.slug}?${params.toString()}`);
  }, [children, defaultCity, router]);

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:font-medium"
      >
        Skip to main content
      </a>

      <AppHeader user={user} onSignOut={onSignOut} />

      <main id="main-content" className="flex-1 pb-20">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 mb-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Summer {selectedYear}</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedYear((y) => y - 1)}
                  disabled={selectedYear <= currentYear - 1}
                  className="p-1.5 bg-white/20 border border-white/30 rounded-lg text-white hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous year"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  aria-label="Select year"
                  className="px-3 py-1.5 bg-white/20 border border-white/30 rounded-lg text-white text-sm backdrop-blur-sm"
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                    <option key={year} value={year} className="text-slate-900">
                      {year}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSelectedYear((y) => y + 1)}
                  disabled={selectedYear >= currentYear + 1}
                  className="p-1.5 bg-white/20 border border-white/30 rounded-lg text-white hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next year"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {stats && (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className={`text-3xl font-bold ${stats.coverage === 100 ? 'text-green-300 animate-bounce motion-reduce:animate-none' : ''}`}>
                      {stats.coverage === 100 && '🎉 '}
                      {stats.coverage}%
                    </div>
                    <div className="text-sm text-blue-100">Planned</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{stats.fullyPlannedWeeks}</div>
                    <div className="text-sm text-blue-100">Weeks Covered</div>
                  </div>
                  <div title={stats.totalGaps > 0 ? `${stats.totalGaps} child-weeks need camps` : 'All covered!'}>
                    <div className={`text-3xl font-bold ${stats.weeksWithGaps > 0 ? 'text-yellow-300' : ''}`}>
                      {stats.weeksWithGaps}
                    </div>
                    <div className="text-sm text-blue-100">
                      Gaps to Fill
                      {stats.totalGaps > stats.weeksWithGaps && (
                        <span className="text-blue-200/70"> ({stats.totalGaps} slots)</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="h-3 bg-blue-900/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        stats.coverage === 100
                          ? 'bg-green-400'
                          : stats.coverage >= 75
                          ? 'bg-blue-300'
                          : stats.coverage >= 50
                          ? 'bg-yellow-400'
                          : 'bg-orange-400'
                      }`}
                      style={{ width: `${stats.coverage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-blue-200 mt-1">
                    <span>June</span>
                    <span>July</span>
                    <span>August</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-blue-100 border-t border-blue-500/30 pt-3">
                  <Link href="/saved" className="hover:text-white hover:underline transition-colors">
                    {stats.registeredCount} camp{stats.registeredCount !== 1 ? 's' : ''} registered
                  </Link>
                  {stats.savedCount > 0 && (
                    <>
                      <span className="text-blue-300">•</span>
                      <Link href="/saved" className="hover:text-white hover:underline transition-colors">
                        {stats.savedCount} saved for later
                      </Link>
                    </>
                  )}
                </div>
                <p className="mt-3 text-sm text-blue-200 italic">
                  {stats.coverage === 100
                    ? "🎉 Amazing! Summer is fully planned!"
                    : stats.coverage >= 75
                    ? "🚀 Almost there! Just a few more weeks to fill."
                    : stats.coverage >= 50
                    ? "💪 Great progress! Keep filling those gaps."
                    : stats.coverage > 0
                    ? "🌱 Good start! Lots of camps to explore."
                    : "👋 Welcome! Let's plan an awesome summer."}
                </p>
              </>
            )}

            {stats && stats.weeksWithGaps > 0 && defaultCity && (
              <Link
                href={`/discover/${defaultCity.slug}`}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 transition-colors"
              >
                <SearchIcon />
                Find Camps to Fill Gaps
              </Link>
            )}
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {children.length > 1 && (
                <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
                  <button
                    onClick={() => setSelectedChildId('all')}
                    aria-pressed={selectedChildId === 'all'}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selectedChildId === 'all'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    All
                  </button>
                  {children.map((child) => (
                    <button
                      key={child._id}
                      onClick={() => setSelectedChildId(child._id)}
                      title={child.lastName ? `${child.firstName} ${child.lastName}` : child.firstName}
                      aria-pressed={selectedChildId === child._id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        selectedChildId === child._id
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        selectedChildId === child._id
                          ? 'bg-white/30 dark:bg-slate-900/30'
                          : 'bg-slate-200 dark:bg-slate-600'
                      }`}>
                        {child.firstName[0]}
                      </span>
                      {child.firstName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowAddEventModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              title="Add family event (E key)"
            >
              <PlusIcon />
              Add Event
              <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400 rounded text-[10px]">E</kbd>
            </button>
          </div>

          <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <CoverageLegend />
              <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Grid view"
                >
                  <GridIcon />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="List view"
                >
                  <ListIcon />
                </button>
              </div>
            </div>
            {stats && stats.weeksWithGaps > 0 && (
              <label
                htmlFor="show-only-gaps"
                className={`flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-lg transition-colors ${
                  showOnlyGaps
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Toggle gaps filter (G key)"
              >
                <input
                  id="show-only-gaps"
                  type="checkbox"
                  checked={showOnlyGaps}
                  onChange={(e) => setShowOnlyGaps(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className={`text-sm ${showOnlyGaps ? 'font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                  Show only gaps ({stats.weeksWithGaps})
                </span>
                <kbd className="hidden sm:inline px-1.5 py-0.5 bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400 rounded text-[10px]">G</kbd>
              </label>
            )}
          </div>

          {coverage === undefined ? (
            <div role="status" aria-live="polite" className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse motion-reduce:animate-none" aria-hidden="true"></div>
              ))}
              <span className="sr-only">Loading coverage data...</span>
            </div>
          ) : filteredCoverage.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
              {showOnlyGaps && stats && stats.weeksWithGaps === 0 ? (
                <>
                  <div className="text-4xl mb-3">🎉</div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                    No gaps to show!
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    Amazing work! Every week is covered for summer {selectedYear}.
                  </p>
                </>
              ) : showOnlyGaps ? (
                <>
                  <div className="text-4xl mb-3">✨</div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                    No gaps for {children.find(c => c._id === selectedChildId)?.firstName || 'this child'}!
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    This child is fully covered for the summer.
                  </p>
                </>
              ) : (
                <p className="text-slate-500 dark:text-slate-400">
                  No weeks found for summer {selectedYear}.
                </p>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <PlannerGrid
              coverage={filteredCoverage}
              children={selectedChildId === 'all' ? children : children.filter(c => c._id === selectedChildId)}
              citySlug={defaultCity?.slug}
              onGapClick={handleGapClick}
            />
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              {coverageByMonth.map(([month, weeks]) => (
                <div key={month}>
                  <MonthHeader monthName={month} />
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {weeks.map((week, index) => (
                      <WeekRow key={week.week.startDate} data={week} isFirstOfMonth={index === 0} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav citySlug={defaultCity?.slug} />

      <AddEventModal
        isOpen={showAddEventModal}
        onClose={() => setShowAddEventModal(false)}
        defaultChildIds={children.map((c) => c._id)}
      />
    </div>
  );
}

function AppHeader({ user, onSignOut }: { user: User | null; onSignOut: () => void }) {
  const ADMIN_EMAILS = ['seth@magicseth.com'];
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-20">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">☀️</span>
          <span className="font-bold text-lg">PDX Camps</span>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link href="/admin" className="text-sm text-orange-600 hover:underline font-medium rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
              Admin
            </Link>
          )}
          <Link
            href="/settings"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Settings - Manage children, preferences"
            aria-label="Settings"
          >
            <SettingsIcon />
          </Link>
          <button
            onClick={onSignOut}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Sign out of your account"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

// Icons
function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
