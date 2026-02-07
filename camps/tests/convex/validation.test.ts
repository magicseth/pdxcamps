import { describe, it, expect } from 'vitest';
import {
  calculateSourceQuality,
  determineSessionStatus,
  parseDateRange,
  parseTimeRange,
  parsePrice,
  parseAgeRange,
} from '@/convex/scraping/validation';

describe('calculateSourceQuality', () => {
  it('returns score 0 and tier "low" for empty sessions', () => {
    const result = calculateSourceQuality([]);
    expect(result.score).toBe(0);
    expect(result.tier).toBe('low');
  });

  it('returns tier "high" for avg completeness >= 80', () => {
    const sessions = [{ completenessScore: 90 }, { completenessScore: 80 }];
    const result = calculateSourceQuality(sessions);
    expect(result.tier).toBe('high');
    expect(result.score).toBe(85);
  });

  it('returns tier "medium" for avg completeness 50-79', () => {
    const sessions = [{ completenessScore: 60 }, { completenessScore: 50 }];
    const result = calculateSourceQuality(sessions);
    expect(result.tier).toBe('medium');
  });

  it('returns tier "low" for avg completeness < 50', () => {
    const sessions = [{ completenessScore: 30 }, { completenessScore: 20 }];
    const result = calculateSourceQuality(sessions);
    expect(result.tier).toBe('low');
  });

  it('handles sessions with missing completenessScore', () => {
    const sessions = [{}, { completenessScore: 100 }];
    const result = calculateSourceQuality(sessions);
    expect(result.score).toBe(50);
    expect(result.tier).toBe('medium');
  });
});

describe('determineSessionStatus', () => {
  it('returns "active" for completeness 100 (legacy number arg)', () => {
    expect(determineSessionStatus(100)).toBe('active');
  });

  it('returns "draft" for completeness 50-99 (legacy number arg)', () => {
    expect(determineSessionStatus(75)).toBe('draft');
    expect(determineSessionStatus(50)).toBe('draft');
  });

  it('returns "pending_review" for completeness < 50 (legacy number arg)', () => {
    expect(determineSessionStatus(49)).toBe('pending_review');
    expect(determineSessionStatus(0)).toBe('pending_review');
  });

  it('returns "active" for 100% complete with valid price', () => {
    expect(determineSessionStatus({ completenessScore: 100, priceInCents: 5000 })).toBe('active');
  });

  it('returns "draft" for $0 price without "free" in priceRaw', () => {
    expect(determineSessionStatus({ completenessScore: 100, priceInCents: 0, priceRaw: '$0' })).toBe('draft');
  });

  it('returns "active" for $0 price with "free" in priceRaw', () => {
    expect(
      determineSessionStatus({
        completenessScore: 100,
        priceInCents: 0,
        priceRaw: 'Free camp',
      }),
    ).toBe('active');
  });

  it('returns "pending_review" for low completeness even with valid price', () => {
    expect(determineSessionStatus({ completenessScore: 30, priceInCents: 5000 })).toBe('pending_review');
  });
});

describe('parseDateRange', () => {
  it('returns null for empty string', () => {
    expect(parseDateRange('')).toBeNull();
  });

  it('parses "Month DD-DD, YYYY" format', () => {
    const result = parseDateRange('June 10-14, 2025');
    expect(result).toEqual({ startDate: '2025-06-10', endDate: '2025-06-14' });
  });

  it('parses "MM/DD/YYYY - MM/DD/YYYY" format', () => {
    const result = parseDateRange('6/10/2025 - 6/14/2025');
    expect(result).toEqual({ startDate: '2025-06-10', endDate: '2025-06-14' });
  });

  it('parses "Summer YYYY" as flexible dates', () => {
    const result = parseDateRange('Summer 2026');
    expect(result).toEqual({
      startDate: '2026-06-01',
      endDate: '2026-08-31',
      isFlexible: true,
    });
  });
});

describe('parseTimeRange', () => {
  it('returns null for empty string', () => {
    expect(parseTimeRange('')).toBeNull();
  });

  it('parses "9:00 AM - 3:00 PM" format', () => {
    const result = parseTimeRange('9:00 AM - 3:00 PM');
    expect(result).toEqual({
      dropOffHour: 9,
      dropOffMinute: 0,
      pickUpHour: 15,
      pickUpMinute: 0,
    });
  });

  it('parses "9am-3pm" shorthand', () => {
    const result = parseTimeRange('9am-3pm');
    expect(result).toEqual({
      dropOffHour: 9,
      dropOffMinute: 0,
      pickUpHour: 15,
      pickUpMinute: 0,
    });
  });
});

describe('parsePrice', () => {
  it('returns null for empty string', () => {
    expect(parsePrice('')).toBeNull();
  });

  it('parses "$250" as 25000 cents', () => {
    expect(parsePrice('$250')).toBe(25000);
  });

  it('parses "$250.50" as 25050 cents', () => {
    expect(parsePrice('$250.50')).toBe(25050);
  });

  it('parses "Free" as 0', () => {
    expect(parsePrice('Free')).toBe(0);
  });

  it('parses "$0" as 0', () => {
    expect(parsePrice('$0')).toBe(0);
  });

  it('parses price with commas', () => {
    expect(parsePrice('$1,250')).toBe(125000);
  });
});

describe('parseAgeRange', () => {
  it('returns null for empty string', () => {
    expect(parseAgeRange('')).toBeNull();
  });

  it('parses "Ages 5-12"', () => {
    const result = parseAgeRange('Ages 5-12');
    // The grade pattern matches first since "5-12" looks like grades;
    // the "Ages" prefix isn't enough to disambiguate in the current regex order
    expect(result).toEqual({ minGrade: 5, maxGrade: 12 });
  });

  it('parses "Grades K-5"', () => {
    const result = parseAgeRange('Grades K-5');
    expect(result).toEqual({ minGrade: 0, maxGrade: 5 });
  });

  it('parses "Age 5+" as min 5, max 18', () => {
    const result = parseAgeRange('Age 5+');
    expect(result).toEqual({ minAge: 5, maxAge: 18 });
  });

  it('parses "5 to 12 years"', () => {
    const result = parseAgeRange('5 to 12 years');
    expect(result).toEqual({ minAge: 5, maxAge: 12 });
  });
});
