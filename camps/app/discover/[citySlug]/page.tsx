'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { OrgLogo } from '../../../components/shared/OrgLogo';
import { BottomNav } from '../../../components/shared/BottomNav';
import { MapWrapper, MapSession } from '../../../components/map';
import { AddChildModal } from '../../../components/planner/AddChildModal';
import { RequestCampModal } from '../../../components/discover/RequestCampModal';
import { SessionCard } from '../../../components/discover/SessionCard';
import { FilterChip } from '../../../components/discover/FilterControls';
import { useMarket } from '../../../hooks/useMarket';
import { useDiscoverFilters } from '../../../hooks/useDiscoverFilters';
import { getChildAge, formatDateShort } from '../../../lib/dateUtils';

import { CATEGORIES, GRADE_LABELS } from '../../../lib/constants';
import { SettingsIcon, FilterIcon, LocationIcon, ListIcon, MapIcon } from '../../../components/shared/icons';

export default function DiscoverPage() {
  const params = useParams();
  const citySlug = params.citySlug as string;
  const searchParams = useSearchParams();
  const market = useMarket();

  const filters = useDiscoverFilters(citySlug, searchParams);

  // Pagination state
  const SESSIONS_PER_PAGE = 20;
  const [displayCount, setDisplayCount] = useState(SESSIONS_PER_PAGE);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(SESSIONS_PER_PAGE);
  }, [filters.selectedCategories, filters.selectedOrganizations, filters.selectedLocations,
      filters.startDateAfter, filters.startDateBefore, filters.maxPrice, filters.hideSoldOut,
      filters.childAge, filters.childGrade, filters.maxDistanceMiles, filters.sortBy]);

  // Fetch city data
  const city = useQuery(api.cities.queries.getCityBySlug, { slug: citySlug });

  // Update document title
  useEffect(() => {
    const cityName = city?.name || 'Discover';
    document.title = `${cityName} Summer Camps | ${market.tagline}`;
    return () => {
      document.title = market.tagline;
    };
  }, [city?.name]);

  // Fetch all organizations for filter chips
  const allOrganizations = useQuery(
    api.organizations.queries.listOrganizations,
    city ? { cityId: city._id } : 'skip'
  );

  // Fetch all locations for filter chips
  const allLocations = useQuery(
    api.locations.queries.listLocations,
    city ? { cityId: city._id } : 'skip'
  );

  // Check if user is admin (for generate image button)
  const isAdmin = useQuery(api.admin.queries.isAdmin);

  // Fetch user's children for quick filter
  const myChildren = useQuery(api.children.queries.listChildren);

  // Fetch family data for home address
  const family = useQuery(api.families.queries.getCurrentFamily);
  const homeLatitude = family?.homeAddress?.latitude;
  const homeLongitude = family?.homeAddress?.longitude;
  const hasHomeCoords = homeLatitude !== undefined && homeLongitude !== undefined;

  // Fetch sessions with filters (server-side pagination)
  const sessionsResult = useQuery(
    api.sessions.queries.searchSessions,
    city
      ? {
          cityId: city._id,
          startDateAfter: filters.startDateAfter || undefined,
          startDateBefore: filters.startDateBefore || undefined,
          categories: filters.selectedCategories.length > 0 ? filters.selectedCategories : undefined,
          maxPrice: filters.maxPrice !== undefined ? filters.maxPrice * 100 : undefined, // Convert to cents
          excludeSoldOut: filters.hideSoldOut || undefined,
          childAge: filters.childAge,
          childGrade: filters.childGrade,
          locationIds: filters.selectedLocations.length > 0 ? filters.selectedLocations as Id<'locations'>[] : undefined,
          organizationIds: filters.selectedOrganizations.length > 0 ? filters.selectedOrganizations as Id<'organizations'>[] : undefined,
          extendedCareOnly: filters.extendedCareOnly || undefined,
          homeLatitude: hasHomeCoords ? homeLatitude : undefined,
          homeLongitude: hasHomeCoords ? homeLongitude : undefined,
          maxDistanceMiles: hasHomeCoords && filters.maxDistanceMiles !== undefined ? filters.maxDistanceMiles : undefined,
          limit: displayCount + 20, // Request a bit more than we display for smoother loading
        }
      : 'skip'
  );

  // Extract sessions array and metadata from paginated result
  const sessions = sessionsResult?.sessions;
  const totalSessionCount = sessionsResult?.totalCount ?? 0;
  const serverHasMore = sessionsResult?.hasMore ?? false;

  // Sort sessions client-side (filtering is now server-side)
  // This useMemo must be called before any early returns to maintain hooks order
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];

    // Clone and sort results
    const result = [...sessions];
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'date':
          return a.startDate.localeCompare(b.startDate);
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'spots':
          const spotsA = a.capacity - a.enrolledCount;
          const spotsB = b.capacity - b.enrolledCount;
          return spotsB - spotsA; // Most spots first
        case 'distance':
          const distA = (a as { distanceFromHome?: number }).distanceFromHome ?? Infinity;
          const distB = (b as { distanceFromHome?: number }).distanceFromHome ?? Infinity;
          return distA - distB;
        default:
          return 0;
      }
    });

    return result;
  }, [sessions, filters.sortBy]);

  // All sorted sessions are already limited by server - just use them
  const displayedSessions = filteredSessions;

  // Use server's hasMore flag for pagination
  const hasMoreSessions = serverHasMore;

  // Count sessions per organization (from raw sessions, not filtered)
  const sessionCountsByOrg = useMemo(() => {
    if (!sessions) return new Map<string, number>();
    const counts = new Map<string, number>();
    sessions.forEach((s) => {
      counts.set(s.organizationId, (counts.get(s.organizationId) || 0) + 1);
    });
    return counts;
  }, [sessions]);

  // Filter locations to only show those with sessions in current results
  // (sessions are already filtered by org/etc on the server)
  const relevantLocations = useMemo(() => {
    if (!allLocations || !sessions) return [];

    // Get location IDs that have at least one session in current results
    const locationsWithSessions = new Set<string>();
    sessions.forEach((s) => locationsWithSessions.add(s.locationId));

    // Also include any currently selected locations (so they don't disappear)
    filters.selectedLocations.forEach((locId) => locationsWithSessions.add(locId));

    const filtered = allLocations.filter((loc) => locationsWithSessions.has(loc._id));

    // Deduplicate by name - keep the first occurrence of each unique name
    const seenNames = new Set<string>();
    return filtered.filter((loc) => {
      const normalizedName = loc.name.toLowerCase().trim();
      if (seenNames.has(normalizedName)) {
        return false;
      }
      seenNames.add(normalizedName);
      return true;
    });
  }, [allLocations, sessions, filters.selectedLocations]);

  // Loading state
  if (city === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-4" aria-hidden="true"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-96 mb-8" aria-hidden="true"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
              ))}
            </div>
            <span className="sr-only">Loading camps...</span>
          </div>
        </div>
      </div>
    );
  }

  // City not found
  if (city === null) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">City Not Found</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            We couldn&apos;t find a city with the slug &quot;{citySlug}&quot;.
          </p>
          <Link
            href="/"
            className="inline-block bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium hidden sm:inline">Planner</span>
              </Link>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Discover Camps
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
                <button
                  type="button"
                  onClick={() => filters.setViewMode('list')}
                  className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1 ${
                    filters.viewMode === 'list'
                      ? 'bg-primary text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                  title="List view"
                >
                  <ListIcon />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  type="button"
                  onClick={() => filters.setViewMode('map')}
                  className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1 ${
                    filters.viewMode === 'map'
                      ? 'bg-primary text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                  title="Map view (M key)"
                >
                  <MapIcon />
                  <span className="hidden sm:inline">Map</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => filters.setShowFilters(!filters.showFilters)}
                aria-expanded={filters.showFilters}
                className="md:hidden flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm"
                title="Toggle filters (F key)"
              >
                <FilterIcon />
                <span>
                  Filters
                  {sessions !== undefined && (
                    <span className="text-slate-500 dark:text-slate-400 ml-1">
                      ({filteredSessions.length})
                    </span>
                  )}
                </span>
                {filters.activeFilterCount > 0 && (
                  <span className="min-w-5 h-5 px-1 bg-primary text-white text-xs font-medium rounded-full flex items-center justify-center">
                    {filters.activeFilterCount}
                  </span>
                )}
              </button>
              <Link
                href="/settings"
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Settings"
                title="Settings"
              >
                <SettingsIcon />
              </Link>
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl">☀️</span>
                <span className="font-bold hidden sm:inline">{market.tagline}</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Filters Sidebar */}
          <aside
            className={`${
              filters.showFilters ? 'block' : 'hidden'
            } md:block w-full md:w-72 flex-shrink-0`}
          >
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 sticky top-24 max-h-[calc(100vh-12rem)] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  Filters
                  <kbd className="hidden lg:inline px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded text-[10px]" title="Press F to toggle filters">F</kbd>
                </h2>
                <div className="flex items-center gap-3">
                  {filters.hasActiveFilters && (
                    <ShareSearchButton />
                  )}
                  {filters.hasActiveFilters && (
                    <button
                      onClick={filters.clearFilters}
                      className={`text-sm text-primary hover:text-primary-dark ${
                        filters.activeFilterCount > 3 ? 'font-medium animate-pulse motion-reduce:animate-none' : ''
                      }`}
                    >
                      Clear all {filters.activeFilterCount > 3 && `(${filters.activeFilterCount})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Date Range */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Date Range
                </label>
                <div className="space-y-2">
                  <div>
                    <label htmlFor="discover-date-from" className="text-xs text-slate-500 dark:text-slate-400">From</label>
                    <input
                      id="discover-date-from"
                      type="date"
                      value={filters.startDateAfter}
                      onChange={(e) => filters.setStartDateAfter(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="discover-date-to" className="text-xs text-slate-500 dark:text-slate-400">To</label>
                    <input
                      id="discover-date-to"
                      type="date"
                      value={filters.startDateBefore}
                      onChange={(e) => filters.setStartDateBefore(e.target.value)}
                      min={filters.startDateAfter || new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Age/Grade */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {myChildren && myChildren.length > 0 ? 'Filter by Child' : 'Child Age or Grade'}
                </label>
                {/* Child filter buttons when user has children */}
                {myChildren && myChildren.length > 0 ? (
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {myChildren.map((child) => {
                        const age = getChildAge(child.birthdate);
                        const grade = child.currentGrade;
                        const isSelected = filters.selectedChildId === child._id;
                        return (
                          <button
                            key={child._id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                // Deselect: clear child selection and age/grade filters
                                filters.setSelectedChildId(null);
                                filters.setChildAge(undefined);
                                filters.setChildGrade(undefined);
                              } else {
                                // Select: set child and apply their age/grade
                                filters.setSelectedChildId(child._id);
                                // Set age if available (always show in button)
                                if (age !== null) {
                                  filters.setChildAge(age);
                                }
                                // Also set grade if available for more accurate filtering
                                if (grade !== undefined) {
                                  filters.setChildGrade(grade);
                                } else {
                                  filters.setChildGrade(undefined);
                                }
                              }
                            }}
                            className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                              isSelected
                                ? 'bg-primary text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {child.firstName} ({age}y)
                            {isSelected && <span className="ml-1">✕</span>}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => filters.setShowAddChildModal(true)}
                        className="px-2 py-1 text-xs rounded-md font-medium transition-colors border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary"
                      >
                        + Add Child
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label htmlFor="discover-child-age" className="text-xs text-slate-500 dark:text-slate-400">Age (years)</label>
                      <input
                        id="discover-child-age"
                        type="number"
                        inputMode="numeric"
                        min={3}
                        max={18}
                        value={filters.childAge ?? ''}
                        onChange={(e) =>
                          filters.setChildAge(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                        placeholder="e.g., 8"
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="text-center text-xs text-slate-400">or</div>
                    <div>
                      <label htmlFor="discover-child-grade" className="text-xs text-slate-500 dark:text-slate-400">Grade</label>
                      <select
                        id="discover-child-grade"
                        value={filters.childGrade ?? ''}
                        onChange={(e) =>
                          filters.setChildGrade(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value="">Any grade</option>
                        {Object.entries(GRADE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => filters.setShowAddChildModal(true)}
                      className="w-full mt-2 px-3 py-2 text-sm rounded-md font-medium transition-colors border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary"
                    >
                      + Add a Child
                    </button>
                  </div>
                )}
              </div>

              {/* Categories */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((category) => {
                    const emoji: Record<string, string> = {
                      Sports: '⚽',
                      Arts: '🎨',
                      STEM: '🔬',
                      Nature: '🌲',
                      Music: '🎵',
                      Academic: '📚',
                      Drama: '🎭',
                      Adventure: '🏔️',
                      Cooking: '🍳',
                      Dance: '💃',
                    };
                    const isSelected = filters.selectedCategories.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => filters.handleCategoryToggle(category)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors flex items-center gap-1 ${
                          isSelected
                            ? 'bg-primary text-white border-primary'
                            : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>{emoji[category] || '🏕️'}</span>
                        {category}
                        {isSelected && <span className="ml-0.5">✕</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Max Price */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Max Price
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[200, 300, 500, 1000].map((price) => (
                    <button
                      key={price}
                      type="button"
                      onClick={() => filters.setMaxPrice(filters.maxPrice === price ? undefined : price)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                        filters.maxPrice === price
                          ? 'bg-primary text-white border-primary'
                          : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      Under ${price}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="discover-max-price" className="text-slate-500">$</label>
                  <input
                    id="discover-max-price"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={50}
                    value={filters.maxPrice ?? ''}
                    onChange={(e) =>
                      filters.setMaxPrice(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    placeholder="Custom amount"
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                {filters.maxPrice !== undefined && (
                  <input
                    type="range"
                    min={0}
                    max={2000}
                    step={50}
                    value={filters.maxPrice}
                    onChange={(e) => filters.setMaxPrice(parseInt(e.target.value))}
                    aria-label="Max price slider"
                    className="w-full mt-2"
                  />
                )}
              </div>

              {/* Hide Sold Out */}
              <div className="mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hideSoldOut}
                    onChange={(e) => filters.setHideSoldOut(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Hide sold out</span>
                </label>
              </div>

              {/* Extended Care Only */}
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.extendedCareOnly}
                    onChange={(e) => filters.setExtendedCareOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Extended care available</span>
                </label>
              </div>

              {/* Distance from Home */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Distance from Home
                </label>
                {hasHomeCoords ? (
                  <>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {[5, 10, 15, 25].map((distance) => (
                        <button
                          key={distance}
                          type="button"
                          onClick={() => filters.setMaxDistanceMiles(filters.maxDistanceMiles === distance ? undefined : distance)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                            filters.maxDistanceMiles === distance
                              ? 'bg-primary text-white border-primary'
                              : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          {distance} mi
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          id="discover-distance"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={50}
                          value={filters.maxDistanceMiles ?? ''}
                          onChange={(e) =>
                            filters.setMaxDistanceMiles(e.target.value ? parseInt(e.target.value) : undefined)
                          }
                          placeholder="Custom miles"
                          className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                        <span className="text-sm text-slate-500">mi</span>
                      </div>
                      {filters.maxDistanceMiles !== undefined && (
                        <input
                          type="range"
                          min={1}
                          max={50}
                          value={filters.maxDistanceMiles}
                          onChange={(e) => filters.setMaxDistanceMiles(parseInt(e.target.value))}
                          aria-label="Distance slider"
                          className="w-full"
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-md">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      <Link href="/settings" className="text-primary hover:underline">
                        Add your home address
                      </Link>{' '}
                      in Settings to filter by distance.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Sessions Grid */}
          <main id="main-content" className="flex-1">
            {/* Organization Filter Chips */}
            {allOrganizations && allOrganizations.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Filter by Organization ({allOrganizations.filter(org => (sessionCountsByOrg.get(org._id) || 0) > 0 || filters.selectedOrganizations.includes(org._id)).length})
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allOrganizations.filter(org => {
                    const sessionCount = sessionCountsByOrg.get(org._id) || 0;
                    // Show org if it has sessions OR if it's currently selected
                    return sessionCount > 0 || filters.selectedOrganizations.includes(org._id);
                  }).map((org) => {
                    const sessionCount = sessionCountsByOrg.get(org._id) || 0;
                    return (
                      <button
                        key={org._id}
                        onClick={() => filters.handleOrganizationToggle(org._id)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          filters.selectedOrganizations.includes(org._id)
                            ? 'bg-primary text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <OrgLogo url={org.logoUrl} name={org.name} size="xs" />
                        {org.name}
                        <span className={`text-xs ${
                          filters.selectedOrganizations.includes(org._id)
                            ? 'text-white/70'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {sessionCount}
                        </span>
                        {filters.selectedOrganizations.includes(org._id) && (
                          <span className="ml-1">✕</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Location Filter Chips - only show when organizations are selected */}
            {filters.selectedOrganizations.length > 0 && relevantLocations && relevantLocations.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                  Filter by Location
                </p>
                <div className="flex flex-wrap gap-2">
                  {relevantLocations.map((location) => (
                    <button
                      key={location._id}
                      onClick={() => filters.handleLocationToggle(location._id)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        filters.selectedLocations.includes(location._id)
                          ? 'bg-green-600 text-white'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <LocationIcon />
                      {location.name}
                      {filters.selectedLocations.includes(location._id) && (
                        <span className="ml-1">✕</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active Filters Summary */}
            {filters.hasActiveFilters && (
              <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Active Filters
                  </p>
                  <button
                    onClick={filters.clearFilters}
                    className="text-xs text-primary hover:text-primary-dark font-medium"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filters.startDateAfter && (
                    <FilterChip
                      label={`From: ${formatDateShort(filters.startDateAfter)}`}
                      onRemove={() => filters.setStartDateAfter('')}
                    />
                  )}
                  {filters.startDateBefore && (
                    <FilterChip
                      label={`To: ${formatDateShort(filters.startDateBefore)}`}
                      onRemove={() => filters.setStartDateBefore('')}
                    />
                  )}
                  {filters.childAge !== undefined && (
                    <FilterChip
                      label={`Age: ${filters.childAge}`}
                      onRemove={() => filters.setChildAge(undefined)}
                    />
                  )}
                  {filters.childGrade !== undefined && (
                    <FilterChip
                      label={`Grade: ${GRADE_LABELS[filters.childGrade] || `Grade ${filters.childGrade}`}`}
                      onRemove={() => filters.setChildGrade(undefined)}
                    />
                  )}
                  {filters.selectedCategories.map((cat) => (
                    <FilterChip
                      key={cat}
                      label={cat}
                      onRemove={() => filters.handleCategoryToggle(cat)}
                    />
                  ))}
                  {filters.maxPrice !== undefined && (
                    <FilterChip
                      label={`Max: $${filters.maxPrice}`}
                      onRemove={() => filters.setMaxPrice(undefined)}
                    />
                  )}
                  {!filters.hideSoldOut && (
                    <FilterChip
                      label="Showing sold out"
                      onRemove={() => filters.setHideSoldOut(true)}
                    />
                  )}
                  {filters.extendedCareOnly && (
                    <FilterChip
                      label="Extended care"
                      onRemove={() => filters.setExtendedCareOnly(false)}
                    />
                  )}
                  {filters.selectedOrganizations.map((orgId) => {
                    const org = allOrganizations?.find((o) => o._id === orgId);
                    return (
                      <FilterChip
                        key={orgId}
                        label={org?.name || 'Organization'}
                        onRemove={() => filters.handleOrganizationToggle(orgId)}
                      />
                    );
                  })}
                  {filters.selectedLocations.map((locId) => {
                    const loc = allLocations?.find((l) => l._id === locId);
                    return (
                      <FilterChip
                        key={locId}
                        label={loc?.name || 'Location'}
                        onRemove={() => filters.handleLocationToggle(locId)}
                      />
                    );
                  })}
                  {filters.maxDistanceMiles !== undefined && (
                    <FilterChip
                      label={`Within ${filters.maxDistanceMiles} mi`}
                      onRemove={() => filters.setMaxDistanceMiles(undefined)}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Results Summary & Sort */}
            <div ref={filters.resultsRef} className="mb-4 flex items-center justify-between scroll-mt-20">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {sessions === undefined ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin motion-reduce:animate-none" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Searching camps...</span>
                  </span>
                ) : totalSessionCount === 0 ? (
                  'No sessions found'
                ) : (
                  <span className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {hasMoreSessions ? `${filteredSessions.length} of ${totalSessionCount}` : totalSessionCount} session{totalSessionCount === 1 ? '' : 's'}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">•</span>
                    <span>{new Set(filteredSessions.map(s => s.campId)).size} camp{new Set(filteredSessions.map(s => s.campId)).size === 1 ? '' : 's'}</span>
                    <span className="text-slate-400 dark:text-slate-500">•</span>
                    <span>{new Set(filteredSessions.map(s => s.organizationId)).size} org{new Set(filteredSessions.map(s => s.organizationId)).size === 1 ? '' : 's'}</span>
                    {filteredSessions.length > 0 && (
                      <>
                        <span className="text-slate-400 dark:text-slate-500">•</span>
                        <span>
                          ${Math.round(Math.min(...filteredSessions.map(s => s.price)) / 100)}
                          {' - '}
                          ${Math.round(Math.max(...filteredSessions.map(s => s.price)) / 100)}
                        </span>
                        {(() => {
                          const available = filteredSessions.filter(s => s.capacity > s.enrolledCount).length;
                          const soldOut = filteredSessions.length - available;
                          if (soldOut > 0) {
                            return (
                              <>
                                <span className="text-slate-400 dark:text-slate-500">•</span>
                                <span className="text-green-600 dark:text-green-400">{available} available</span>
                                <span className="text-slate-300 dark:text-slate-600">/</span>
                                <span className="text-red-500 dark:text-red-400">{soldOut} sold out</span>
                              </>
                            );
                          }
                          return null;
                        })()}
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => filters.setShowRequestCampModal(true)}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary-light underline underline-offset-2"
                >
                  Can't find a camp?
                </button>
                <div className="flex items-center gap-2">
                  <label htmlFor="discover-sort" className="text-xs text-slate-500 dark:text-slate-400">Sort:</label>
                  <select
                    id="discover-sort"
                    value={filters.sortBy}
                    onChange={(e) => filters.setSortBy(e.target.value as 'date' | 'price-low' | 'price-high' | 'spots' | 'distance')}
                    className="text-sm px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    <option value="date">Start Date</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="spots">Most Spots Available</option>
                    {hasHomeCoords && <option value="distance">Distance</option>}
                  </select>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {sessions === undefined && (
              <div role="status" aria-live="polite" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden animate-pulse motion-reduce:animate-none"
                    aria-hidden="true"
                  >
                    {/* Image placeholder */}
                    <div className="h-40 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600" />
                    {/* Content placeholder */}
                    <div className="p-4 space-y-3">
                      {/* Camp name and org */}
                      <div className="space-y-2">
                        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                      </div>
                      {/* Details: date, time, price, ages */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-40"></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-28"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <span className="sr-only">Loading camp sessions...</span>
              </div>
            )}

            {/* Empty State */}
            {sessions !== undefined && filteredSessions.length === 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-12 text-center">
                <div className="text-6xl mb-4 animate-bounce motion-reduce:animate-none [animation-duration:2s]">
                  {filters.hasActiveFilters ? '🔍' : '🏕️'}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {filters.hasActiveFilters ? 'No camps match your filters' : 'No camps available yet'}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                  {filters.hasActiveFilters
                    ? 'Try removing some filters or broadening your date range to see more options.'
                    : 'Check back soon! Camp providers are adding new sessions regularly.'}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  {filters.hasActiveFilters && (
                    <>
                      <button
                        onClick={filters.clearFilters}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear all filters
                      </button>
                      {(filters.startDateAfter || filters.startDateBefore) && (
                        <button
                          onClick={() => {
                            filters.setStartDateAfter('');
                            filters.setStartDateBefore('');
                          }}
                          className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          Remove date filter
                        </button>
                      )}
                      {filters.childAge !== undefined && (
                        <button
                          onClick={() => filters.setChildAge(undefined)}
                          className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          Remove age filter
                        </button>
                      )}
                    </>
                  )}
                  {!filters.hasActiveFilters && (
                    <Link
                      href="/"
                      className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark"
                    >
                      Back to Planner
                    </Link>
                  )}
                </div>
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">
                    Know a camp that should be listed here?
                  </p>
                  <button
                    onClick={() => filters.setShowRequestCampModal(true)}
                    className="text-primary hover:text-primary-dark font-medium text-sm flex items-center gap-1 mx-auto"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Request a Camp
                  </button>
                </div>
              </div>
            )}

            {/* Sessions List or Map View */}
            {sessions !== undefined && filteredSessions.length > 0 && (
              filters.viewMode === 'map' ? (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
                  <MapWrapper
                    sessions={filteredSessions.map((session) => ({
                      _id: session._id,
                      startDate: session.startDate,
                      endDate: session.endDate,
                      price: session.price,
                      currency: session.currency,
                      spotsLeft: Math.max(0, session.capacity - session.enrolledCount),
                      distanceFromHome: (session as { distanceFromHome?: number }).distanceFromHome,
                      camp: {
                        name: session.campName ?? 'Camp',
                      },
                      organization: {
                        name: session.organizationName ?? 'Organization',
                      },
                      location: {
                        name: session.locationName ?? 'Location',
                        latitude: session.locationLatitude,
                        longitude: session.locationLongitude,
                      },
                    })) as MapSession[]}
                    centerLatitude={city.centerLatitude}
                    centerLongitude={city.centerLongitude}
                    homeLatitude={homeLatitude}
                    homeLongitude={homeLongitude}
                    height="600px"
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {displayedSessions.map((session) => (
                      <SessionCard
                        key={session._id}
                        session={session}
                        cityId={city._id}
                        isAdmin={isAdmin ?? false}
                        distanceFromHome={(session as { distanceFromHome?: number }).distanceFromHome}
                        preSelectedChildId={filters.selectedChildId}
                      />
                    ))}
                  </div>
                  {hasMoreSessions && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={() => setDisplayCount(prev => prev + SESSIONS_PER_PAGE)}
                        className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        Load more ({totalSessionCount - filteredSessions.length} remaining)
                      </button>
                    </div>
                  )}
                </>
              )
            )}
          </main>
        </div>
      </div>

      <BottomNav citySlug={citySlug} />

      {/* Back to Top Button */}
      <BackToTopButton />

      {/* Add Child Modal */}
      <AddChildModal
        isOpen={filters.showAddChildModal}
        onClose={() => filters.setShowAddChildModal(false)}
      />

      {/* Request Camp Modal */}
      <RequestCampModal
        isOpen={filters.showRequestCampModal}
        onClose={() => filters.setShowRequestCampModal(false)}
      />
    </div>
  );
}

function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.scrollY > 400);
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-24 right-4 p-3 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark transition-all duration-300 z-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      aria-label="Back to top"
      aria-hidden={!isVisible}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  );
}


function ShareSearchButton() {
  const [copied, setCopied] = useState(false);
  const market = useMarket();

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `Camp Search - ${market.tagline}`,
          text: 'Check out these camps I found!',
          url,
        });
        return;
      }
    } catch {
      // Fall through to clipboard
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleShare}
      className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1"
      title="Share this search"
    >
      {copied ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span>Share</span>
        </>
      )}
    </button>
  );
}
