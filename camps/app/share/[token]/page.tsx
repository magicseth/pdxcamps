'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import Link from 'next/link';
import { use } from 'react';

export default function SharedPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const plan = useQuery(api.share.queries.getSharedPlan, { shareToken: token });

  if (plan === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-primary/30 rounded-full" />
          <div className="h-4 w-32 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  if (plan === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Plan Not Found</h1>
          <p className="text-slate-600 mb-6">
            This plan link may have expired or been removed.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark"
          >
            Create Your Own Plan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">☀️</span>
            <span className="font-bold text-lg text-slate-900">PDX Camps</span>
          </div>
          <Link
            href="/sign-up"
            className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark text-sm"
          >
            Create Your Plan
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Plan Header */}
        <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-6 mb-6 text-white">
          <h1 className="text-2xl font-bold mb-2">
            {plan.childName}'s Summer {plan.year}
          </h1>
          <p className="text-white/80 mb-4">
            Shared by the {plan.familyName} family
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-3xl font-bold">{plan.stats.coveredWeeks}</div>
              <div className="text-sm text-white/80">Weeks Planned</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{plan.stats.partialWeeks}</div>
              <div className="text-sm text-white/80">Partial</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-yellow-300">{plan.stats.gapWeeks}</div>
              <div className="text-sm text-white/80">Open Weeks</div>
            </div>
          </div>
        </div>

        {/* Week-by-Week Plan */}
        <div className="space-y-3 mb-8">
          {plan.weeks.map((week) => (
            <div
              key={week.week.startDate}
              className={`bg-white rounded-xl border p-4 ${
                week.coveredDays >= 5
                  ? 'border-green-200 bg-green-50/30'
                  : week.coveredDays > 0
                  ? 'border-yellow-200 bg-yellow-50/30'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-medium text-slate-900">{week.week.label}</span>
                  <span className="text-sm text-slate-500 ml-2">
                    {week.week.monthName}
                  </span>
                </div>
                {week.coveredDays >= 5 ? (
                  <span className="text-green-600 font-medium text-sm">✓ Covered</span>
                ) : week.coveredDays > 0 ? (
                  <span className="text-yellow-600 font-medium text-sm">
                    {week.coveredDays}/5 days
                  </span>
                ) : (
                  <span className="text-slate-400 text-sm">Open</span>
                )}
              </div>

              {/* Camps */}
              {week.camps.map((camp, i) => (
                <div key={i} className="flex items-center gap-3 mt-2">
                  {camp.organizationLogoUrl ? (
                    <img
                      src={camp.organizationLogoUrl}
                      alt={camp.organizationName}
                      className="w-8 h-8 rounded object-contain bg-white border border-slate-200"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                      {camp.organizationName[0]}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-slate-900 text-sm">{camp.campName}</div>
                    <div className="text-xs text-slate-500">{camp.organizationName}</div>
                  </div>
                </div>
              ))}

              {/* Events */}
              {week.events.map((event, i) => (
                <div key={i} className="flex items-center gap-3 mt-2">
                  <div className="w-8 h-8 rounded bg-surface/30 flex items-center justify-center">
                    {event.eventType === 'vacation' ? '✈️' : event.eventType === 'family_visit' ? '👨‍👩‍👧' : '📅'}
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 text-sm">{event.title}</div>
                    <div className="text-xs text-slate-500">Family Event</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-accent/10 to-accent/5 border-2 border-accent/30 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Plan Your Family's Summer Too!
          </h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Join thousands of Portland families using PDX Camps to organize their summer.
            Find camps near you, coordinate with friends, and never miss a deadline.
          </p>
          <Link
            href="/sign-up"
            className="inline-block px-8 py-4 bg-gradient-to-r from-accent to-accent-dark text-white font-bold text-lg rounded-xl hover:from-accent-dark hover:to-primary shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:scale-105"
          >
            Start Planning Free →
          </Link>
          <p className="text-sm text-slate-500 mt-3">
            No credit card required
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-12">
        <div className="max-w-3xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} PDX Camps. Made in Portland.</p>
        </div>
      </footer>
    </div>
  );
}
