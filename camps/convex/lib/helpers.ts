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
