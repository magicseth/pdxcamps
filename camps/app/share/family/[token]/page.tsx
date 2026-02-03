'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import Link from 'next/link';
import { use } from 'react';

export default function FamilySharedPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const plan = useQuery(api.share.queries.getFamilySharedPlan, { shareToken: token });

  if (plan === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-200 rounded-full" />
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
            className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            Create Your Own Plan
          </Link>
        </div>
      </div>
    );
  }

  const childNames = plan.children.map(c => c.childName).join(' & ');

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
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm"
          >
            Create Your Plan
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Plan Header */}
        <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 mb-6 text-white">
          <h1 className="text-2xl font-bold mb-2">
            {childNames}'s Summer {plan.year}
          </h1>
          <p className="text-purple-100 mb-4">
            Shared by the {plan.familyName} family
          </p>

          {/* Family Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-3xl font-bold">{plan.familyStats.totalCoveredWeeks}</div>
              <div className="text-sm text-purple-100">Weeks Planned</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{plan.familyStats.totalCamps}</div>
              <div className="text-sm text-purple-100">Camps Booked</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-yellow-300">{plan.familyStats.totalGapWeeks}</div>
              <div className="text-sm text-purple-100">Open Weeks</div>
            </div>
          </div>
        </div>

        {/* Each Child's Preview */}
        {plan.children.map((child) => (
          <div key={child.childId} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {child.childName}'s Schedule
              </h2>
              <div className="text-sm text-slate-500">
                {child.stats.coveredWeeks} of {child.stats.totalWeeks} weeks covered
              </div>
            </div>

            {/* Week Grid Preview */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-px bg-slate-200">
                {child.weeks.map((week) => (
                  <div
                    key={week.weekNumber}
                    className={`p-3 text-center ${
                      week.status === 'full'
                        ? 'bg-green-50'
                        : week.status === 'partial'
                        ? 'bg-yellow-50'
                        : 'bg-white'
                    }`}
                  >
                    <div className="text-xs text-slate-500 mb-1">{week.label}</div>
                    <div
                      className={`text-lg font-bold ${
                        week.status === 'full'
                          ? 'text-green-600'
                          : week.status === 'partial'
                          ? 'text-yellow-600'
                          : 'text-slate-300'
                      }`}
                    >
                      {week.status === 'full' ? '✓' : week.status === 'partial' ? '◐' : '○'}
                    </div>
                    {week.campCount > 0 && (
                      <div className="text-xs text-slate-400 mt-1">
                        {week.campCount} camp{week.campCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Blurred Preview Teaser */}
            <div className="mt-3 relative">
              <div className="bg-slate-100 rounded-lg p-4 blur-sm select-none">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-300 rounded"></div>
                  <div>
                    <div className="h-3 w-24 bg-slate-300 rounded mb-1"></div>
                    <div className="h-2 w-16 bg-slate-200 rounded"></div>
                  </div>
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg text-center">
                  <p className="text-sm text-slate-600">
                    Sign up to see which camps {child.childName} is attending
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-sm text-slate-500 mb-8">
          <div className="flex items-center gap-2">
            <span className="text-green-600">✓</span> Full week covered
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-600">◐</span> Partial coverage
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-300">○</span> Open week
          </div>
        </div>

        {/* Big CTA Section */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Want to see the full plan?
          </h2>
          <p className="text-slate-600 mb-2 max-w-md mx-auto">
            Sign up free to see exactly which camps {childNames} {plan.children.length > 1 ? 'are' : 'is'} attending.
          </p>
          <p className="text-slate-500 mb-6 max-w-md mx-auto text-sm">
            Plus, plan your own family's summer with {plan.familyStats.totalCamps > 50 ? '100+' : '50+'} Portland camps!
          </p>
          <Link
            href="/sign-up"
            className="inline-block px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg rounded-xl hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:scale-105"
          >
            Sign Up Free to See Full Plan
          </Link>
          <p className="text-sm text-slate-500 mt-3">
            No credit card required
          </p>
        </div>

        {/* Coordinate Together Section */}
        <div className="mt-8 bg-purple-50 border border-purple-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-3">👯</div>
          <h3 className="font-bold text-slate-900 mb-2">
            Planning camps with the {plan.familyName}s?
          </h3>
          <p className="text-slate-600 text-sm mb-4">
            Create your own plan on PDX Camps and coordinate summer schedules together.
            See which camps your kids' friends are attending!
          </p>
          <Link
            href="/sign-up"
            className="inline-block px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700"
          >
            Start Planning Together
          </Link>
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
