import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getChildAge,
  formatDateShort,
  getThisWeekDates,
  getNextWeekDates,
} from '@/lib/dateUtils';

describe('getChildAge', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns correct age for a past birthday this year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-08-15'));
    expect(getChildAge('2015-03-10')).toBe(10);
  });

  it('returns age minus one when birthday has not occurred yet this year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-01'));
    expect(getChildAge('2015-03-10')).toBe(9);
  });

  it('returns correct age on the exact birthday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-10'));
    expect(getChildAge('2015-03-10')).toBe(10);
  });

  it('returns null for empty string', () => {
    expect(getChildAge('')).toBeNull();
  });
});

describe('formatDateShort', () => {
  it('formats a date string as "Mon D" style', () => {
    const result = formatDateShort('2025-06-15');
    expect(result).toBe('Jun 15');
  });

  it('formats January date correctly', () => {
    const result = formatDateShort('2025-01-01');
    expect(result).toBe('Jan 1');
  });

  it('formats December date correctly', () => {
    const result = formatDateShort('2025-12-25');
    expect(result).toBe('Dec 25');
  });
});

describe('getThisWeekDates', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns start and end as valid date strings', () => {
    const { start, end } = getThisWeekDates();
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('start is Monday and end is Sunday', () => {
    vi.useFakeTimers();
    // Use explicit local time to avoid UTC/local timezone mismatch
    vi.setSystemTime(new Date(2025, 5, 11, 12, 0, 0)); // Wed June 11 2025, noon local
    const { start, end } = getThisWeekDates();
    expect(start).toBe('2025-06-09'); // Monday
    expect(end).toBe('2025-06-15'); // Sunday
  });

  it('end is 6 days after start', () => {
    const { start, end } = getThisWeekDates();
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(6);
  });
});

describe('getNextWeekDates', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns dates after this week', () => {
    const thisWeek = getThisWeekDates();
    const nextWeek = getNextWeekDates();
    expect(nextWeek.start > thisWeek.end).toBe(true);
  });

  it('next week start is 7 days after this week start', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-11'));
    const thisWeek = getThisWeekDates();
    const nextWeek = getNextWeekDates();
    const thisStart = new Date(thisWeek.start + 'T00:00:00');
    const nextStart = new Date(nextWeek.start + 'T00:00:00');
    const diffDays = (nextStart.getTime() - thisStart.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(7);
  });
});
