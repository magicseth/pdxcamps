'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { OrgLogo } from '../../../components/shared/OrgLogo';
import { BottomNav } from '../../../components/shared/BottomNav';

// Categories for filtering
const CATEGORIES = [
  'Sports',
  'Arts',
  'STEM',
  'Nature',
  'Music',
  'Academic',
  'Drama',
  'Adventure',
  'Cooking',
  'Dance',
];

// Grade mapping for display
const GRADE_LABELS: Record<number, string> = {
  [-2]: 'Preschool',
  [-1]: 'Pre-K',
  [0]: 'Kindergarten',
  [1]: '1st Grade',
  [2]: '2nd Grade',
  [3]: '3rd Grade',
  [4]: '4th Grade',
  [5]: '5th Grade',
  [6]: '6th Grade',
  [7]: '7th Grade',
  [8]: '8th Grade',
  [9]: '9th Grade',
  [10]: '10th Grade',
  [11]: '11th Grade',
  [12]: '12th Grade',
};

export default function DiscoverPage() {
  const params = useParams();
  const citySlug = params.citySlug as string;
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse initial state from URL
  const getInitialState = useCallback(() => {
    return {
      startDateAfter: searchParams.get('from') || '',
      startDateBefore: searchParams.get('to') || '',
      selectedCategories: searchParams.get('categories')?.split(',').filter(Boolean) || [],
      maxPrice: searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!) : undefined,
      hideSoldOut: searchParams.get('hideSoldOut') === 'true',
      extendedCareOnly: searchParams.get('extendedCare') === 'true',
      childAge: searchParams.get('age') ? parseInt(searchParams.get('age')!) : undefined,
      childGrade: searchParams.get('grade') ? parseInt(searchParams.get('grade')!) : undefined,
      selectedOrganizations: searchParams.get('orgs')?.split(',').filter(Boolean) || [],
      selectedLocations: searchParams.get('locations')?.split(',').filter(Boolean) || [],
    };
  }, [searchParams]);

  // Filter state - initialized from URL
  const [startDateAfter, setStartDateAfter] = useState<string>(() => getInitialState().startDateAfter);
  const [startDateBefore, setStartDateBefore] = useState<string>(() => getInitialState().startDateBefore);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => getInitialState().selectedCategories);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(() => getInitialState().maxPrice);
  const [hideSoldOut, setHideSoldOut] = useState(() => getInitialState().hideSoldOut);
  const [extendedCareOnly, setExtendedCareOnly] = useState(() => getInitialState().extendedCareOnly);
  const [childAge, setChildAge] = useState<number | undefined>(() => getInitialState().childAge);
  const [childGrade, setChildGrade] = useState<number | undefined>(() => getInitialState().childGrade);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>(() => getInitialState().selectedOrganizations);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(() => getInitialState().selectedLocations);
  const [sortBy, setSortBy] = useState<'date' | 'price-low' | 'price-high' | 'spots'>('date');
  const [showAllOrgs, setShowAllOrgs] = useState(false);

  // Ref for results section and initial render tracking
  const resultsRef = useRef<HTMLDivElement>(null);
  const isInitialRender = useRef(true);

  // Scroll to results when filters change (but not on initial load)
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    // Only scroll on mobile/tablet where filters might overlap content
    if (window.innerWidth < 768 && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [startDateAfter, startDateBefore, selectedCategories, maxPrice, hideSoldOut, extendedCareOnly, childAge, childGrade, selectedOrganizations, selectedLocations]);

  // Keyboard shortcut: press 'f' to toggle filters (when not typing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input, textarea, or select
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setShowFilters((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (startDateAfter) params.set('from', startDateAfter);
    if (startDateBefore) params.set('to', startDateBefore);
    if (selectedCategories.length > 0) params.set('categories', selectedCategories.join(','));
    if (maxPrice !== undefined) params.set('maxPrice', maxPrice.toString());
    if (hideSoldOut) params.set('hideSoldOut', 'true');
    if (extendedCareOnly) params.set('extendedCare', 'true');
    if (childAge !== undefined) params.set('age', childAge.toString());
    if (childGrade !== undefined) params.set('grade', childGrade.toString());
    if (selectedOrganizations.length > 0) params.set('orgs', selectedOrganizations.join(','));
    if (selectedLocations.length > 0) params.set('locations', selectedLocations.join(','));

    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : '';

    // Only update if the URL actually changed
    if (window.location.search !== newUrl) {
      router.replace(`/discover/${citySlug}${newUrl}`, { scroll: false });
    }
  }, [startDateAfter, startDateBefore, selectedCategories, maxPrice, hideSoldOut, extendedCareOnly, childAge, childGrade, selectedOrganizations, selectedLocations, citySlug, router]);

  // Fetch city data
  const city = useQuery(api.cities.queries.getCityBySlug, { slug: citySlug });

  // Update document title
  useEffect(() => {
    const cityName = city?.name || 'Discover';
    document.title = `${cityName} Summer Camps | PDX Camps`;
    return () => {
      document.title = 'PDX Camps';
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

  // Fetch sessions with filters
  const sessions = useQuery(
    api.sessions.queries.searchSessions,
    city
      ? {
          cityId: city._id,
          startDateAfter: startDateAfter || undefined,
          startDateBefore: startDateBefore || undefined,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
          maxPrice: maxPrice !== undefined ? maxPrice * 100 : undefined, // Convert to cents
          excludeSoldOut: hideSoldOut || undefined,
          childAge: childAge,
          childGrade: childGrade,
          locationIds: selectedLocations.length > 0 ? selectedLocations as Id<'locations'>[] : undefined,
        }
      : 'skip'
  );

  // Filter and sort sessions by selected organizations (client-side)
  // This useMemo must be called before any early returns to maintain hooks order
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];

    // Filter by organizations
    let result = selectedOrganizations.length === 0
      ? [...sessions]
      : sessions.filter((s) => selectedOrganizations.includes(s.organizationId));

    // Filter by extended care
    if (extendedCareOnly) {
      result = result.filter((s) => s.extendedCareAvailable);
    }

    // Sort results
    result.sort((a, b) => {
      switch (sortBy) {
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
        default:
          return 0;
      }
    });

    return result;
  }, [sessions, selectedOrganizations, extendedCareOnly, sortBy]);

  // Count sessions per organization (from raw sessions, not filtered)
  const sessionCountsByOrg = useMemo(() => {
    if (!sessions) return new Map<string, number>();
    const counts = new Map<string, number>();
    sessions.forEach((s) => {
      counts.set(s.organizationId, (counts.get(s.organizationId) || 0) + 1);
    });
    return counts;
  }, [sessions]);

  // Loading state
  if (city === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-4"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-96 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
              ))}
            </div>
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
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const clearFilters = () => {
    setStartDateAfter('');
    setStartDateBefore('');
    setSelectedCategories([]);
    setMaxPrice(undefined);
    setHideSoldOut(false);
    setChildAge(undefined);
    setChildGrade(undefined);
    setSelectedOrganizations([]);
    setSelectedLocations([]);
  };

  const hasActiveFilters =
    startDateAfter ||
    startDateBefore ||
    selectedCategories.length > 0 ||
    maxPrice !== undefined ||
    hideSoldOut ||
    extendedCareOnly ||
    childAge !== undefined ||
    childGrade !== undefined ||
    selectedOrganizations.length > 0 ||
    selectedLocations.length > 0;

  // Count active filters for the badge
  const activeFilterCount =
    (startDateAfter ? 1 : 0) +
    (startDateBefore ? 1 : 0) +
    selectedCategories.length +
    (maxPrice !== undefined ? 1 : 0) +
    (hideSoldOut ? 1 : 0) +
    (extendedCareOnly ? 1 : 0) +
    (childAge !== undefined ? 1 : 0) +
    (childGrade !== undefined ? 1 : 0) +
    selectedOrganizations.length +
    selectedLocations.length;

  const handleOrganizationToggle = (orgId: string) => {
    setSelectedOrganizations((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  };

  const handleLocationToggle = (locationId: string) => {
    setSelectedLocations((prev) =>
      prev.includes(locationId) ? prev.filter((id) => id !== locationId) : [...prev, locationId]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm"
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
                {activeFilterCount > 0 && (
                  <span className="min-w-5 h-5 px-1 bg-blue-600 text-white text-xs font-medium rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <Link href="/settings" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" aria-label="Settings">
                <SettingsIcon />
              </Link>
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl">☀️</span>
                <span className="font-bold hidden sm:inline">PDX Camps</span>
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
              showFilters ? 'block' : 'hidden'
            } md:block w-full md:w-72 flex-shrink-0`}
          >
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  Filters
                  <kbd className="hidden lg:inline px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded text-[10px]" title="Press F to toggle filters">F</kbd>
                </h2>
                <div className="flex items-center gap-3">
                  {hasActiveFilters && (
                    <ShareSearchButton />
                  )}
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className={`text-sm text-blue-600 hover:text-blue-700 ${
                        activeFilterCount > 3 ? 'font-medium animate-pulse motion-reduce:animate-none' : ''
                      }`}
                    >
                      Clear all {activeFilterCount > 3 && `(${activeFilterCount})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Date Range */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Date Range
                </label>
                {/* Quick date presets */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <QuickDateButton
                    label="This Week"
                    onClick={() => {
                      const { start, end } = getThisWeekDates();
                      setStartDateAfter(start);
                      setStartDateBefore(end);
                    }}
                    isActive={isThisWeekSelected(startDateAfter, startDateBefore)}
                  />
                  <QuickDateButton
                    label="Next Week"
                    onClick={() => {
                      const { start, end } = getNextWeekDates();
                      setStartDateAfter(start);
                      setStartDateBefore(end);
                    }}
                    isActive={isNextWeekSelected(startDateAfter, startDateBefore)}
                  />
                  <QuickDateButton
                    label="June"
                    onClick={() => {
                      const year = new Date().getFullYear();
                      setStartDateAfter(`${year}-06-01`);
                      setStartDateBefore(`${year}-06-30`);
                    }}
                    isActive={startDateAfter.endsWith('-06-01') && startDateBefore.endsWith('-06-30')}
                  />
                  <QuickDateButton
                    label="July"
                    onClick={() => {
                      const year = new Date().getFullYear();
                      setStartDateAfter(`${year}-07-01`);
                      setStartDateBefore(`${year}-07-31`);
                    }}
                    isActive={startDateAfter.endsWith('-07-01') && startDateBefore.endsWith('-07-31')}
                  />
                  <QuickDateButton
                    label="August"
                    onClick={() => {
                      const year = new Date().getFullYear();
                      setStartDateAfter(`${year}-08-01`);
                      setStartDateBefore(`${year}-08-31`);
                    }}
                    isActive={startDateAfter.endsWith('-08-01') && startDateBefore.endsWith('-08-31')}
                  />
                  <QuickDateButton
                    label="All Summer"
                    onClick={() => {
                      const year = new Date().getFullYear();
                      setStartDateAfter(`${year}-06-01`);
                      setStartDateBefore(`${year}-08-31`);
                    }}
                    isActive={startDateAfter.endsWith('-06-01') && startDateBefore.endsWith('-08-31')}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 dark:text-slate-500 mb-1">
                    Today: {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">From</label>
                    <input
                      type="date"
                      value={startDateAfter}
                      onChange={(e) => setStartDateAfter(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">To</label>
                    <input
                      type="date"
                      value={startDateBefore}
                      onChange={(e) => setStartDateBefore(e.target.value)}
                      min={startDateAfter || new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Age/Grade */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Child Age or Grade
                </label>
                {/* Quick child filter buttons */}
                {myChildren && myChildren.length > 0 && (
                  <div className="mb-3">
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">My Kids</label>
                    <div className="flex flex-wrap gap-1.5">
                      {myChildren.map((child) => {
                        const age = getChildAge(child.birthdate);
                        const grade = child.currentGrade;
                        return (
                          <button
                            key={child._id}
                            type="button"
                            onClick={() => {
                              if (grade !== undefined) {
                                setChildGrade(grade);
                                setChildAge(undefined);
                              } else if (age !== null) {
                                setChildAge(age);
                                setChildGrade(undefined);
                              }
                            }}
                            className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                              (age !== null && childAge === age) || (grade !== undefined && childGrade === grade)
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {child.firstName} ({age}y)
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Age (years)</label>
                    <input
                      type="number"
                      min={3}
                      max={18}
                      value={childAge ?? ''}
                      onChange={(e) =>
                        setChildAge(e.target.value ? parseInt(e.target.value) : undefined)
                      }
                      placeholder="e.g., 8"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="text-center text-xs text-slate-400">or</div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Grade</label>
                    <select
                      value={childGrade ?? ''}
                      onChange={(e) =>
                        setChildGrade(e.target.value ? parseInt(e.target.value) : undefined)
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
                </div>
              </div>

              {/* Categories */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Categories
                </label>
                <div className="space-y-2">
                  {CATEGORIES.map((category) => (
                    <label key={category} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category)}
                        onChange={() => handleCategoryToggle(category)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{category}</span>
                    </label>
                  ))}
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
                      onClick={() => setMaxPrice(maxPrice === price ? undefined : price)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                        maxPrice === price
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      Under ${price}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">$</span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={maxPrice ?? ''}
                    onChange={(e) =>
                      setMaxPrice(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    placeholder="Custom amount"
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                {maxPrice !== undefined && (
                  <input
                    type="range"
                    min={0}
                    max={2000}
                    step={50}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                    className="w-full mt-2"
                  />
                )}
              </div>

              {/* Hide Sold Out */}
              <div className="mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideSoldOut}
                    onChange={(e) => setHideSoldOut(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Hide sold out</span>
                </label>
              </div>

              {/* Extended Care Only */}
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extendedCareOnly}
                    onChange={(e) => setExtendedCareOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Extended care available</span>
                </label>
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
                    Filter by Organization
                  </p>
                  {allOrganizations.length > 6 && (
                    <button
                      onClick={() => setShowAllOrgs(!showAllOrgs)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {showAllOrgs ? 'Show less' : `Show all ${allOrganizations.length}`}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(showAllOrgs ? allOrganizations : allOrganizations.slice(0, 6)).map((org) => {
                    const sessionCount = sessionCountsByOrg.get(org._id) || 0;
                    return (
                      <button
                        key={org._id}
                        onClick={() => handleOrganizationToggle(org._id)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          selectedOrganizations.includes(org._id)
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <OrgLogo url={org.logoUrl} name={org.name} size="xs" />
                        {org.name}
                        <span className={`text-xs ${
                          selectedOrganizations.includes(org._id)
                            ? 'text-blue-200'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {sessionCount}
                        </span>
                        {selectedOrganizations.includes(org._id) && (
                          <span className="ml-1">✕</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Location Filter Chips */}
            {allLocations && allLocations.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                  Filter by Location
                </p>
                <div className="flex flex-wrap gap-2">
                  {allLocations.map((location) => (
                    <button
                      key={location._id}
                      onClick={() => handleLocationToggle(location._id)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selectedLocations.includes(location._id)
                          ? 'bg-green-600 text-white'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <LocationIcon />
                      {location.name}
                      {selectedLocations.includes(location._id) && (
                        <span className="ml-1">✕</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active Filters Summary */}
            {hasActiveFilters && (
              <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Active Filters
                  </p>
                  <button
                    onClick={clearFilters}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {startDateAfter && (
                    <FilterChip
                      label={`From: ${formatDateShort(startDateAfter)}`}
                      onRemove={() => setStartDateAfter('')}
                    />
                  )}
                  {startDateBefore && (
                    <FilterChip
                      label={`To: ${formatDateShort(startDateBefore)}`}
                      onRemove={() => setStartDateBefore('')}
                    />
                  )}
                  {childAge !== undefined && (
                    <FilterChip
                      label={`Age: ${childAge}`}
                      onRemove={() => setChildAge(undefined)}
                    />
                  )}
                  {childGrade !== undefined && (
                    <FilterChip
                      label={`Grade: ${GRADE_LABELS[childGrade] || `Grade ${childGrade}`}`}
                      onRemove={() => setChildGrade(undefined)}
                    />
                  )}
                  {selectedCategories.map((cat) => (
                    <FilterChip
                      key={cat}
                      label={cat}
                      onRemove={() => handleCategoryToggle(cat)}
                    />
                  ))}
                  {maxPrice !== undefined && (
                    <FilterChip
                      label={`Max: $${maxPrice}`}
                      onRemove={() => setMaxPrice(undefined)}
                    />
                  )}
                  {hideSoldOut && (
                    <FilterChip
                      label="Hide sold out"
                      onRemove={() => setHideSoldOut(false)}
                    />
                  )}
                  {extendedCareOnly && (
                    <FilterChip
                      label="Extended care"
                      onRemove={() => setExtendedCareOnly(false)}
                    />
                  )}
                  {selectedOrganizations.map((orgId) => {
                    const org = allOrganizations?.find((o) => o._id === orgId);
                    return (
                      <FilterChip
                        key={orgId}
                        label={org?.name || 'Organization'}
                        onRemove={() => handleOrganizationToggle(orgId)}
                      />
                    );
                  })}
                  {selectedLocations.map((locId) => {
                    const loc = allLocations?.find((l) => l._id === locId);
                    return (
                      <FilterChip
                        key={locId}
                        label={loc?.name || 'Location'}
                        onRemove={() => handleLocationToggle(locId)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Results Summary & Sort */}
            <div ref={resultsRef} className="mb-4 flex items-center justify-between scroll-mt-20">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {sessions === undefined ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Searching camps...</span>
                  </span>
                ) : filteredSessions.length === 0 ? (
                  'No sessions found'
                ) : (
                  <span className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium text-slate-900 dark:text-white">{filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'}</span>
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
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">Sort:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'price-low' | 'price-high' | 'spots')}
                  className="text-sm px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  <option value="date">Start Date</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="spots">Most Spots Available</option>
                </select>
              </div>
            </div>

            {/* Loading State */}
            {sessions === undefined && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden animate-pulse"
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
              </div>
            )}

            {/* Empty State */}
            {sessions !== undefined && filteredSessions.length === 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-12 text-center">
                <div className="text-6xl mb-4 animate-bounce motion-reduce:animate-none [animation-duration:2s]">
                  {hasActiveFilters ? '🔍' : '🏕️'}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {hasActiveFilters ? 'No camps match your filters' : 'No camps available yet'}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                  {hasActiveFilters
                    ? 'Try removing some filters or broadening your date range to see more options.'
                    : 'Check back soon! Camp providers are adding new sessions regularly.'}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  {hasActiveFilters && (
                    <>
                      <button
                        onClick={clearFilters}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear all filters
                      </button>
                      {(startDateAfter || startDateBefore) && (
                        <button
                          onClick={() => {
                            setStartDateAfter('');
                            setStartDateBefore('');
                          }}
                          className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          Remove date filter
                        </button>
                      )}
                      {childAge !== undefined && (
                        <button
                          onClick={() => setChildAge(undefined)}
                          className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          Remove age filter
                        </button>
                      )}
                    </>
                  )}
                  {!hasActiveFilters && (
                    <Link
                      href="/"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                    >
                      Back to Planner
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Sessions List */}
            {sessions !== undefined && filteredSessions.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredSessions.map((session) => (
                  <SessionCard key={session._id} session={session} cityId={city._id} isAdmin={isAdmin ?? false} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <BottomNav citySlug={citySlug} />

      {/* Back to Top Button */}
      <BackToTopButton />
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
      className={`fixed bottom-24 right-4 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 z-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      aria-label="Back to top"
      aria-hidden={!isVisible}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  );
}

// Session Card Component
function SessionCard({
  session,
  cityId,
  isAdmin,
}: {
  session: {
    _id: Id<'sessions'>;
    campId: Id<'camps'>;
    locationId: Id<'locations'>;
    organizationId: Id<'organizations'>;
    startDate: string;
    endDate: string;
    dropOffTime: { hour: number; minute: number };
    pickUpTime: { hour: number; minute: number };
    extendedCareAvailable: boolean;
    price: number;
    currency: string;
    capacity: number;
    enrolledCount: number;
    waitlistEnabled: boolean;
    waitlistCount: number;
    status: 'draft' | 'active' | 'sold_out' | 'cancelled' | 'completed';
    externalRegistrationUrl?: string;
    ageRequirements: {
      minAge?: number;
      maxAge?: number;
      minGrade?: number;
      maxGrade?: number;
    };
  };
  cityId: Id<'cities'>;
  isAdmin?: boolean;
}) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const generateImage = useAction(api.scraping.generateImages.generateCampImage);

  // Fetch related data
  const camp = useQuery(api.camps.queries.getCamp, { campId: session.campId });
  const organization = useQuery(api.organizations.queries.getOrganization, {
    organizationId: session.organizationId,
  });
  const location = useQuery(api.locations.queries.getLocation, {
    locationId: session.locationId,
  });

  // Format dates with day of week
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const startDay = dayNames[startDate.getDay()];
    const endDay = dayNames[endDate.getDay()];

    if (start === end) {
      return `${startDay}, ${startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
    }

    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    if (startYear === endYear) {
      // Show days only if they're weekdays (Mon-Fri typical camp week)
      return `${startDay} ${startDate.toLocaleDateString('en-US', options)} - ${endDay} ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
    }

    return `${startDay} ${startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })} - ${endDay} ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
  };

  // Format price
  const formatPrice = (cents: number, currency: string) => {
    const amount = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate camp days (weekdays only)
  const getCampDays = (startDateStr: string, endDateStr: string): number => {
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');
    let days = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      // Count weekdays only (Mon-Fri)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days++;
      }
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  // Format duration nicely
  const formatDuration = (days: number): string => {
    if (days === 1) return '1 day';
    if (days <= 5) return `${days} days`;
    const weeks = Math.round(days / 5);
    if (weeks === 1) return '1 week';
    return `${weeks} weeks`;
  };

  // Get summer week number(s) for a session
  const getSummerWeeks = (startDateStr: string, endDateStr: string): string | null => {
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T00:00:00');
    const year = startDate.getFullYear();

    // Find first Monday of June
    const june1 = new Date(year, 5, 1);
    const dayOfWeek = june1.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    const summerStart = new Date(year, 5, 1 + daysUntilMonday);

    // Check if dates are within summer (June-August)
    if (startDate.getMonth() < 5 || startDate.getMonth() > 7) return null;

    // Calculate week numbers
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const startWeek = Math.floor((startDate.getTime() - summerStart.getTime()) / msPerWeek) + 1;
    const endWeek = Math.floor((endDate.getTime() - summerStart.getTime()) / msPerWeek) + 1;

    if (startWeek < 1 || startWeek > 13) return null;

    if (startWeek === endWeek) {
      return `Week ${startWeek}`;
    }
    return `Weeks ${startWeek}-${Math.min(endWeek, 13)}`;
  };

  // Format time (12-hour format)
  const formatTime = (time: { hour: number; minute: number }): string => {
    const hour12 = time.hour % 12 || 12;
    const ampm = time.hour < 12 ? 'am' : 'pm';
    if (time.minute === 0) {
      return `${hour12}${ampm}`;
    }
    return `${hour12}:${time.minute.toString().padStart(2, '0')}${ampm}`;
  };

  // Calculate session duration and return half-day/full-day label
  const getDayTypeLabel = (
    dropOff: { hour: number; minute: number },
    pickUp: { hour: number; minute: number }
  ): { label: string; isHalfDay: boolean } => {
    const dropOffMinutes = dropOff.hour * 60 + dropOff.minute;
    const pickUpMinutes = pickUp.hour * 60 + pickUp.minute;
    const durationHours = (pickUpMinutes - dropOffMinutes) / 60;
    const hours = Math.round(durationHours);
    // Half-day is typically less than 5 hours
    if (durationHours < 5) {
      return { label: `${hours}h`, isHalfDay: true };
    }
    return { label: `${hours}h`, isHalfDay: false };
  };

  // Format age range
  const formatAgeRange = (requirements: typeof session.ageRequirements) => {
    const parts: string[] = [];

    if (requirements.minAge !== undefined || requirements.maxAge !== undefined) {
      if (requirements.minAge !== undefined && requirements.maxAge !== undefined) {
        parts.push(`Ages ${requirements.minAge}-${requirements.maxAge}`);
      } else if (requirements.minAge !== undefined) {
        parts.push(`Ages ${requirements.minAge}+`);
      } else if (requirements.maxAge !== undefined) {
        parts.push(`Ages up to ${requirements.maxAge}`);
      }
    }

    if (requirements.minGrade !== undefined || requirements.maxGrade !== undefined) {
      const gradeLabel = (grade: number) => {
        if (grade === -1) return 'Pre-K';
        if (grade === 0) return 'K';
        return `${grade}`;
      };

      if (requirements.minGrade !== undefined && requirements.maxGrade !== undefined) {
        parts.push(`Grades ${gradeLabel(requirements.minGrade)}-${gradeLabel(requirements.maxGrade)}`);
      } else if (requirements.minGrade !== undefined) {
        parts.push(`Grades ${gradeLabel(requirements.minGrade)}+`);
      } else if (requirements.maxGrade !== undefined) {
        parts.push(`Grades up to ${gradeLabel(requirements.maxGrade)}`);
      }
    }

    return parts.join(' / ') || 'All ages';
  };

  // Get status info
  const getStatusBadge = () => {
    if (session.status === 'sold_out' || session.enrolledCount >= session.capacity) {
      if (session.waitlistEnabled) {
        return {
          label: `Waitlist (${session.waitlistCount})`,
          className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
          urgent: false,
        };
      }
      return {
        label: 'Sold Out',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        urgent: false,
      };
    }

    const spotsLeft = session.capacity - session.enrolledCount;

    // Very low availability (1-2 spots)
    if (spotsLeft <= 2) {
      return {
        label: `Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left!`,
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        urgent: true,
      };
    }

    // Low availability (3-5 spots)
    if (spotsLeft <= 5) {
      return {
        label: `${spotsLeft} spots left`,
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        urgent: false,
      };
    }

    // Good availability (6-10 spots)
    if (spotsLeft <= 10) {
      return {
        label: `${spotsLeft} spots`,
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        urgent: false,
      };
    }

    // Plenty available
    return {
      label: 'Available',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      urgent: false,
    };
  };

  const statusBadge = getStatusBadge();

  // Get timing badge for sessions starting soon
  const getTimingBadge = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(session.startDate + 'T00:00:00');
    const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilStart < 0) return null; // Already started
    if (daysUntilStart === 0) {
      return { label: 'Starts today!', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', urgent: true };
    }
    if (daysUntilStart <= 3) {
      return { label: `Starts in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}`, className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', urgent: true };
    }
    if (daysUntilStart <= 14) {
      return { label: 'Starting soon', className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200', urgent: false };
    }
    return null;
  };

  const timingBadge = getTimingBadge();

  // Calculate spots left
  const spotsLeft = session.capacity - session.enrolledCount;
  const isSoldOut = session.status === 'sold_out' || spotsLeft <= 0;

  // Check if popular (75%+ enrolled but not sold out)
  const enrollmentPercent = session.enrolledCount / session.capacity;
  const isPopular = !isSoldOut && enrollmentPercent >= 0.75 && spotsLeft > 2;

  // Check if budget-friendly (under $200)
  const isBudgetFriendly = session.price < 20000; // 200 dollars in cents

  // Get camp image URL (from Convex storage or fallback)
  const campImageUrl = camp?.resolvedImageUrls?.[0] || null;

  // Category-based colors for placeholder
  const getCategoryStyle = (categories: string[] | undefined) => {
    const category = categories?.[0]?.toLowerCase() || '';
    const styles: Record<string, { bg: string; icon: string }> = {
      sports: { bg: 'from-green-500 to-emerald-600', icon: '⚽' },
      arts: { bg: 'from-purple-500 to-pink-600', icon: '🎨' },
      stem: { bg: 'from-blue-500 to-cyan-600', icon: '🔬' },
      technology: { bg: 'from-blue-500 to-indigo-600', icon: '💻' },
      nature: { bg: 'from-green-600 to-teal-600', icon: '🌲' },
      music: { bg: 'from-pink-500 to-rose-600', icon: '🎵' },
      academic: { bg: 'from-amber-500 to-orange-600', icon: '📚' },
      drama: { bg: 'from-red-500 to-pink-600', icon: '🎭' },
      adventure: { bg: 'from-orange-500 to-red-600', icon: '🏕️' },
      cooking: { bg: 'from-yellow-500 to-orange-500', icon: '👨‍🍳' },
      dance: { bg: 'from-fuchsia-500 to-purple-600', icon: '💃' },
    };
    return styles[category] || { bg: 'from-slate-500 to-slate-600', icon: '🏕️' };
  };

  const categoryStyle = getCategoryStyle(camp?.categories);

  // Urgency indicator class based on spots left
  const getUrgencyClass = () => {
    if (isSoldOut) return '';
    if (spotsLeft <= 2) return 'ring-2 ring-red-400 dark:ring-red-500';
    if (spotsLeft <= 5) return 'ring-2 ring-orange-400 dark:ring-orange-500';
    return '';
  };

  return (
    <>
      <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden transition-all duration-200 ${
        isSoldOut
          ? 'opacity-60 grayscale-[30%]'
          : 'hover:shadow-lg hover:-translate-y-0.5'
      } ${getUrgencyClass()}`}>
        {/* Camp Image or Category Placeholder */}
        <div className="relative h-32 overflow-hidden group">
          {campImageUrl ? (
            <>
              {/* Shimmer background shows through while image loads */}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-pulse" />
              <img
                src={campImageUrl}
                alt={camp?.name || 'Camp'}
                className="relative w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  // On error, hide image and show placeholder
                  e.currentTarget.style.display = 'none';
                }}
              />
              {/* Admin: Regenerate Button (shows on hover) */}
              {isAdmin && camp && (
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsGenerating(true);
                    setGenerateError(null);
                    try {
                      const result = await generateImage({ campId: camp._id });
                      if (!result.success) {
                        setGenerateError(result.error || 'Failed to generate image');
                      }
                    } catch (err) {
                      setGenerateError(err instanceof Error ? err.message : 'Unknown error');
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                  disabled={isGenerating}
                  className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded shadow hover:bg-black/90 disabled:opacity-50 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Regenerate AI image for this camp"
                >
                  {isGenerating ? (
                    <>
                      <SpinnerIcon />
                      Generating...
                    </>
                  ) : (
                    <>
                      <SparklesIcon />
                      Regenerate
                    </>
                  )}
                </button>
              )}
            </>
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${categoryStyle.bg} flex items-center justify-center`}>
              <span className="text-4xl opacity-50">{categoryStyle.icon}</span>
              {/* Admin: Generate Image Button */}
              {isAdmin && camp && (
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsGenerating(true);
                    setGenerateError(null);
                    try {
                      const result = await generateImage({ campId: camp._id });
                      if (!result.success) {
                        setGenerateError(result.error || 'Failed to generate image');
                      }
                    } catch (err) {
                      setGenerateError(err instanceof Error ? err.message : 'Unknown error');
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                  disabled={isGenerating}
                  className="absolute bottom-2 right-2 px-2 py-1 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 text-xs font-medium rounded shadow hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1"
                  title="Generate AI image for this camp"
                >
                  {isGenerating ? (
                    <>
                      <SpinnerIcon />
                      Generating...
                    </>
                  ) : (
                    <>
                      <SparklesIcon />
                      Generate
                    </>
                  )}
                </button>
              )}
            </div>
          )}
          {generateError && (
            <div className="absolute bottom-2 left-2 right-14 px-2 py-1 bg-red-500/90 text-white text-xs rounded truncate">
              {generateError}
            </div>
          )}
          {/* Gradient overlay for badge readability */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />
          {/* Status badges overlay */}
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.className} ${statusBadge.urgent ? 'animate-pulse motion-reduce:animate-none' : ''}`}
            >
              {statusBadge.label}
            </span>
            {timingBadge && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${timingBadge.className} ${timingBadge.urgent ? 'animate-pulse motion-reduce:animate-none' : ''}`}
              >
                {timingBadge.label}
              </span>
            )}
            {isPopular && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200">
                🔥 Popular
              </span>
            )}
            {isBudgetFriendly && !isSoldOut && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                💰 Budget-friendly
              </span>
            )}
          </div>
          {/* Organization logo overlay */}
          {organization?.logoUrl && (
            <div className="absolute bottom-2 left-2 w-10 h-10 rounded-lg bg-white dark:bg-slate-800 shadow-md flex items-center justify-center overflow-hidden">
              <OrgLogo url={organization.logoUrl} name={organization.name} size="md" />
            </div>
          )}
        </div>

        <div className="p-4">
          {/* Header */}
          <div className="mb-3">
            <Link
              href={`/session/${session._id}`}
              className="text-lg font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline line-clamp-1"
            >
              {camp?.name ?? 'Loading...'}
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">
              <span className="text-slate-400 dark:text-slate-500">by </span>
              {organization?.name ?? 'Loading...'}
            </p>
            {camp?.categories && camp.categories.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {camp.categories.slice(0, 3).map((cat) => {
                  const icons: Record<string, string> = {
                    sports: '⚽',
                    arts: '🎨',
                    stem: '🔬',
                    nature: '🌲',
                    music: '🎵',
                    academic: '📚',
                    drama: '🎭',
                    adventure: '🏔️',
                    cooking: '🍳',
                    dance: '💃',
                  };
                  const icon = icons[cat.toLowerCase()] || '';
                  return (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    >
                      {icon && <span className="text-[10px]">{icon}</span>}
                      {cat}
                    </span>
                  );
                })}
              </div>
            )}
            {camp?.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-2">
                {camp.description}
              </p>
            )}
          </div>

        {/* Spots Left Bar */}
        {!isSoldOut && (
          <div
            className="mb-4 cursor-help"
            title={`${spotsLeft <= 3 ? 'Very limited spots - register soon!' : spotsLeft <= 5 ? 'Limited spots remaining' : 'Good availability'}`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-600 dark:text-slate-400">
                {spotsLeft} of {session.capacity} spots left
              </span>
              <span className="text-slate-500 dark:text-slate-500">
                {Math.round((session.enrolledCount / session.capacity) * 100)}% full
              </span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  spotsLeft <= 3
                    ? 'bg-red-500'
                    : spotsLeft <= 5
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${(session.enrolledCount / session.capacity) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <CalendarIcon />
            <span>
              {formatDateRange(session.startDate, session.endDate)}
              <span className="text-slate-500 dark:text-slate-500 ml-1">
                ({formatDuration(getCampDays(session.startDate, session.endDate))})
              </span>
              {(() => {
                const weekLabel = getSummerWeeks(session.startDate, session.endDate);
                if (!weekLabel) return null;
                return (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {weekLabel}
                  </span>
                );
              })()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <ClockIcon />
            <span>
              {formatTime(session.dropOffTime)} - {formatTime(session.pickUpTime)}
              {(() => {
                const dayType = getDayTypeLabel(session.dropOffTime, session.pickUpTime);
                return (
                  <span
                    className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      dayType.isHalfDay
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}
                  >
                    {dayType.label}
                  </span>
                );
              })()}
              {session.extendedCareAvailable && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  +Extended care
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <DollarIcon />
            <span>
              {formatPrice(session.price, session.currency)}
              {(() => {
                const days = getCampDays(session.startDate, session.endDate);
                if (days > 1) {
                  const perDay = Math.round(session.price / days);
                  return (
                    <span className="text-slate-500 dark:text-slate-500 ml-1">
                      ({formatPrice(perDay, session.currency)}/day)
                    </span>
                  );
                }
                return null;
              })()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <UsersIcon />
            <span>{formatAgeRange(session.ageRequirements)}</span>
          </div>
          {location && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <LocationIcon />
              <span className="line-clamp-1 flex-1">
                {location.name}
                {location.address?.city && ` - ${location.address.city}`}
              </span>
              {location.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${location.address.street}, ${location.address.city}, ${location.address.state} ${location.address.zip}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  title="View on map"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MapPinIcon />
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {session.externalRegistrationUrl ? (
            <>
              <a
                href={session.externalRegistrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2 bg-green-600 text-white text-center text-sm font-medium rounded-md hover:bg-green-700 flex items-center justify-center gap-1"
              >
                Register
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
              <Link
                href={`/session/${session._id}`}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                title="View details"
              >
                <InfoIcon />
              </Link>
            </>
          ) : (
            <Link
              href={`/session/${session._id}`}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-center text-sm font-medium rounded-md hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              View Details
            </Link>
          )}
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            title="Save for later"
            aria-label="Save for later"
          >
            <HeartIcon />
          </button>
        </div>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <SaveSessionModal
          sessionId={session._id}
          campName={camp?.name ?? 'Camp'}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </>
  );
}

// Save Session Modal
function SaveSessionModal({
  sessionId,
  campName,
  onClose,
}: {
  sessionId: Id<'sessions'>;
  campName: string;
  onClose: () => void;
}) {
  const [selectedChildId, setSelectedChildId] = useState<Id<'children'> | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const children = useQuery(api.children.queries.listChildren);
  const markInterested = useMutation(api.registrations.mutations.markInterested);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !success) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, success]);

  const handleSave = async () => {
    if (!selectedChildId) {
      setError('Please select a child');
      return;
    }

    try {
      setError(null);
      setIsSaving(true);
      await markInterested({
        childId: selectedChildId,
        sessionId,
        notes: notes || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save session');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !success) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Save {campName}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <CloseIcon />
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <svg
                className="w-16 h-16 text-pink-500 animate-bounce"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-pink-500/20 animate-ping" />
              </div>
            </div>
            <p className="text-lg font-medium text-slate-900 dark:text-white">Saved!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              This session has been added to your list.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
                {error}
              </div>
            )}

            {children === undefined ? (
              <div className="py-8 text-center text-slate-500">Loading children...</div>
            ) : children.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  You need to add a child to your family first.
                </p>
                <Link
                  href="/onboarding"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Add a child
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select Child
                  </label>
                  <div className="space-y-2">
                    {children.map((child) => (
                      <label
                        key={child._id}
                        className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer ${
                          selectedChildId === child._id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="child"
                          value={child._id}
                          checked={selectedChildId === child._id}
                          onChange={() => setSelectedChildId(child._id)}
                          className="sr-only"
                        />
                        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 font-medium">
                          {child.firstName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {child.firstName} {child.lastName}
                          </p>
                          {child.birthdate && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {calculateDisplayAge(child.birthdate)}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Check carpool options, ask about early drop-off..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Helper function
function getChildAge(birthdate: string): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function calculateDisplayAge(birthdate: string): string {
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age} years old`;
}

// Date helpers for quick filters
function getThisWeekDates() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - dayOfWeek + 1); // Monday
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Sunday
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function getNextWeekDates() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - dayOfWeek + 8); // Next Monday
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Next Sunday
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function isThisWeekSelected(startDate: string, endDate: string): boolean {
  const { start, end } = getThisWeekDates();
  return startDate === start && endDate === end;
}

function isNextWeekSelected(startDate: string, endDate: string): boolean {
  const { start, end } = getNextWeekDates();
  return startDate === start && endDate === end;
}

// Quick date filter button component
function QuickDateButton({
  label,
  onClick,
  isActive,
}: {
  label: string;
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
      }`}
    >
      {label}
    </button>
  );
}

// Filter chip component for active filters display
function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium transition-transform hover:scale-105">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
        title="Remove filter"
        aria-label={`Remove ${label} filter`}
      >
        ×
      </button>
    </span>
  );
}

// Format date for display in filter chips
function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Icons
function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
      />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
      />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function ShareSearchButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'Camp Search - PDX Camps',
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
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span>Share</span>
        </>
      )}
    </button>
  );
}
