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

  // Collect all unique camps for the "sign up your kids" section
  const allCamps = new Map<string, { campName: string; organizationName: string; campSlug: string; citySlug: string; dates: string[] }>();
  for (const child of plan.children) {
    for (const week of child.weeks) {
      for (const camp of week.camps) {
        if (!allCamps.has(camp.sessionId)) {
          allCamps.set(camp.sessionId, {
            campName: camp.campName,
            organizationName: camp.organizationName,
            campSlug: camp.campSlug,
            citySlug: camp.citySlug,
            dates: [`${week.label} ${week.monthName}`],
          });
        } else {
          const existing = allCamps.get(camp.sessionId)!;
          if (!existing.dates.includes(`${week.label} ${week.monthName}`)) {
            existing.dates.push(`${week.label} ${week.monthName}`);
          }
        }
      }
    }
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

        {/* Sign Up Your Kids CTA */}
        {allCamps.size > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="text-3xl">👯</div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  Want your kids at the same camps?
                </h2>
                <p className="text-slate-600 text-sm mb-4">
                  Sign up free to add these camps to your plan and coordinate with the {plan.familyName}s!
                </p>
                <Link
                  href="/sign-up"
                  className="inline-block px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-all"
                >
                  Sign Up & Add These Camps
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Each Child's Schedule */}
        {plan.children.map((child) => (
          <div key={child.childId} className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {child.childName}'s Schedule
              </h2>
              <div className="text-sm text-slate-500">
                {child.stats.coveredWeeks} of {child.stats.totalWeeks} weeks covered
              </div>
            </div>

            {/* Week-by-week with camp details */}
            <div className="space-y-3">
              {child.weeks.map((week) => (
                <div
                  key={week.weekNumber}
                  className={`bg-white rounded-xl border p-4 ${
                    week.status === 'full'
                      ? 'border-green-200 bg-green-50/30'
                      : week.status === 'partial'
                      ? 'border-yellow-200 bg-yellow-50/30'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-slate-900">{week.label}</span>
                      <span className="text-sm text-slate-500 ml-2">{week.monthName}</span>
                    </div>
                    {week.status === 'full' ? (
                      <span className="text-green-600 font-medium text-sm">✓ Covered</span>
                    ) : week.status === 'partial' ? (
                      <span className="text-yellow-600 font-medium text-sm">
                        {week.coveredDays}/5 days
                      </span>
                    ) : (
                      <span className="text-slate-400 text-sm">Open</span>
                    )}
                  </div>

                  {/* Camps */}
                  {week.camps.length > 0 ? (
                    <div className="space-y-2">
                      {week.camps.map((camp, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 bg-white rounded-lg p-2 border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                              {camp.organizationName[0]}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 text-sm">{camp.campName}</div>
                              <div className="text-xs text-slate-500">{camp.organizationName}</div>
                            </div>
                          </div>
                          <Link
                            href={`/discover/${camp.citySlug}?camp=${camp.campSlug}`}
                            className="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            View Camp
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : week.hasEvent ? (
                    <div className="flex items-center gap-3 text-slate-500 text-sm">
                      <span>📅</span> Family event
                    </div>
                  ) : (
                    <div className="text-slate-400 text-sm italic">
                      No camps planned yet
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* All Camps Summary */}
        {allCamps.size > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h3 className="font-bold text-slate-900 mb-4">
              All Camps ({allCamps.size})
            </h3>
            <div className="space-y-3">
              {Array.from(allCamps.values()).map((camp, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg">
                  <div>
                    <div className="font-medium text-slate-900">{camp.campName}</div>
                    <div className="text-sm text-slate-500">{camp.organizationName}</div>
                  </div>
                  <Link
                    href={`/discover/${camp.citySlug}?camp=${camp.campSlug}`}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add to My Plan
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Big CTA Section */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Plan your summer together!
          </h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Create your free account to add these camps to your plan, track your coverage, and coordinate with the {plan.familyName}s.
          </p>
          <Link
            href="/sign-up"
            className="inline-block px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg rounded-xl hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:scale-105"
          >
            Sign Up Free
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
