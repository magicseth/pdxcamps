/**
 * Session Validation
 *
 * Validates scraped sessions and determines completeness.
 * Sessions must have required fields to be marked "active".
 */

import { ScrapedSession } from "./scrapers/types";

// Required fields for a session to be marked "active"
export const REQUIRED_FIELDS = [
  "startDate",
  "endDate",
  "dropOffTime",
  "pickUpTime",
  "location",
  "ageRequirements",
  "price",
] as const;

export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export interface ValidationError {
  field: string;
  error: string;
  attemptedValue?: string;
}

export interface ValidationResult {
  isComplete: boolean;
  completenessScore: number;
  missingFields: string[];
  errors: ValidationError[];
  normalizedData: NormalizedSession;
}

export interface NormalizedSession {
  name: string;
  description?: string;
  category?: string;

  // Dates
  startDate?: string;
  endDate?: string;
  dateRaw?: string;

  // Times
  dropOffHour?: number;
  dropOffMinute?: number;
  pickUpHour?: number;
  pickUpMinute?: number;
  timeRaw?: string;

  // Price
  priceInCents?: number;
  priceRaw?: string;

  // Age
  minAge?: number;
  maxAge?: number;
  minGrade?: number;
  maxGrade?: number;
  ageGradeRaw?: string;

  // Location
  location?: string;

  // Registration
  registrationUrl?: string;

  // Images
  imageUrls?: string[];

  // Availability
  isAvailable?: boolean;
  capacity?: number;
  enrolledCount?: number;
  spotsLeft?: number;

  // Source tracking
  sourceProductId?: string;
  sourceSessionId?: string;
}

/**
 * Validate a scraped session and calculate completeness
 */
export function validateSession(session: ScrapedSession): ValidationResult {
  const missing: string[] = [];
  const errors: ValidationError[] = [];

  // Helper to check for placeholder values
  const isPlaceholder = (value: string | undefined): boolean => {
    if (!value) return false;
    const placeholders = ["<UNKNOWN>", "UNKNOWN", "TBD", "N/A", "null", "undefined"];
    return placeholders.some(p => value.toUpperCase().includes(p.toUpperCase()));
  };

  // Check each required field
  if (!session.startDate || isPlaceholder(session.startDate)) {
    missing.push("startDate");
    if (session.dateRaw) {
      errors.push({
        field: "startDate",
        error: "Could not parse start date from raw text",
        attemptedValue: session.dateRaw,
      });
    }
  } else if (!isValidDateFormat(session.startDate)) {
    errors.push({
      field: "startDate",
      error: "Invalid date format (expected YYYY-MM-DD)",
      attemptedValue: session.startDate,
    });
  }

  if (!session.endDate || isPlaceholder(session.endDate)) {
    missing.push("endDate");
  } else if (!isValidDateFormat(session.endDate)) {
    errors.push({
      field: "endDate",
      error: "Invalid date format (expected YYYY-MM-DD)",
      attemptedValue: session.endDate,
    });
  }

  // CRITICAL: Check if session spans too long (likely program overview, not actual session)
  if (session.startDate && session.endDate && isValidDateFormat(session.startDate) && isValidDateFormat(session.endDate)) {
    const start = new Date(session.startDate);
    const end = new Date(session.endDate);
    const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // Most camps are 1 week (5 days) or 2 weeks (10 days). 3 weeks max for overnight camps.
    if (daysDiff > 21) {
      errors.push({
        field: "dateRange",
        error: `Session spans ${daysDiff} days - likely a program overview, not an individual camp session (max 21 days)`,
        attemptedValue: `${session.startDate} to ${session.endDate}`,
      });
    }
  }

  // CRITICAL: Validate registrationUrl is a valid URL
  if (session.registrationUrl) {
    if (!isValidUrl(session.registrationUrl)) {
      errors.push({
        field: "registrationUrl",
        error: "Registration URL is not a valid HTTP/HTTPS URL",
        attemptedValue: session.registrationUrl,
      });
    }
  }

  if (session.dropOffHour === undefined) {
    missing.push("dropOffTime");
    if (session.timeRaw) {
      errors.push({
        field: "dropOffTime",
        error: "Could not parse drop-off time from raw text",
        attemptedValue: session.timeRaw,
      });
    }
  } else if (!isValidHour(session.dropOffHour)) {
    errors.push({
      field: "dropOffTime",
      error: "Invalid hour (expected 0-23)",
      attemptedValue: String(session.dropOffHour),
    });
  }

  if (session.pickUpHour === undefined) {
    missing.push("pickUpTime");
  } else if (!isValidHour(session.pickUpHour)) {
    errors.push({
      field: "pickUpTime",
      error: "Invalid hour (expected 0-23)",
      attemptedValue: String(session.pickUpHour),
    });
  }

  if (!session.location) {
    missing.push("location");
  } else {
    // Validate location is meaningful (not just a generic placeholder)
    const genericLocations = ["Main Location", "TBD", "Unknown", "N/A", "Online", "Various"];
    const isGeneric = genericLocations.some(
      gen => session.location!.toLowerCase() === gen.toLowerCase()
    );

    // Check if location has any address-like content (street number + name)
    const hasAddressContent = /\d+\s+[A-Za-z]/.test(session.location!);

    if (isGeneric || (!hasAddressContent && session.location!.length < 20)) {
      errors.push({
        field: "location",
        error: "Location appears incomplete or generic - should include street address",
        attemptedValue: session.location,
      });
    }

    // CRITICAL: Check for comma-separated list of multiple venues (scraper bug)
    const commaCount = (session.location!.match(/,/g) || []).length;
    if (commaCount >= 3 && session.location!.length > 100) {
      errors.push({
        field: "location",
        error: `Location appears to be a list of ${commaCount + 1} venues - should be a single location`,
        attemptedValue: session.location!.slice(0, 100) + "...",
      });
    }
  }

  // Age requirements: need either age range OR grade range
  const hasAgeRange =
    session.minAge !== undefined || session.maxAge !== undefined;
  const hasGradeRange =
    session.minGrade !== undefined || session.maxGrade !== undefined;
  if (!hasAgeRange && !hasGradeRange) {
    missing.push("ageRequirements");
    if (session.ageGradeRaw) {
      errors.push({
        field: "ageRequirements",
        error: "Could not parse age/grade from raw text",
        attemptedValue: session.ageGradeRaw,
      });
    }
  }

  // Price: 0 is valid (free camps)
  if (session.priceInCents === undefined) {
    missing.push("price");
    if (session.priceRaw) {
      errors.push({
        field: "price",
        error: "Could not parse price from raw text",
        attemptedValue: session.priceRaw,
      });
    }
  }

  // Calculate completeness score
  const completenessScore = Math.round(
    ((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length) * 100
  );

  return {
    isComplete: missing.length === 0 && errors.length === 0,
    completenessScore,
    missingFields: missing,
    errors,
    normalizedData: normalizeSession(session),
  };
}

/**
 * Normalize a scraped session to a consistent format
 */
export function normalizeSession(session: ScrapedSession): NormalizedSession {
  return {
    name: session.name,
    description: session.description,
    category: session.category,
    startDate: session.startDate,
    endDate: session.endDate,
    dateRaw: session.dateRaw,
    dropOffHour: session.dropOffHour,
    dropOffMinute: session.dropOffMinute ?? 0,
    pickUpHour: session.pickUpHour,
    pickUpMinute: session.pickUpMinute ?? 0,
    timeRaw: session.timeRaw,
    priceInCents: session.priceInCents,
    priceRaw: session.priceRaw,
    minAge: session.minAge,
    maxAge: session.maxAge,
    minGrade: session.minGrade,
    maxGrade: session.maxGrade,
    ageGradeRaw: session.ageGradeRaw,
    location: session.location,
    registrationUrl: session.registrationUrl,
    imageUrls: session.imageUrls,
    isAvailable: session.isAvailable,
    sourceProductId: session.sourceProductId,
    sourceSessionId: session.sourceSessionId,
  };
}

/**
 * Calculate quality metrics for a source based on its sessions
 */
export function calculateSourceQuality(
  sessions: Array<{ completenessScore?: number }>
): { score: number; tier: "high" | "medium" | "low" } {
  if (sessions.length === 0) {
    return { score: 0, tier: "low" };
  }

  const avgCompleteness =
    sessions.reduce((sum, s) => sum + (s.completenessScore ?? 0), 0) /
    sessions.length;

  let tier: "high" | "medium" | "low" = "low";
  if (avgCompleteness >= 80) tier = "high";
  else if (avgCompleteness >= 50) tier = "medium";

  return { score: Math.round(avgCompleteness), tier };
}

/**
 * Options for determining session status
 */
export interface SessionStatusOptions {
  completenessScore: number;
  priceInCents?: number;
  priceRaw?: string;
}

/**
 * Determine what status a session should have based on completeness and price.
 *
 * Sessions with $0 price are suspicious unless explicitly marked as "free":
 * - If priceRaw exists but priceInCents is 0 → likely parsing failure → "draft"
 * - If priceRaw contains "free" → legitimate free camp → allow "active"
 * - If no priceRaw and price is 0 → suspicious → "draft"
 */
export function determineSessionStatus(
  options: SessionStatusOptions | number
): "active" | "draft" | "pending_review" {
  // Handle legacy single-argument call for backward compatibility
  if (typeof options === "number") {
    const completenessScore = options;
    if (completenessScore === 100) {
      return "active";
    } else if (completenessScore >= 50) {
      return "draft";
    } else {
      return "pending_review";
    }
  }

  const { completenessScore, priceInCents, priceRaw } = options;

  // First check completeness threshold
  if (completenessScore < 50) {
    return "pending_review";
  }

  // Check for suspicious $0 price
  if (priceInCents === 0) {
    // Check if it's legitimately free
    const isFree = priceRaw && /\bfree\b/i.test(priceRaw);

    if (!isFree) {
      // $0 price without "free" indicator - likely parsing failure
      // Return draft even if completeness is 100%
      return "draft";
    }
  }

  // Standard completeness-based status
  if (completenessScore === 100) {
    return "active";
  } else {
    return "draft";
  }
}

// Helper functions

function isValidDateFormat(date: string): boolean {
  // Check YYYY-MM-DD format
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;

  // Check if it's a valid date
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

function isValidHour(hour: number): boolean {
  return Number.isInteger(hour) && hour >= 0 && hour <= 23;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Try to parse dates from various formats
 */
export function parseDateRange(
  dateText: string
): { startDate?: string; endDate?: string } | null {
  if (!dateText) return null;

  // Common patterns:
  // "June 10-14, 2025" → startDate: 2025-06-10, endDate: 2025-06-14
  // "6/10/2025 - 6/14/2025" → startDate: 2025-06-10, endDate: 2025-06-14
  // "Jun 10 - Jun 14" → needs year inference

  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const monthAbbrevs = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];

  const normalized = dateText.toLowerCase().trim();

  // Pattern: "Month DD-DD, YYYY" (e.g., "June 10-14, 2025")
  const rangePattern1 =
    /(\w+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(\d{4})/i;
  const match1 = normalized.match(rangePattern1);
  if (match1) {
    const monthStr = match1[1].toLowerCase();
    const startDay = parseInt(match1[2]);
    const endDay = parseInt(match1[3]);
    const year = parseInt(match1[4]);

    let monthIdx = monthNames.indexOf(monthStr);
    if (monthIdx === -1) monthIdx = monthAbbrevs.indexOf(monthStr);
    if (monthIdx === -1) return null;

    const month = String(monthIdx + 1).padStart(2, "0");
    return {
      startDate: `${year}-${month}-${String(startDay).padStart(2, "0")}`,
      endDate: `${year}-${month}-${String(endDay).padStart(2, "0")}`,
    };
  }

  // Pattern: "MM/DD/YYYY - MM/DD/YYYY"
  const rangePattern2 =
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const match2 = dateText.match(rangePattern2);
  if (match2) {
    return {
      startDate: `${match2[3]}-${String(match2[1]).padStart(2, "0")}-${String(match2[2]).padStart(2, "0")}`,
      endDate: `${match2[6]}-${String(match2[4]).padStart(2, "0")}-${String(match2[5]).padStart(2, "0")}`,
    };
  }

  return null;
}

/**
 * Try to parse time range from text
 */
export function parseTimeRange(
  timeText: string
): { dropOffHour: number; dropOffMinute: number; pickUpHour: number; pickUpMinute: number } | null {
  if (!timeText) return null;

  // Pattern: "9:00 AM - 3:00 PM" or "9am-3pm" or "9:00am - 3:00pm"
  const timePattern =
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const match = timeText.match(timePattern);
  if (!match) return null;

  let dropOffHour = parseInt(match[1]);
  const dropOffMinute = match[2] ? parseInt(match[2]) : 0;
  const dropOffPeriod = (match[3] || "").toLowerCase();

  let pickUpHour = parseInt(match[4]);
  const pickUpMinute = match[5] ? parseInt(match[5]) : 0;
  const pickUpPeriod = (match[6] || "").toLowerCase();

  // Convert to 24-hour format
  if (dropOffPeriod === "pm" && dropOffHour !== 12) dropOffHour += 12;
  if (dropOffPeriod === "am" && dropOffHour === 12) dropOffHour = 0;
  if (pickUpPeriod === "pm" && pickUpHour !== 12) pickUpHour += 12;
  if (pickUpPeriod === "am" && pickUpHour === 12) pickUpHour = 0;

  // If no am/pm specified, assume morning for drop-off and afternoon for pick-up
  if (!dropOffPeriod && dropOffHour < 12 && dropOffHour > 0) {
    // Keep as-is (morning)
  }
  if (!pickUpPeriod && pickUpHour < 6) {
    pickUpHour += 12; // Assume afternoon
  }

  return { dropOffHour, dropOffMinute, pickUpHour, pickUpMinute };
}

/**
 * Try to parse price from text
 */
export function parsePrice(priceText: string): number | null {
  if (!priceText) return null;

  // Handle "Free" or "$0"
  if (/free/i.test(priceText) || priceText === "$0") {
    return 0;
  }

  // Extract numeric value
  const match = priceText.match(/\$?([\d,]+)(?:\.(\d{2}))?/);
  if (!match) return null;

  const dollars = parseInt(match[1].replace(/,/g, ""));
  const cents = match[2] ? parseInt(match[2]) : 0;

  return dollars * 100 + cents;
}

/**
 * Try to parse age range from text
 */
export function parseAgeRange(
  ageText: string
): { minAge?: number; maxAge?: number; minGrade?: number; maxGrade?: number } | null {
  if (!ageText) return null;

  const normalized = ageText.toLowerCase().trim();

  // Grade patterns
  // "Grades K-5", "K-5th grade", "1st-5th"
  const gradePattern = /(?:grades?\s*)?(\d+|k|pre-?k)\s*(?:st|nd|rd|th)?\s*[-–]\s*(\d+|k)\s*(?:st|nd|rd|th)?(?:\s*grade)?/i;
  const gradeMatch = normalized.match(gradePattern);
  if (gradeMatch) {
    const parseGrade = (g: string): number => {
      if (g === "k") return 0;
      if (g === "pre-k" || g === "prek") return -1;
      return parseInt(g);
    };
    return {
      minGrade: parseGrade(gradeMatch[1]),
      maxGrade: parseGrade(gradeMatch[2]),
    };
  }

  // Age patterns
  // "Ages 5-12", "5-12 years", "age 5 to 12"
  const agePattern = /(?:ages?\s*)?(\d+)\s*(?:[-–]|to)\s*(\d+)(?:\s*(?:years?|y\.?o\.?))?/i;
  const ageMatch = normalized.match(agePattern);
  if (ageMatch) {
    return {
      minAge: parseInt(ageMatch[1]),
      maxAge: parseInt(ageMatch[2]),
    };
  }

  // Single age: "Age 5+", "5 and up"
  const singleAgePattern = /(?:ages?\s*)?(\d+)\s*(?:\+|and\s*up|and\s*older)/i;
  const singleMatch = normalized.match(singleAgePattern);
  if (singleMatch) {
    return {
      minAge: parseInt(singleMatch[1]),
      maxAge: 18, // Default max age for "and up"
    };
  }

  return null;
}
