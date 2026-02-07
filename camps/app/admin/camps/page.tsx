'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { StatCard, CampImage } from '../../../components/admin';

export default function CampsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CampsContent />
    </Suspense>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-full mx-auto px-4 py-6">
          <div className="animate-pulse">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
        </div>
      </header>
      <main className="max-w-full mx-auto px-4 py-8">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            ))}
          </div>
          <div className="flex gap-4 h-[calc(100vh-280px)]">
            <div className="w-2/5 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            <div className="w-3/5 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          </div>
          <span className="sr-only">Loading camps...</span>
        </div>
      </main>
    </div>
  );
}

type ImageFilter = 'all' | 'with_images' | 'missing_images';
type AvailabilityFilter = 'all' | 'with_availability' | 'missing_availability';

function CampsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialCampId = searchParams.get('camp') || null;
  const initialSearch = searchParams.get('search') || '';
  const initialCityId = searchParams.get('city') || null;
  const initialOrgId = searchParams.get('org') || null;
  const initialImageFilter = (searchParams.get('images') as ImageFilter) || 'all';
  const initialAvailabilityFilter = (searchParams.get('availability') as AvailabilityFilter) || 'all';

  const [selectedCampId, setSelectedCampId] = useState<Id<'camps'> | null>(initialCampId as Id<'camps'> | null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCityId, setSelectedCityId] = useState<Id<'cities'> | null>(initialCityId as Id<'cities'> | null);
  const [selectedOrgId, setSelectedOrgId] = useState<Id<'organizations'> | null>(
    initialOrgId as Id<'organizations'> | null,
  );
  const [imageFilter, setImageFilter] = useState<ImageFilter>(initialImageFilter);
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>(initialAvailabilityFilter);

  // Query cities and organizations for filters
  const cities = useQuery(api.cities.queries.listActiveCities, {});
  const organizations = useQuery(api.organizations.queries.listAllOrganizations, {});

  // Query camps with filters
  const campsData = useQuery(api.camps.queries.listCampsForAdmin, {
    cityId: selectedCityId ?? undefined,
    organizationId: selectedOrgId ?? undefined,
    hasImage: imageFilter === 'all' ? undefined : imageFilter === 'with_images',
    hasAvailability: availabilityFilter === 'all' ? undefined : availabilityFilter === 'with_availability',
    search: searchQuery || undefined,
  });

  // Query selected camp details
  const selectedCamp = useQuery(
    api.camps.queries.getCampWithSessions,
    selectedCampId ? { campId: selectedCampId } : 'skip',
  );

  // Update URL when state changes
  const updateUrl = (
    campId: string | null,
    search: string,
    cityId: string | null,
    orgId: string | null,
    images: ImageFilter,
    availability: AvailabilityFilter,
  ) => {
    const params = new URLSearchParams();
    if (campId) params.set('camp', campId);
    if (search) params.set('search', search);
    if (cityId) params.set('city', cityId);
    if (orgId) params.set('org', orgId);
    if (images !== 'all') params.set('images', images);
    if (availability !== 'all') params.set('availability', availability);
    router.push(`/admin/camps${params.toString() ? '?' + params.toString() : ''}`);
  };

  const handleCampSelect = (campId: Id<'camps'>) => {
    setSelectedCampId(campId);
    updateUrl(campId, searchQuery, selectedCityId, selectedOrgId, imageFilter, availabilityFilter);
  };

  const handleCityChange = (cityId: string | null) => {
    setSelectedCityId(cityId as Id<'cities'> | null);
    setSelectedCampId(null);
    updateUrl(null, searchQuery, cityId, selectedOrgId, imageFilter, availabilityFilter);
  };

  const handleOrgChange = (orgId: string | null) => {
    setSelectedOrgId(orgId as Id<'organizations'> | null);
    setSelectedCampId(null);
    updateUrl(null, searchQuery, selectedCityId, orgId, imageFilter, availabilityFilter);
  };

  const handleImageFilterChange = (filter: ImageFilter) => {
    setImageFilter(filter);
    setSelectedCampId(null);
    updateUrl(null, searchQuery, selectedCityId, selectedOrgId, filter, availabilityFilter);
  };

  const handleAvailabilityFilterChange = (filter: AvailabilityFilter) => {
    setAvailabilityFilter(filter);
    setSelectedCampId(null);
    updateUrl(null, searchQuery, selectedCityId, selectedOrgId, imageFilter, filter);
  };

  // Sync with URL changes
  useEffect(() => {
    const camp = searchParams.get('camp');
    const search = searchParams.get('search');
    const city = searchParams.get('city');
    const org = searchParams.get('org');
    const images = searchParams.get('images') as ImageFilter;
    const availability = searchParams.get('availability') as AvailabilityFilter;

    if (camp) setSelectedCampId(camp as Id<'camps'>);
    if (search !== null) setSearchQuery(search);
    if (city) setSelectedCityId(city as Id<'cities'>);
    else setSelectedCityId(null);
    if (org) setSelectedOrgId(org as Id<'organizations'>);
    else setSelectedOrgId(null);
    if (images && ['all', 'with_images', 'missing_images'].includes(images)) {
      setImageFilter(images);
    }
    if (availability && ['all', 'with_availability', 'missing_availability'].includes(availability)) {
      setAvailabilityFilter(availability);
    }
  }, [searchParams]);

  const camps = campsData?.camps ?? [];
  const stats = campsData?.stats ?? {
    totalCamps: 0,
    campsWithImages: 0,
    campsMissingImages: 0,
    campsWithAvailability: 0,
    campsMissingAvailability: 0,
    totalSessions: 0,
    sessionsWithAvailability: 0,
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/admin"
                className="text-sm text-primary hover:text-primary-dark mb-1 block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                &larr; Back to Admin
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Camps Catalog</h1>
            </div>
            <div className="flex items-center gap-4">
              {/* City Filter */}
              <select
                value={selectedCityId ?? ''}
                onChange={(e) => handleCityChange(e.target.value || null)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Markets</option>
                {cities?.map((city) => (
                  <option key={city._id} value={city._id}>
                    {city.name}
                  </option>
                ))}
              </select>
              {/* Organization Filter */}
              <select
                value={selectedOrgId ?? ''}
                onChange={(e) => handleOrgChange(e.target.value || null)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Organizations</option>
                {organizations?.map((org) => (
                  <option key={org._id} value={org._id}>
                    {org.name}
                  </option>
                ))}
              </select>
              {/* Image Filter */}
              <select
                value={imageFilter}
                onChange={(e) => handleImageFilterChange(e.target.value as ImageFilter)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Images</option>
                <option value="with_images">With Images</option>
                <option value="missing_images">Missing Images</option>
              </select>
              {/* Availability Filter */}
              <select
                value={availabilityFilter}
                onChange={(e) => handleAvailabilityFilterChange(e.target.value as AvailabilityFilter)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Availability</option>
                <option value="with_availability">Has Availability Data</option>
                <option value="missing_availability">Missing Availability</option>
              </select>
              {/* Search */}
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search camps..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-64 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 py-4">
        {/* Stats Bar */}
        <div className="grid grid-cols-6 gap-4 mb-4">
          <StatCard label="Total Camps" value={stats.totalCamps} small />
          <StatCard label="With Images" value={stats.campsWithImages} variant="success" small />
          <StatCard
            label="Missing Images"
            value={stats.campsMissingImages}
            variant={stats.campsMissingImages > 0 ? 'warning' : 'default'}
            small
          />
          <StatCard label="Has Availability" value={stats.campsWithAvailability} variant="success" small />
          <StatCard
            label="No Availability"
            value={stats.campsMissingAvailability}
            variant={stats.campsMissingAvailability > 0 ? 'warning' : 'default'}
            small
          />
          <StatCard label="Total Sessions" value={stats.totalSessions} variant="info" small />
        </div>

        {/* Master-Detail Layout */}
        <div className="flex gap-4" style={{ height: 'calc(100vh - 280px)' }}>
          {/* Camp List Panel (40%) */}
          <div className="w-2/5 bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {camps.length} camp{camps.length !== 1 ? 's' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {campsData === undefined ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="p-4 space-y-3 animate-pulse motion-reduce:animate-none"
                >
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                  ))}
                  <span className="sr-only">Loading camps...</span>
                </div>
              ) : camps.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  {searchQuery ? 'No camps match your search.' : 'No camps found.'}
                </div>
              ) : (
                camps.map((camp) => {
                  const isSelected = selectedCampId === camp._id;
                  return (
                    <div
                      key={camp._id}
                      onClick={() => handleCampSelect(camp._id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCampSelect(camp._id);
                        }
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-primary/10 dark:bg-primary-dark/20 border-l-4 border-l-primary' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <CampImage
                          externalImageUrl={camp.imageUrl}
                          name={camp.name}
                          size="sm"
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">{camp.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{camp.organizationName}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-slate-500">
                              {camp.activeSessions} active / {camp.totalSessions} total
                            </span>
                            {camp.hasAvailabilityData && (
                              <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded">
                                {camp.sessionsWithAvailability} w/ spots
                              </span>
                            )}
                            {!camp.hasAvailabilityData && camp.totalSessions > 0 && (
                              <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 rounded">
                                No availability
                              </span>
                            )}
                            {!camp.hasImage && (
                              <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded">
                                No image
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail Panel (60%) */}
          <div className="w-3/5 bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
            {!selectedCampId ? (
              <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                <div className="text-center">
                  <CampIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a camp to view details</p>
                </div>
              </div>
            ) : selectedCamp === undefined ? (
              <div role="status" aria-live="polite" className="p-6 animate-pulse motion-reduce:animate-none space-y-4">
                <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
                <span className="sr-only">Loading camp details...</span>
              </div>
            ) : selectedCamp === null ? (
              <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                Camp not found
              </div>
            ) : (
              <CampDetailPanel camp={selectedCamp} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Camp Detail Panel
interface CampDetailProps {
  camp: NonNullable<ReturnType<typeof useQuery<typeof api.camps.queries.getCampWithSessions>>>;
}

function CampDetailPanel({ camp }: CampDetailProps) {
  const imageUrl = camp.resolvedImageUrls?.[0] || camp.externalImageUrls?.[0];

  const formatTime = (time: { hour: number; minute: number }) => {
    const h = time.hour % 12 || 12;
    const m = time.minute.toString().padStart(2, '0');
    const ampm = time.hour >= 12 ? 'PM' : 'AM';
    return `${h}:${m} ${ampm}`;
  };

  const formatAgeRange = (req?: { minAge?: number; maxAge?: number; minGrade?: number; maxGrade?: number }) => {
    if (!req) return null;
    const parts: string[] = [];
    if (req.minAge !== undefined || req.maxAge !== undefined) {
      if (req.minAge !== undefined && req.maxAge !== undefined) {
        parts.push(`Ages ${req.minAge}-${req.maxAge}`);
      } else if (req.minAge !== undefined) {
        parts.push(`Ages ${req.minAge}+`);
      } else if (req.maxAge !== undefined) {
        parts.push(`Ages up to ${req.maxAge}`);
      }
    }
    if (req.minGrade !== undefined || req.maxGrade !== undefined) {
      if (req.minGrade !== undefined && req.maxGrade !== undefined) {
        parts.push(`Grades ${req.minGrade}-${req.maxGrade}`);
      } else if (req.minGrade !== undefined) {
        parts.push(`Grade ${req.minGrade}+`);
      } else if (req.maxGrade !== undefined) {
        parts.push(`Up to grade ${req.maxGrade}`);
      }
    }
    return parts.length > 0 ? parts.join(' / ') : null;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'sold_out':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'cancelled':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
      case 'completed':
        return 'bg-primary/20 text-primary dark:bg-primary-dark/30 dark:text-white/60';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const ageRange = formatAgeRange(camp.ageRequirements);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Image */}
      <div className="relative h-48 bg-slate-200 dark:bg-slate-700 flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={camp.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <ImageIcon className="w-12 h-12 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No image available</p>
            </div>
          </div>
        )}
        {/* Multiple images indicator */}
        {(camp.resolvedImageUrls.length > 1 || camp.externalImageUrls.length > 1) && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
            +{camp.resolvedImageUrls.length + camp.externalImageUrls.length - 1} more
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{camp.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-slate-600 dark:text-slate-400">by</span>
            {camp.organizationLogoUrl && (
              <img
                src={camp.organizationLogoUrl}
                alt={camp.organizationName || ''}
                className="w-5 h-5 rounded object-contain"
              />
            )}
            <span className="text-sm font-medium text-primary hover:text-primary-dark">{camp.organizationName}</span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {camp.categories.map((cat, i) => (
            <span
              key={i}
              className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded"
            >
              {cat}
            </span>
          ))}
          {ageRange && (
            <span className="px-2 py-1 text-xs bg-primary/10 dark:bg-primary-dark/20 text-primary dark:text-white/70 rounded">
              {ageRange}
            </span>
          )}
          {!camp.isActive && (
            <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
              Inactive
            </span>
          )}
          {camp.isFeatured && (
            <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">
              Featured
            </span>
          )}
        </div>

        {/* Description */}
        {camp.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">{camp.description}</p>
        )}

        {/* Website */}
        {camp.website && (
          <a
            href={camp.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:text-primary-dark flex items-center gap-1"
          >
            <ExternalLinkIcon className="w-4 h-4" />
            Visit website
          </a>
        )}

        {/* Sessions */}
        <div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Sessions ({camp.sessions.length})
          </h3>
          {camp.sessions.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No sessions found</p>
          ) : (
            <div className="space-y-3">
              {camp.sessions.map((session) => {
                const spotsLeft = session.capacity - session.enrolledCount;
                return (
                  <div
                    key={session._id}
                    className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {session.startDate} - {session.endDate}
                        </span>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${getStatusBadge(session.status)}`}>
                          {session.status}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        ${(session.price / 100).toFixed(0)}
                      </span>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {/* Times */}
                      <div className="flex items-center gap-1.5">
                        <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">
                          {formatTime(session.dropOffTime)} - {formatTime(session.pickUpTime)}
                        </span>
                      </div>

                      {/* Availability */}
                      <div className="flex items-center gap-1.5">
                        <UsersIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span
                          className={`${
                            spotsLeft <= 5 && spotsLeft > 0
                              ? 'text-orange-600 dark:text-orange-400'
                              : spotsLeft === 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {spotsLeft}/{session.capacity} spots
                          {session.waitlistCount > 0 && ` (${session.waitlistCount} waitlist)`}
                        </span>
                      </div>

                      {/* Location */}
                      {session.locationName && (
                        <div className="flex items-center gap-1.5 col-span-2">
                          <MapPinIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-600 dark:text-slate-400 truncate">{session.locationName}</span>
                        </div>
                      )}

                      {/* Registration */}
                      {session.externalRegistrationUrl ? (
                        <div className="flex items-center gap-1.5 col-span-2">
                          <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                          <a
                            href={session.externalRegistrationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary-dark truncate"
                          >
                            Register &rarr;
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 col-span-2">
                          <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-red-500 dark:text-red-400">Missing registration URL</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function CampIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21l9-9 9 9M12 3v9" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}
