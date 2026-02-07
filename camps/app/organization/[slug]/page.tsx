'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { OrgLogo } from '../../../components/shared/OrgLogo';
import { BottomNav } from '../../../components/shared/BottomNav';
import { useMarket } from '../../../hooks/useMarket';
import { GRADE_LABELS } from '../../../lib/constants';
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  LocationIcon,
  CalendarIcon,
  UsersIcon,
} from '../../../components/shared/icons';

export default function OrganizationDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const market = useMarket();

  const organization = useQuery(api.organizations.queries.getOrganizationDetail, slug ? { slug } : 'skip');

  // Loading state
  if (organization === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-4" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-8" />
            <div className="space-y-4">
              <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (organization === null) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Organization Not Found</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">We couldn&apos;t find this organization.</p>
          <Link href="/" className="inline-block bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const formatAgeRange = (requirements?: {
    minAge?: number;
    maxAge?: number;
    minGrade?: number;
    maxGrade?: number;
  }) => {
    if (!requirements) return 'All ages';
    const parts: string[] = [];

    if (requirements.minAge !== undefined || requirements.maxAge !== undefined) {
      if (requirements.minAge !== undefined && requirements.maxAge !== undefined) {
        parts.push(`Ages ${requirements.minAge}-${requirements.maxAge}`);
      } else if (requirements.minAge !== undefined) {
        parts.push(`Ages ${requirements.minAge}+`);
      }
    }

    if (requirements.minGrade !== undefined || requirements.maxGrade !== undefined) {
      const gradeLabel = (grade: number) => GRADE_LABELS[grade] ?? `Grade ${grade}`;
      if (requirements.minGrade !== undefined && requirements.maxGrade !== undefined) {
        parts.push(`${gradeLabel(requirements.minGrade)}-${gradeLabel(requirements.maxGrade)}`);
      }
    }

    return parts.length > 0 ? parts.join(' / ') : 'All ages';
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start + 'T12:00:00');
    const endDate = new Date(end + 'T12:00:00');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (start === end) {
      return `${monthNames[startDate.getMonth()]} ${startDate.getDate()}`;
    }
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${monthNames[startDate.getMonth()]} ${startDate.getDate()}-${endDate.getDate()}`;
    }
    return `${monthNames[startDate.getMonth()]} ${startDate.getDate()} - ${monthNames[endDate.getMonth()]} ${endDate.getDate()}`;
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Back</span>
            </button>
            <Link href="/" className="flex items-center gap-2">
              <span className="font-bold">{market.tagline}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-slate-700 dark:hover:text-slate-300">
            Home
          </Link>
          <ChevronRightIcon className="w-4 h-4" />
          <Link href={`/discover/${market.slug}`} className="hover:text-slate-700 dark:hover:text-slate-300">
            Discover
          </Link>
          <ChevronRightIcon className="w-4 h-4" />
          <span className="text-slate-700 dark:text-slate-300">{organization.name}</span>
        </nav>

        {/* Organization Header */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden mb-6">
          <div className="p-6">
            <div className="flex items-start gap-6">
              {organization.resolvedLogoUrl ? (
                <div className="w-24 h-24 bg-white dark:bg-slate-700 rounded-lg shadow p-2 flex items-center justify-center flex-shrink-0">
                  <OrgLogo
                    url={organization.resolvedLogoUrl}
                    name={organization.name}
                    size="lg"
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary-dark rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl text-white font-bold">{organization.name.charAt(0)}</span>
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{organization.name}</h1>
                {organization.description && (
                  <p className="mt-2 text-slate-600 dark:text-slate-400">{organization.description}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  {organization.website && (
                    <a
                      href={organization.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:text-primary-dark"
                    >
                      <ExternalLinkIcon className="w-4 h-4" />
                      Visit Website
                    </a>
                  )}
                  {organization.phone && organization.phone !== '<UNKNOWN>' && (
                    <a
                      href={`tel:${organization.phone}`}
                      className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      {organization.phone}
                    </a>
                  )}
                  {organization.email && organization.email !== '<UNKNOWN>' && (
                    <a href={`mailto:${organization.email}`} className="text-primary hover:text-primary-dark">
                      {organization.email}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{organization.stats.campCount}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Camps</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {organization.stats.sessionCount}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Sessions</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {organization.stats.locationCount}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Locations</div>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Sessions */}
        {organization.upcomingSessions.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Upcoming Sessions</h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {organization.upcomingSessions.map((session) => (
                <Link
                  key={session._id}
                  href={`/session/${session._id}`}
                  className="block px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 dark:text-white truncate">{session.campName}</h3>
                      <div className="mt-1 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          {formatDateRange(session.startDate, session.endDate)}
                        </span>
                        {session.ageRequirements && (
                          <span className="flex items-center gap-1">
                            <UsersIcon className="w-4 h-4" />
                            {formatAgeRange(session.ageRequirements)}
                          </span>
                        )}
                      </div>
                      {session.categories.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {session.categories.slice(0, 3).map((cat) => (
                            <span
                              key={cat}
                              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="ml-4 text-right flex-shrink-0">
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatPrice(session.price)}
                      </div>
                      <ChevronRightIcon className="w-5 h-5 text-slate-400 mt-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Camps List */}
        {organization.camps.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">All Camps</h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {organization.camps.map((camp) => (
                <div key={camp._id} className="px-6 py-4">
                  <h3 className="font-medium text-slate-900 dark:text-white">{camp.name}</h3>
                  {camp.description && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{camp.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <span>{formatAgeRange(camp.ageRequirements)}</span>
                    {camp.categories.length > 0 && (
                      <>
                        <span>•</span>
                        <span>{camp.categories.join(', ')}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locations */}
        {organization.locations.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Locations</h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {organization.locations.map((location) => (
                <div key={location._id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <LocationIcon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-slate-900 dark:text-white">{location.name}</h3>
                      {location.address && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          {location.address.street !== 'TBD' && `${location.address.street}, `}
                          {location.address.city}, {location.address.state} {location.address.zip}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {organization.camps.length === 0 && organization.upcomingSessions.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">No camps or sessions available at this time.</p>
          </div>
        )}
      </main>

      <BottomNav citySlug={market.slug} />
    </div>
  );
}
