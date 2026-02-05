/**
 * Utility functions for the camp marketplace
 */

/**
 * Calculate age from an ISO date string (YYYY-MM-DD)
 * @param birthdate - ISO date string in YYYY-MM-DD format
 * @returns Age in years
 */
export function calculateAge(birthdate: string): number {
  const today = new Date();
  const birth = new Date(birthdate);

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  // If birthday hasn't occurred yet this year, subtract 1
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

/**
 * Calculate grade level from age
 * Uses standard US grade level calculation where a child entering kindergarten
 * is typically 5 years old by a cutoff date (default September)
 *
 * @param age - Age in years
 * @param cutoffMonth - Month (0-11) used as cutoff for grade calculation (default: 8 for September)
 * @returns Grade level (K=0, 1st=1, Pre-K=-1, etc.)
 */
export function calculateGradeFromAge(age: number, cutoffMonth: number = 8): number {
  // Kindergarten age is typically 5
  // Grade = age - 5 for standard calculation
  // Pre-K would be age 4 (grade -1)
  // Kindergarten is age 5 (grade 0)
  // 1st grade is age 6 (grade 1)

  const grade = age - 5;
  return grade;
}

/**
 * Check if an age falls within a specified range
 * @param age - Age to check
 * @param range - Object with optional minAge and maxAge
 * @returns True if age is within range (inclusive)
 */
export function isAgeInRange(
  age: number,
  range: { minAge?: number; maxAge?: number }
): boolean {
  const { minAge, maxAge } = range;

  if (minAge !== undefined && age < minAge) {
    return false;
  }

  if (maxAge !== undefined && age > maxAge) {
    return false;
  }

  return true;
}

/**
 * Check if a grade falls within a specified range
 * @param grade - Grade level to check (K=0, 1st=1, Pre-K=-1)
 * @param range - Object with optional minGrade and maxGrade
 * @returns True if grade is within range (inclusive)
 */
export function isGradeInRange(
  grade: number,
  range: { minGrade?: number; maxGrade?: number }
): boolean {
  const { minGrade, maxGrade } = range;

  if (minGrade !== undefined && grade < minGrade) {
    return false;
  }

  if (maxGrade !== undefined && grade > maxGrade) {
    return false;
  }

  return true;
}

/**
 * Calculate distance between two coordinates using the Haversine formula
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const EARTH_RADIUS_MILES = 3958.8; // Earth's radius in miles

  // Convert degrees to radians
  const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = EARTH_RADIUS_MILES * c;

  return distance;
}

/**
 * Convert text to a URL-safe slug
 * @param text - Text to convert
 * @returns URL-safe slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word characters except spaces and hyphens
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading and trailing hyphens
}

/**
 * Format price from cents to display string
 * @param cents - Price in cents
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted price string (e.g., "$19.99")
 */
export function formatPrice(cents: number, currency: string = 'USD'): string {
  const dollars = cents / 100;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Represents a week in the summer planner
 */
export interface SummerWeek {
  weekNumber: number;
  startDate: string; // "2024-06-03" (Monday)
  endDate: string; // "2024-06-07" (Friday)
  monthName: string;
  label: string; // "Jun 3-7"
}

/**
 * Generate summer weeks (Mon-Fri) for a given date range.
 *
 * @param startDate ISO date string for start (finds first Monday on or after)
 * @param endDate ISO date string for end
 * @returns Array of summer weeks
 */
export function generateWeeksForRange(startDate: string, endDate: string): SummerWeek[] {
  const weeks: SummerWeek[] = [];

  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  // Find the first Monday on or after startDate
  let currentDate = new Date(start);
  const dayOfWeek = currentDate.getDay();
  if (dayOfWeek === 0) {
    // Sunday - move to next day (Monday)
    currentDate.setDate(currentDate.getDate() + 1);
  } else if (dayOfWeek > 1) {
    // Tuesday-Saturday - move to next Monday
    currentDate.setDate(currentDate.getDate() + (8 - dayOfWeek));
  }
  // If dayOfWeek === 1 (Monday), we're already on Monday

  let weekNumber = 1;

  while (currentDate <= end) {
    const monday = new Date(currentDate);
    const friday = new Date(currentDate);
    friday.setDate(friday.getDate() + 4);

    // Format dates as ISO strings
    const weekStartDate = formatISODate(monday);
    const weekEndDate = formatISODate(friday);

    // Get month name for the week's Monday
    const monthName = monday.toLocaleDateString('en-US', { month: 'long' });

    // Create label like "Jun 3-7"
    const monthShort = monday.toLocaleDateString('en-US', { month: 'short' });
    const label = `${monthShort} ${monday.getDate()}-${friday.getDate()}`;

    weeks.push({
      weekNumber,
      startDate: weekStartDate,
      endDate: weekEndDate,
      monthName,
      label,
    });

    // Move to next Monday
    currentDate.setDate(currentDate.getDate() + 7);
    weekNumber++;
  }

  return weeks;
}

/**
 * Generate all Mon-Fri weeks for June through August of a given year.
 * Each week starts on Monday and ends on Friday.
 *
 * @param year - The year to generate weeks for
 * @returns Array of summer weeks
 */
export function generateSummerWeeks(year: number): SummerWeek[] {
  const weeks: SummerWeek[] = [];

  // Start from first Monday in June
  const juneFirst = new Date(year, 5, 1); // June is month 5 (0-indexed)
  let currentDate = new Date(juneFirst);

  // Find the first Monday in June
  const dayOfWeek = currentDate.getDay();
  if (dayOfWeek === 0) {
    // Sunday - move to next day (Monday)
    currentDate.setDate(currentDate.getDate() + 1);
  } else if (dayOfWeek > 1) {
    // Tuesday-Saturday - move to next Monday
    currentDate.setDate(currentDate.getDate() + (8 - dayOfWeek));
  }
  // If dayOfWeek === 1 (Monday), we're already on Monday

  // End date is last day of August
  const augustLast = new Date(year, 8, 0); // Last day of August

  let weekNumber = 1;

  while (currentDate <= augustLast) {
    const monday = new Date(currentDate);
    const friday = new Date(currentDate);
    friday.setDate(friday.getDate() + 4);

    // Format dates as ISO strings
    const startDate = formatISODate(monday);
    const endDate = formatISODate(friday);

    // Get month name for the week's Monday
    const monthName = monday.toLocaleDateString('en-US', { month: 'long' });

    // Create label like "Jun 3-7"
    const monthShort = monday.toLocaleDateString('en-US', { month: 'short' });
    const label = `${monthShort} ${monday.getDate()}-${friday.getDate()}`;

    weeks.push({
      weekNumber,
      startDate,
      endDate,
      monthName,
      label,
    });

    // Move to next Monday
    currentDate.setDate(currentDate.getDate() + 7);
    weekNumber++;
  }

  return weeks;
}

/**
 * Format a Date as ISO date string (YYYY-MM-DD)
 */
function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if two date ranges overlap.
 * Ranges are inclusive on both ends.
 *
 * @param start1 - Start date of first range (YYYY-MM-DD)
 * @param end1 - End date of first range (YYYY-MM-DD)
 * @param start2 - Start date of second range (YYYY-MM-DD)
 * @param end2 - End date of second range (YYYY-MM-DD)
 * @returns True if the ranges overlap
 */
export function doDateRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  // Two ranges [s1, e1] and [s2, e2] overlap if:
  // s1 <= e2 AND s2 <= e1
  return start1 <= end2 && start2 <= end1;
}

/**
 * Calculate the number of weekdays (Mon-Fri) that overlap between two date ranges.
 *
 * @param rangeStart - Start of the range to check
 * @param rangeEnd - End of the range to check
 * @param weekStart - Start of the week (Monday)
 * @param weekEnd - End of the week (Friday)
 * @returns Number of overlapping weekdays (0-5)
 */
export function countOverlappingWeekdays(
  rangeStart: string,
  rangeEnd: string,
  weekStart: string,
  weekEnd: string
): number {
  if (!doDateRangesOverlap(rangeStart, rangeEnd, weekStart, weekEnd)) {
    return 0;
  }

  // Find the actual overlap dates
  const overlapStart = rangeStart > weekStart ? rangeStart : weekStart;
  const overlapEnd = rangeEnd < weekEnd ? rangeEnd : weekEnd;

  // Count weekdays in overlap
  let count = 0;
  const current = new Date(overlapStart + 'T00:00:00');
  const end = new Date(overlapEnd + 'T00:00:00');

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Monday=1, Tuesday=2, ..., Friday=5
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}
