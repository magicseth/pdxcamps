// Shared constants used across the frontend

// Default child colors matching app vibe - softer palette
export const DEFAULT_CHILD_COLORS = [
  '#5B9BD5', // Sky
  '#7CB887', // Sage
  '#E8927C', // Coral
  '#9B8DC5', // Lavender
  '#5DADE2', // Ocean
  '#D4A574', // Sand
  '#82C4C3', // Seafoam
  '#C9A0DC', // Orchid
] as const;

// Child color options with labels (for settings/pickers)
export const CHILD_COLOR_OPTIONS = [
  { value: '#5B9BD5', label: 'Sky' },
  { value: '#7CB887', label: 'Sage' },
  { value: '#E8927C', label: 'Coral' },
  { value: '#9B8DC5', label: 'Lavender' },
  { value: '#5DADE2', label: 'Ocean' },
  { value: '#D4A574', label: 'Sand' },
  { value: '#82C4C3', label: 'Seafoam' },
  { value: '#C9A0DC', label: 'Orchid' },
] as const;

// Categories for filtering camp sessions
export const CATEGORIES = [
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
] as const;

// Free tier saved camp limit (must match convex/lib/paywall.ts FREE_SAVED_CAMPS_LIMIT)
export const FREE_SAVED_CAMPS_LIMIT = 5;

// Grade mapping for display
export const GRADE_LABELS: Record<number, string> = {
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
