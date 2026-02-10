'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Id } from '../convex/_generated/dataModel';

export function useDiscoverFilters(citySlug: string, searchParams: URLSearchParams) {
  const router = useRouter();

  // Parse initial state from URL
  const getInitialState = useCallback(() => {
    return {
      startDateAfter: searchParams.get('from') || '',
      startDateBefore: searchParams.get('to') || '',
      selectedCategories: searchParams.get('categories')?.split(',').filter(Boolean) || [],
      maxPrice: searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!) : undefined,
      hideSoldOut: searchParams.get('hideSoldOut') !== 'false', // Default to true
      extendedCareOnly: searchParams.get('extendedCare') === 'true',
      childAge: searchParams.get('age') ? parseInt(searchParams.get('age')!) : undefined,
      childGrade: searchParams.get('grade') ? parseInt(searchParams.get('grade')!) : undefined,
      selectedOrganizations: searchParams.get('orgs')?.split(',').filter(Boolean) || [],
      selectedLocations: searchParams.get('locations')?.split(',').filter(Boolean) || [],
      maxDistanceMiles: searchParams.get('distance') ? parseInt(searchParams.get('distance')!) : undefined,
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
  const [selectedChildId, setSelectedChildId] = useState<Id<'children'> | null>(
    () => (searchParams.get('childId') as Id<'children'>) || null,
  );
  const [showFilters, setShowFilters] = useState(true);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [showRequestCampModal, setShowRequestCampModal] = useState(false);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>(
    () => getInitialState().selectedOrganizations,
  );
  const [selectedLocations, setSelectedLocations] = useState<string[]>(() => getInitialState().selectedLocations);
  const [maxDistanceMiles, setMaxDistanceMiles] = useState<number | undefined>(
    () => getInitialState().maxDistanceMiles,
  );
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState<'date' | 'price-low' | 'price-high' | 'spots' | 'distance'>('date');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

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
  }, [
    startDateAfter,
    startDateBefore,
    selectedCategories,
    maxPrice,
    hideSoldOut,
    extendedCareOnly,
    childAge,
    childGrade,
    selectedOrganizations,
    selectedLocations,
  ]);


  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (startDateAfter) params.set('from', startDateAfter);
    if (startDateBefore) params.set('to', startDateBefore);
    if (selectedCategories.length > 0) params.set('categories', selectedCategories.join(','));
    if (maxPrice !== undefined) params.set('maxPrice', maxPrice.toString());
    if (!hideSoldOut) params.set('hideSoldOut', 'false'); // Only add when explicitly false (true is default)
    if (extendedCareOnly) params.set('extendedCare', 'true');
    if (childAge !== undefined) params.set('age', childAge.toString());
    if (childGrade !== undefined) params.set('grade', childGrade.toString());
    if (selectedOrganizations.length > 0) params.set('orgs', selectedOrganizations.join(','));
    if (selectedLocations.length > 0) params.set('locations', selectedLocations.join(','));
    if (maxDistanceMiles !== undefined) params.set('distance', maxDistanceMiles.toString());

    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : '';

    // Only update if the URL actually changed
    if (window.location.search !== newUrl) {
      router.replace(`/discover/${citySlug}${newUrl}`, { scroll: false });
    }
  }, [
    searchQuery,
    startDateAfter,
    startDateBefore,
    selectedCategories,
    maxPrice,
    hideSoldOut,
    extendedCareOnly,
    childAge,
    childGrade,
    selectedOrganizations,
    selectedLocations,
    maxDistanceMiles,
    citySlug,
    router,
  ]);

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStartDateAfter('');
    setStartDateBefore('');
    setSelectedCategories([]);
    setMaxPrice(undefined);
    setHideSoldOut(true); // Reset to default (hide sold out)
    setChildAge(undefined);
    setChildGrade(undefined);
    setSelectedOrganizations([]);
    setSelectedLocations([]);
    setMaxDistanceMiles(undefined);
  };

  const hasActiveFilters =
    searchQuery ||
    startDateAfter ||
    startDateBefore ||
    selectedCategories.length > 0 ||
    maxPrice !== undefined ||
    !hideSoldOut || // Count when showing sold out (non-default)
    extendedCareOnly ||
    childAge !== undefined ||
    childGrade !== undefined ||
    selectedOrganizations.length > 0 ||
    selectedLocations.length > 0 ||
    maxDistanceMiles !== undefined;

  // Count active filters for the badge
  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (startDateAfter ? 1 : 0) +
    (startDateBefore ? 1 : 0) +
    selectedCategories.length +
    (maxPrice !== undefined ? 1 : 0) +
    (!hideSoldOut ? 1 : 0) + // Count when showing sold out (non-default)
    (extendedCareOnly ? 1 : 0) +
    (childAge !== undefined ? 1 : 0) +
    (childGrade !== undefined ? 1 : 0) +
    selectedOrganizations.length +
    selectedLocations.length +
    (maxDistanceMiles !== undefined ? 1 : 0);

  const handleOrganizationToggle = (orgId: string) => {
    setSelectedOrganizations((prev) => {
      const isRemoving = prev.includes(orgId);
      const newSelection = isRemoving ? prev.filter((id) => id !== orgId) : [...prev, orgId];
      // Clear location filters when all organizations are deselected
      if (newSelection.length === 0) {
        setSelectedLocations([]);
      }
      return newSelection;
    });
  };

  const handleLocationToggle = (locationId: string) => {
    setSelectedLocations((prev) =>
      prev.includes(locationId) ? prev.filter((id) => id !== locationId) : [...prev, locationId],
    );
  };

  return {
    // Filter values
    searchQuery,
    startDateAfter,
    startDateBefore,
    selectedCategories,
    maxPrice,
    hideSoldOut,
    extendedCareOnly,
    childAge,
    childGrade,
    selectedChildId,
    showFilters,
    showAddChildModal,
    showRequestCampModal,
    selectedOrganizations,
    selectedLocations,
    maxDistanceMiles,
    sortBy,
    viewMode,

    // Setters
    setSearchQuery,
    setStartDateAfter,
    setStartDateBefore,
    setSelectedCategories,
    setMaxPrice,
    setHideSoldOut,
    setExtendedCareOnly,
    setChildAge,
    setChildGrade,
    setSelectedChildId,
    setShowFilters,
    setShowAddChildModal,
    setShowRequestCampModal,
    setSelectedOrganizations,
    setSelectedLocations,
    setMaxDistanceMiles,
    setSortBy,
    setViewMode,

    // Derived state
    hasActiveFilters,
    activeFilterCount,

    // Handlers
    handleCategoryToggle,
    clearFilters,
    handleOrganizationToggle,
    handleLocationToggle,

    // Refs
    resultsRef,
  };
}
