'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import Link from 'next/link';
import { use, useEffect, useRef } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useMarket } from '@/hooks/useMarket';

export default function FamilySharedPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user, loading: authLoading } = useAuth();
  const isLoggedIn = !!user;
  const plan = useQuery(api.share.queries.getFamilySharedPlan, { shareToken: token });
  const connectFromShareToken = useMutation(api.social.mutations.connectFromShareToken);
  const connectCalledRef = useRef(false);
  const market = useMarket();

  // Set referral cookie and share token cookie when viewing shared plan
  useEffect(() => {
    if (plan?.referralCode) {
      fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: plan.referralCode, shareToken: token, shareType: 'family' }),
      }).catch(() => {});
    }
  }, [plan?.referralCode, token]);

  // Auto-connect friendship for authenticated users
  useEffect(() => {
    if (isLoggedIn && plan && !connectCalledRef.current) {
      connectCalledRef.current = true;
      connectFromShareToken({ shareToken: token, tokenType: 'family' }).catch(() => {});
    }
  }, [isLoggedIn, plan, token, connectFromShareToken]);

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
          <div className="text-6xl mb-4" aria-hidden="true">🔒</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Plan Not Found</h1>
          <p className="text-slate-600 mb-6">This plan link may have expired or been removed.</p>
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

  const childNames = plan.children.map((c) => c.childName).join(' & ');

  // Collect all unique sessions for the "sign up your kids" section
  const allCamps = new Map<
    string,
    {
      campName: string;
      organizationName: string;
      organizationLogoUrl: string | null;
      campSlug: string;
      citySlug: string;
      startDate: string;
      endDate: string;
    }
  >();
  for (const child of plan.children) {
    for (const week of child.weeks) {
      for (const camp of week.camps) {
        if (!allCamps.has(camp.sessionId)) {
          allCamps.set(camp.sessionId, {
            campName: camp.campName,
            organizationName: camp.organizationName,
            organizationLogoUrl: camp.organizationLogoUrl,
            campSlug: camp.campSlug,
            citySlug: camp.citySlug,
            startDate: camp.startDate,
            endDate: camp.endDate,
          });
        }
      }
    }
  }

  // Helper to format date range
  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">☀️</span>
            <span className="font-bold text-lg text-slate-900">{market.tagline}</span>
          </Link>
          {isLoggedIn ? (
            <Link
              href="/"
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm"
            >
              My Plan
            </Link>
          ) : (
            <Link
              href="/sign-up"
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm"
            >
              Create Your Plan
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Plan Header */}
        <div className="bg-gradient-to-br from-accent to-accent-dark rounded-2xl p-6 mb-6 text-white">
          <h1 className="text-2xl font-bold mb-2">
            {childNames}'s Summer {plan.year}
          </h1>
          <p className="text-white/80 mb-4">Shared by the {plan.familyName} family</p>

          {/* Family Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-3xl font-bold">{plan.familyStats.totalCoveredWeeks}</div>
              <div className="text-sm text-white/80">Weeks Planned</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{plan.familyStats.totalCamps}</div>
              <div className="text-sm text-white/80">Camps Booked</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-yellow-300">{plan.familyStats.totalGapWeeks}</div>
              <div className="text-sm text-white/80">Open Weeks</div>
            </div>
          </div>
        </div>

        {/* Add to Your Plan CTA */}
        {allCamps.size > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="text-3xl">👯</div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900 mb-1">Want your kids at the same camps?</h2>
                <p className="text-slate-600 text-sm mb-4">
                  {isLoggedIn
                    ? `Browse the camps below and add them to your plan to coordinate with the ${plan.familyName}s!`
                    : `Sign up free to add these camps to your plan and coordinate with the ${plan.familyName}s!`}
                </p>
                {!isLoggedIn && (
                  <Link
                    href="/sign-up"
                    className="inline-block px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-all"
                  >
                    Sign Up Free
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sign in prompt for non-logged-in users */}
        {!isLoggedIn && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">🔒</span>
              <span className="font-medium text-slate-900">Sign in to see the full schedule</span>
            </div>
            <Link
              href="/sign-in"
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        )}

        {/* Each Child's Schedule */}
        {plan.children.map((child) => {
          // Group consecutive unscheduled weeks
          type WeekGroup =
            | {
                type: 'scheduled';
                week: (typeof child.weeks)[0];
              }
            | {
                type: 'unscheduled';
                weeks: typeof child.weeks;
              };

          const groupedWeeks: WeekGroup[] = [];
          let currentUnscheduledGroup: typeof child.weeks = [];

          for (const week of child.weeks) {
            const isScheduled = week.camps.length > 0 || week.hasEvent;
            if (isScheduled) {
              // Flush any pending unscheduled group
              if (currentUnscheduledGroup.length > 0) {
                groupedWeeks.push({ type: 'unscheduled', weeks: currentUnscheduledGroup });
                currentUnscheduledGroup = [];
              }
              groupedWeeks.push({ type: 'scheduled', week });
            } else {
              currentUnscheduledGroup.push(week);
            }
          }
          // Flush remaining unscheduled
          if (currentUnscheduledGroup.length > 0) {
            groupedWeeks.push({ type: 'unscheduled', weeks: currentUnscheduledGroup });
          }

          return (
            <div key={child.childId} className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-slate-900">{child.childName}'s Schedule</h2>
                <div className="text-sm text-slate-500">
                  {child.stats.coveredWeeks} of {child.stats.totalWeeks} weeks covered
                </div>
              </div>

              {/* Week-by-week with camp details */}
              <div className="space-y-3">
                {groupedWeeks.map((group, groupIndex) => {
                  if (group.type === 'unscheduled') {
                    const firstWeek = group.weeks[0];
                    const lastWeek = group.weeks[group.weeks.length - 1];
                    const weekLabel =
                      group.weeks.length === 1 ? firstWeek.label : `${firstWeek.label} - ${lastWeek.label}`;
                    const monthLabel =
                      firstWeek.monthName === lastWeek.monthName
                        ? firstWeek.monthName
                        : `${firstWeek.monthName} - ${lastWeek.monthName}`;

                    return (
                      <div
                        key={`unscheduled-${groupIndex}`}
                        className="bg-white rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-slate-900">{weekLabel}</span>
                            <span className="text-sm text-slate-500 ml-2">{monthLabel}</span>
                          </div>
                          <span className="text-slate-400 text-sm">
                            {group.weeks.length === 1 ? 'Open' : `${group.weeks.length} open weeks`}
                          </span>
                        </div>
                        <div className="text-slate-400 text-sm italic mt-2">No camps planned yet</div>
                      </div>
                    );
                  }

                  const week = group.week;
                  return (
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
                          <span className="text-yellow-600 font-medium text-sm">{week.coveredDays}/5 days</span>
                        ) : (
                          <span className="text-slate-400 text-sm">Open</span>
                        )}
                      </div>

                      {/* Camps */}
                      {week.camps.length > 0 ? (
                        <div className="space-y-2">
                          {week.camps.map((camp, i) => {
                            const formatDate = (dateStr: string) => {
                              const d = new Date(dateStr + 'T12:00:00');
                              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            };
                            return (
                              <div key={i} className="relative">
                                <div
                                  className={`flex items-center justify-between gap-3 bg-white rounded-lg p-2 border border-slate-100 ${!isLoggedIn ? 'blur-sm select-none' : ''}`}
                                >
                                  <div className="flex items-center gap-3">
                                    {camp.organizationLogoUrl ? (
                                      <img
                                        src={camp.organizationLogoUrl}
                                        alt={camp.organizationName}
                                        className="w-10 h-10 rounded-lg object-cover"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                        {camp.organizationName[0]}
                                      </div>
                                    )}
                                    <div>
                                      <div className="font-medium text-slate-900 text-sm">{camp.campName}</div>
                                      <div className="text-xs text-slate-500">
                                        {camp.organizationName} · {formatDate(camp.startDate)} -{' '}
                                        {formatDate(camp.endDate)}
                                      </div>
                                    </div>
                                  </div>
                                  {isLoggedIn && (
                                    <Link
                                      href={`/discover/${camp.citySlug}?camp=${camp.campSlug}&from=${camp.startDate}&to=${camp.endDate}`}
                                      className="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                      Join Session
                                    </Link>
                                  )}
                                </div>
                                {!isLoggedIn && (
                                  <Link
                                    href="/sign-in"
                                    className="absolute inset-0 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-700"
                                  >
                                    Sign in to see camp
                                  </Link>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : week.hasEvent ? (
                        <div className="flex items-center gap-3 text-slate-500 text-sm">
                          <span>📅</span> Family event
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* All Sessions Summary */}
        {allCamps.size > 0 && isLoggedIn && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h3 className="font-bold text-slate-900 mb-4">All Sessions ({allCamps.size})</h3>
            <div className="space-y-3">
              {Array.from(allCamps.values()).map((camp, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {camp.organizationLogoUrl ? (
                      <img
                        src={camp.organizationLogoUrl}
                        alt={camp.organizationName}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                        {camp.organizationName[0]}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-slate-900">{camp.campName}</div>
                      <div className="text-sm text-slate-500">
                        {camp.organizationName} · {formatDateRange(camp.startDate, camp.endDate)}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/discover/${camp.citySlug}?camp=${camp.campSlug}&from=${camp.startDate}&to=${camp.endDate}`}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Join Session
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Big CTA Section */}
        {isLoggedIn ? (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Ready to coordinate?</h2>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              Click on any camp above to view details and add it to your plan. Coordinate your summer with the{' '}
              {plan.familyName}s!
            </p>
            <Link
              href="/"
              className="inline-block px-8 py-4 bg-blue-600 text-white font-bold text-lg rounded-xl hover:bg-blue-700 shadow-lg transition-all hover:shadow-xl hover:scale-105"
            >
              View My Plan
            </Link>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Plan your summer together!</h2>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              Create your free account to add these camps to your plan, track your coverage, and coordinate with the{' '}
              {plan.familyName}s.
            </p>
            <Link
              href="/sign-up"
              className="inline-block px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg rounded-xl hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:scale-105"
            >
              Sign Up Free
            </Link>
            <p className="text-sm text-slate-500 mt-3">No credit card required</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-12">
        <div className="max-w-3xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p className="mb-2">
            © {new Date().getFullYear()} {market.tagline}. Made in {market.madeIn}.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/terms" className="hover:text-slate-700">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-slate-700">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
