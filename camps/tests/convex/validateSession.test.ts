import { describe, it, expect } from 'vitest';
import { validateSession } from '@/convex/scraping/validation';
import type { ScrapedSession } from '@/convex/scraping/scrapers/types';

// Helper to create a valid session with all required fields
function makeValidSession(overrides: Partial<ScrapedSession> = {}): ScrapedSession {
  return {
    name: 'Art Camp',
    startDate: '2025-06-10',
    endDate: '2025-06-14',
    dropOffHour: 9,
    dropOffMinute: 0,
    pickUpHour: 15,
    pickUpMinute: 0,
    location: '123 Main St, Portland, OR 97201',
    minAge: 5,
    maxAge: 12,
    priceInCents: 25000,
    ...overrides,
  };
}

describe('validateSession', () => {
  describe('complete valid sessions', () => {
    it('marks a fully valid session as complete', () => {
      const result = validateSession(makeValidSession());
      expect(result.isComplete).toBe(true);
      expect(result.completenessScore).toBe(100);
      expect(result.missingFields).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('accepts grade range instead of age range', () => {
      const result = validateSession(
        makeValidSession({ minAge: undefined, maxAge: undefined, minGrade: 0, maxGrade: 5 }),
      );
      expect(result.isComplete).toBe(true);
      expect(result.missingFields).not.toContain('ageRequirements');
    });

    it('accepts $0 price (free camp)', () => {
      const result = validateSession(makeValidSession({ priceInCents: 0 }));
      expect(result.missingFields).not.toContain('price');
    });
  });

  describe('placeholder detection', () => {
    it('treats <UNKNOWN> as missing', () => {
      const result = validateSession(makeValidSession({ startDate: '<UNKNOWN>' }));
      expect(result.missingFields).toContain('startDate');
    });

    it('treats UNKNOWN as missing', () => {
      const result = validateSession(makeValidSession({ startDate: 'UNKNOWN' }));
      expect(result.missingFields).toContain('startDate');
    });

    it('treats TBD as missing', () => {
      const result = validateSession(makeValidSession({ endDate: 'TBD' }));
      expect(result.missingFields).toContain('endDate');
    });

    it('treats N/A as missing', () => {
      const result = validateSession(makeValidSession({ startDate: 'N/A' }));
      expect(result.missingFields).toContain('startDate');
    });

    it('treats null as missing', () => {
      const result = validateSession(makeValidSession({ startDate: 'null' }));
      expect(result.missingFields).toContain('startDate');
    });

    it('treats undefined string as missing', () => {
      const result = validateSession(makeValidSession({ startDate: 'undefined' }));
      expect(result.missingFields).toContain('startDate');
    });
  });

  describe('date validation', () => {
    it('reports missing startDate', () => {
      const result = validateSession(makeValidSession({ startDate: undefined }));
      expect(result.missingFields).toContain('startDate');
    });

    it('reports missing endDate', () => {
      const result = validateSession(makeValidSession({ endDate: undefined }));
      expect(result.missingFields).toContain('endDate');
    });

    it('reports invalid date format', () => {
      const result = validateSession(makeValidSession({ startDate: '06/10/2025' }));
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'startDate',
          error: expect.stringContaining('Invalid date format'),
        }),
      );
    });

    it('reports invalid endDate format', () => {
      const result = validateSession(makeValidSession({ endDate: 'June 14' }));
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'endDate',
          error: expect.stringContaining('Invalid date format'),
        }),
      );
    });

    it('adds error with dateRaw when startDate is missing', () => {
      const result = validateSession(makeValidSession({ startDate: undefined, dateRaw: 'Jun 10-14' }));
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'startDate',
          attemptedValue: 'Jun 10-14',
        }),
      );
    });
  });

  describe('long date range detection', () => {
    it('flags sessions spanning more than 21 days', () => {
      const result = validateSession(
        makeValidSession({ startDate: '2025-06-01', endDate: '2025-07-15' }),
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'dateRange',
          error: expect.stringContaining('likely a program overview'),
        }),
      );
    });

    it('allows sessions spanning exactly 21 days', () => {
      const result = validateSession(
        makeValidSession({ startDate: '2025-06-01', endDate: '2025-06-22' }),
      );
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ field: 'dateRange' }),
      );
    });

    it('allows flexible sessions spanning more than 21 days', () => {
      const result = validateSession(
        makeValidSession({
          startDate: '2025-06-01',
          endDate: '2025-08-31',
          isFlexible: true,
        }),
      );
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ field: 'dateRange' }),
      );
    });

    it('does not check date range when dates are invalid format', () => {
      const result = validateSession(
        makeValidSession({ startDate: 'bad', endDate: 'also-bad' }),
      );
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ field: 'dateRange' }),
      );
    });
  });

  describe('URL validation', () => {
    it('accepts valid https URL', () => {
      const result = validateSession(
        makeValidSession({ registrationUrl: 'https://example.com/register' }),
      );
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ field: 'registrationUrl' }),
      );
    });

    it('accepts valid http URL', () => {
      const result = validateSession(
        makeValidSession({ registrationUrl: 'http://example.com/register' }),
      );
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ field: 'registrationUrl' }),
      );
    });

    it('rejects non-URL registration string', () => {
      const result = validateSession(
        makeValidSession({ registrationUrl: 'not a url' }),
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'registrationUrl',
          error: expect.stringContaining('not a valid HTTP/HTTPS URL'),
        }),
      );
    });

    it('rejects javascript: protocol URL', () => {
      const result = validateSession(
        makeValidSession({ registrationUrl: 'javascript:alert(1)' }),
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'registrationUrl' }),
      );
    });

    it('does not error when registrationUrl is missing', () => {
      const result = validateSession(makeValidSession({ registrationUrl: undefined }));
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ field: 'registrationUrl' }),
      );
    });
  });

  describe('time validation', () => {
    it('reports missing dropOffTime', () => {
      const result = validateSession(makeValidSession({ dropOffHour: undefined }));
      expect(result.missingFields).toContain('dropOffTime');
    });

    it('reports missing pickUpTime', () => {
      const result = validateSession(makeValidSession({ pickUpHour: undefined }));
      expect(result.missingFields).toContain('pickUpTime');
    });

    it('reports invalid dropOffHour (negative)', () => {
      const result = validateSession(makeValidSession({ dropOffHour: -1 }));
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'dropOffTime',
          error: expect.stringContaining('Invalid hour'),
        }),
      );
    });

    it('reports invalid dropOffHour (> 23)', () => {
      const result = validateSession(makeValidSession({ dropOffHour: 25 }));
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'dropOffTime' }),
      );
    });

    it('reports invalid pickUpHour', () => {
      const result = validateSession(makeValidSession({ pickUpHour: 24 }));
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'pickUpTime' }),
      );
    });

    it('accepts hour 0 as valid', () => {
      const result = validateSession(makeValidSession({ dropOffHour: 0 }));
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ field: 'dropOffTime' }),
      );
      expect(result.missingFields).not.toContain('dropOffTime');
    });

    it('accepts hour 23 as valid', () => {
      const result = validateSession(makeValidSession({ pickUpHour: 23 }));
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ field: 'pickUpTime' }),
      );
    });

    it('adds error with timeRaw when dropOffHour is missing', () => {
      const result = validateSession(
        makeValidSession({ dropOffHour: undefined, timeRaw: '9am-3pm' }),
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'dropOffTime',
          attemptedValue: '9am-3pm',
        }),
      );
    });
  });

  describe('location validation', () => {
    it('reports missing location', () => {
      const result = validateSession(makeValidSession({ location: undefined }));
      expect(result.missingFields).toContain('location');
    });

    it('flags generic location "TBD"', () => {
      const result = validateSession(makeValidSession({ location: 'TBD' }));
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'location',
          error: expect.stringContaining('generic'),
        }),
      );
    });

    it('flags generic location "Online"', () => {
      const result = validateSession(makeValidSession({ location: 'Online' }));
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'location' }),
      );
    });

    it('flags generic location "Main Location"', () => {
      const result = validateSession(makeValidSession({ location: 'Main Location' }));
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'location' }),
      );
    });

    it('accepts location with street address', () => {
      const result = validateSession(
        makeValidSession({ location: '123 Oak St' }),
      );
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ field: 'location' }),
      );
    });

    it('accepts location with recognized city name', () => {
      const result = validateSession(
        makeValidSession({ location: 'Portland Community Center' }),
      );
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ field: 'location' }),
      );
    });

    it('flags short non-address location without city', () => {
      const result = validateSession(
        makeValidSession({ location: 'Gym' }),
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'location',
          error: expect.stringContaining('incomplete'),
        }),
      );
    });

    it('accepts long descriptive location even without address', () => {
      const result = validateSession(
        makeValidSession({ location: 'The Big Community Recreation Center Hall' }),
      );
      // 20+ chars, so it passes the length check
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ field: 'location' }),
      );
    });
  });

  describe('comma-separated venue detection', () => {
    it('flags location with 3+ commas and over 100 chars', () => {
      const longVenueList =
        'Lincoln Park, Grant Park, Riverside Park, Sunset Hills, Mountain View Community Center, Downtown Pavilion';
      const result = validateSession(makeValidSession({ location: longVenueList }));
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'location',
          error: expect.stringContaining('list of'),
        }),
      );
    });

    it('allows location with 2 commas (e.g., address)', () => {
      const result = validateSession(
        makeValidSession({ location: '123 Main St, Portland, OR 97201' }),
      );
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({
          field: 'location',
          error: expect.stringContaining('list of'),
        }),
      );
    });
  });

  describe('age/grade requirements', () => {
    it('reports missing when no age or grade range', () => {
      const result = validateSession(
        makeValidSession({
          minAge: undefined,
          maxAge: undefined,
          minGrade: undefined,
          maxGrade: undefined,
        }),
      );
      expect(result.missingFields).toContain('ageRequirements');
    });

    it('accepts minAge only', () => {
      const result = validateSession(
        makeValidSession({ minAge: 5, maxAge: undefined, minGrade: undefined, maxGrade: undefined }),
      );
      expect(result.missingFields).not.toContain('ageRequirements');
    });

    it('accepts maxGrade only', () => {
      const result = validateSession(
        makeValidSession({ minAge: undefined, maxAge: undefined, minGrade: undefined, maxGrade: 8 }),
      );
      expect(result.missingFields).not.toContain('ageRequirements');
    });

    it('adds error with ageGradeRaw when requirements missing', () => {
      const result = validateSession(
        makeValidSession({
          minAge: undefined,
          maxAge: undefined,
          minGrade: undefined,
          maxGrade: undefined,
          ageGradeRaw: 'All ages welcome',
        }),
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'ageRequirements',
          attemptedValue: 'All ages welcome',
        }),
      );
    });
  });

  describe('price validation', () => {
    it('reports missing when priceInCents is undefined', () => {
      const result = validateSession(makeValidSession({ priceInCents: undefined }));
      expect(result.missingFields).toContain('price');
    });

    it('does not report missing when priceInCents is 0', () => {
      const result = validateSession(makeValidSession({ priceInCents: 0 }));
      expect(result.missingFields).not.toContain('price');
    });

    it('adds error with priceRaw when price is missing', () => {
      const result = validateSession(
        makeValidSession({ priceInCents: undefined, priceRaw: '$250/week' }),
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'price',
          attemptedValue: '$250/week',
        }),
      );
    });
  });

  describe('completeness score', () => {
    it('returns 100 for all fields present', () => {
      const result = validateSession(makeValidSession());
      expect(result.completenessScore).toBe(100);
    });

    it('reduces score proportionally to missing fields', () => {
      // 7 required fields, missing 1 = 6/7 = 86%
      const result = validateSession(makeValidSession({ priceInCents: undefined }));
      expect(result.completenessScore).toBe(86);
    });

    it('returns 0 when all required fields are missing', () => {
      const result = validateSession({ name: 'Empty Camp' });
      expect(result.completenessScore).toBe(0);
      expect(result.missingFields.length).toBe(7);
    });
  });

  describe('normalizedData', () => {
    it('includes the session name', () => {
      const result = validateSession(makeValidSession({ name: 'Test Camp' }));
      expect(result.normalizedData.name).toBe('Test Camp');
    });

    it('defaults dropOffMinute to 0 when undefined', () => {
      const result = validateSession(makeValidSession({ dropOffMinute: undefined }));
      expect(result.normalizedData.dropOffMinute).toBe(0);
    });

    it('defaults pickUpMinute to 0 when undefined', () => {
      const result = validateSession(makeValidSession({ pickUpMinute: undefined }));
      expect(result.normalizedData.pickUpMinute).toBe(0);
    });
  });
});
