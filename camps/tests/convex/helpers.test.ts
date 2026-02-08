import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  resolveCampName,
  calculateAge,
  calculateGradeFromAge,
  isAgeInRange,
  isGradeInRange,
  calculateDistance,
  slugify,
  formatPrice,
  generateSummerWeeks,
  doDateRangesOverlap,
  countOverlappingWeekdays,
} from '@/convex/lib/helpers';
import type { Doc, Id } from '@/convex/_generated/dataModel';

// Create typed mock IDs
const campId1 = 'camp1' as unknown as Id<'camps'>;
const campId2 = 'camp2' as unknown as Id<'camps'>;

describe('resolveCampName', () => {
  it('uses campName when present', () => {
    const session = { campName: 'Art Adventure', campId: campId1 };
    const campMap = new Map<Id<'camps'>, Doc<'camps'>>();
    expect(resolveCampName(session, campMap)).toBe('Art Adventure');
  });

  it('falls back to camp map when campName is undefined', () => {
    const session = { campName: undefined, campId: campId1 };
    const campMap = new Map<Id<'camps'>, Doc<'camps'>>();
    campMap.set(campId1, { name: 'Nature Camp' } as Doc<'camps'>);
    expect(resolveCampName(session, campMap)).toBe('Nature Camp');
  });

  it('falls back to "Unknown Camp" when campName is undefined and campId not in map', () => {
    const session = { campName: undefined, campId: campId2 };
    const campMap = new Map<Id<'camps'>, Doc<'camps'>>();
    expect(resolveCampName(session, campMap)).toBe('Unknown Camp');
  });

  it('prefers campName over camp map even when camp is in map', () => {
    const session = { campName: 'Direct Name', campId: campId1 };
    const campMap = new Map<Id<'camps'>, Doc<'camps'>>();
    campMap.set(campId1, { name: 'Map Name' } as Doc<'camps'>);
    expect(resolveCampName(session, campMap)).toBe('Direct Name');
  });
});

describe('calculateAge', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates age for a past birthday this year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 7, 15, 12)); // Aug 15, 2025
    expect(calculateAge('2015-03-10')).toBe(10);
  });

  it('subtracts 1 when birthday has not happened yet', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 1, 1, 12)); // Feb 1, 2025
    expect(calculateAge('2015-03-10')).toBe(9);
  });

  it('returns correct age on exact birthday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 10, 12)); // Mar 10, 2025
    expect(calculateAge('2015-03-10')).toBe(10);
  });
});

describe('calculateGradeFromAge', () => {
  it('returns 0 (Kindergarten) for age 5', () => {
    expect(calculateGradeFromAge(5)).toBe(0);
  });

  it('returns -1 (Pre-K) for age 4', () => {
    expect(calculateGradeFromAge(4)).toBe(-1);
  });

  it('returns 1 (1st grade) for age 6', () => {
    expect(calculateGradeFromAge(6)).toBe(1);
  });

  it('returns 7 (7th grade) for age 12', () => {
    expect(calculateGradeFromAge(12)).toBe(7);
  });
});

describe('isAgeInRange', () => {
  it('returns true when age is within range', () => {
    expect(isAgeInRange(7, { minAge: 5, maxAge: 12 })).toBe(true);
  });

  it('returns true at minAge boundary', () => {
    expect(isAgeInRange(5, { minAge: 5, maxAge: 12 })).toBe(true);
  });

  it('returns true at maxAge boundary', () => {
    expect(isAgeInRange(12, { minAge: 5, maxAge: 12 })).toBe(true);
  });

  it('returns false below minAge', () => {
    expect(isAgeInRange(4, { minAge: 5, maxAge: 12 })).toBe(false);
  });

  it('returns false above maxAge', () => {
    expect(isAgeInRange(13, { minAge: 5, maxAge: 12 })).toBe(false);
  });

  it('returns true when minAge is undefined (no lower bound)', () => {
    expect(isAgeInRange(3, { maxAge: 12 })).toBe(true);
  });

  it('returns true when maxAge is undefined (no upper bound)', () => {
    expect(isAgeInRange(99, { minAge: 5 })).toBe(true);
  });

  it('returns true when both bounds are undefined', () => {
    expect(isAgeInRange(7, {})).toBe(true);
  });
});

describe('isGradeInRange', () => {
  it('returns true when grade is within range', () => {
    expect(isGradeInRange(3, { minGrade: 0, maxGrade: 5 })).toBe(true);
  });

  it('returns true at minGrade boundary (K)', () => {
    expect(isGradeInRange(0, { minGrade: 0, maxGrade: 5 })).toBe(true);
  });

  it('returns false below minGrade', () => {
    expect(isGradeInRange(-1, { minGrade: 0, maxGrade: 5 })).toBe(false);
  });

  it('returns false above maxGrade', () => {
    expect(isGradeInRange(6, { minGrade: 0, maxGrade: 5 })).toBe(false);
  });

  it('returns true when minGrade is undefined', () => {
    expect(isGradeInRange(-2, { maxGrade: 5 })).toBe(true);
  });

  it('returns true when both bounds are undefined', () => {
    expect(isGradeInRange(10, {})).toBe(true);
  });
});

describe('calculateDistance', () => {
  it('returns 0 for same point', () => {
    expect(calculateDistance(45.5, -122.6, 45.5, -122.6)).toBe(0);
  });

  it('calculates Portland to Seattle approximately 145 miles', () => {
    // Portland (45.5152, -122.6784) to Seattle (47.6062, -122.3321)
    const dist = calculateDistance(45.5152, -122.6784, 47.6062, -122.3321);
    expect(dist).toBeGreaterThan(140);
    expect(dist).toBeLessThan(150);
  });

  it('calculates short distance (a few blocks)', () => {
    // Two points about 1 mile apart in Portland
    const dist = calculateDistance(45.5152, -122.6784, 45.5297, -122.6784);
    expect(dist).toBeGreaterThan(0.5);
    expect(dist).toBeLessThan(2);
  });

  it('is symmetric (A->B same as B->A)', () => {
    const dist1 = calculateDistance(45.5, -122.6, 47.6, -122.3);
    const dist2 = calculateDistance(47.6, -122.3, 45.5, -122.6);
    expect(Math.abs(dist1 - dist2)).toBeLessThan(0.001);
  });
});

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('summer art camp')).toBe('summer-art-camp');
  });

  it('removes special characters', () => {
    expect(slugify("Camp & Kids' Fun!")).toBe('camp-kids-fun');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('hello---world')).toBe('hello-world');
  });

  it('removes leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('trims whitespace', () => {
    expect(slugify('  hello  ')).toBe('hello');
  });

  it('replaces underscores with hyphens', () => {
    expect(slugify('hello_world')).toBe('hello-world');
  });
});

describe('formatPrice', () => {
  it('formats 25000 cents as $250.00', () => {
    expect(formatPrice(25000)).toBe('$250.00');
  });

  it('formats 0 cents as $0.00', () => {
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('formats cents correctly', () => {
    expect(formatPrice(1999)).toBe('$19.99');
  });

  it('formats large amounts with commas', () => {
    expect(formatPrice(150000)).toBe('$1,500.00');
  });

  it('formats single digit cents', () => {
    expect(formatPrice(101)).toBe('$1.01');
  });
});

describe('generateSummerWeeks', () => {
  it('generates weeks for June through August', () => {
    const weeks = generateSummerWeeks(2025);
    expect(weeks.length).toBeGreaterThan(0);
    // First week should start in June
    expect(weeks[0].startDate).toMatch(/^2025-06/);
    // Last week should be in August
    const lastWeek = weeks[weeks.length - 1];
    expect(lastWeek.startDate).toMatch(/^2025-08/);
  });

  it('each week starts on Monday and ends on Friday', () => {
    const weeks = generateSummerWeeks(2025);
    for (const week of weeks) {
      const start = new Date(week.startDate + 'T00:00:00');
      const end = new Date(week.endDate + 'T00:00:00');
      expect(start.getDay()).toBe(1); // Monday
      expect(end.getDay()).toBe(5); // Friday
    }
  });

  it('weeks are numbered sequentially starting from 1', () => {
    const weeks = generateSummerWeeks(2025);
    for (let i = 0; i < weeks.length; i++) {
      expect(weeks[i].weekNumber).toBe(i + 1);
    }
  });

  it('generates approximately 13 weeks for a typical summer', () => {
    const weeks = generateSummerWeeks(2025);
    expect(weeks.length).toBeGreaterThanOrEqual(12);
    expect(weeks.length).toBeLessThanOrEqual(14);
  });

  it('has correct month names', () => {
    const weeks = generateSummerWeeks(2025);
    const firstJuneWeek = weeks.find((w) => w.startDate.includes('-06-'));
    expect(firstJuneWeek?.monthName).toBe('June');
  });

  it('has labels in "Mon D-D" format', () => {
    const weeks = generateSummerWeeks(2025);
    for (const week of weeks) {
      expect(week.label).toMatch(/^[A-Z][a-z]{2} \d{1,2}-\d{1,2}$/);
    }
  });
});

describe('doDateRangesOverlap', () => {
  it('returns true for overlapping ranges', () => {
    expect(doDateRangesOverlap('2025-06-01', '2025-06-10', '2025-06-05', '2025-06-15')).toBe(true);
  });

  it('returns true for contained range', () => {
    expect(doDateRangesOverlap('2025-06-01', '2025-06-30', '2025-06-10', '2025-06-20')).toBe(true);
  });

  it('returns true for identical ranges', () => {
    expect(doDateRangesOverlap('2025-06-10', '2025-06-14', '2025-06-10', '2025-06-14')).toBe(true);
  });

  it('returns true for adjacent ranges (shared boundary)', () => {
    expect(doDateRangesOverlap('2025-06-01', '2025-06-10', '2025-06-10', '2025-06-20')).toBe(true);
  });

  it('returns false for non-overlapping ranges', () => {
    expect(doDateRangesOverlap('2025-06-01', '2025-06-10', '2025-06-11', '2025-06-20')).toBe(false);
  });

  it('returns false for ranges far apart', () => {
    expect(doDateRangesOverlap('2025-01-01', '2025-01-31', '2025-12-01', '2025-12-31')).toBe(false);
  });
});

describe('countOverlappingWeekdays', () => {
  it('returns 5 for full week overlap', () => {
    // Camp range fully covers the week Mon-Fri
    expect(countOverlappingWeekdays('2025-06-09', '2025-06-13', '2025-06-09', '2025-06-13')).toBe(5);
  });

  it('returns 0 for non-overlapping ranges', () => {
    expect(countOverlappingWeekdays('2025-06-01', '2025-06-06', '2025-06-09', '2025-06-13')).toBe(0);
  });

  it('returns partial overlap count', () => {
    // Camp runs Wed-Fri of a Mon-Fri week
    expect(countOverlappingWeekdays('2025-06-11', '2025-06-13', '2025-06-09', '2025-06-13')).toBe(3);
  });

  it('excludes weekends from count', () => {
    // Range includes a weekend but week is Mon-Fri
    expect(countOverlappingWeekdays('2025-06-06', '2025-06-11', '2025-06-09', '2025-06-13')).toBe(3);
    // Fri Jun 6 not in week, Sat/Sun excluded, Mon-Wed Jun 9-11 = 3
  });

  it('returns 1 for single day overlap on a weekday', () => {
    expect(countOverlappingWeekdays('2025-06-09', '2025-06-09', '2025-06-09', '2025-06-13')).toBe(1);
  });
});
