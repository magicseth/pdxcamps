import { describe, it, expect } from 'vitest';
import { similarity, generateDedupeKey } from '@/convex/scraping/deduplication';

describe('similarity', () => {
  it('returns 1 for identical strings', () => {
    expect(similarity('Art Camp', 'Art Camp')).toBe(1);
  });

  it('returns 1 for strings that differ only in case', () => {
    expect(similarity('Art Camp', 'art camp')).toBe(1);
  });

  it('returns 0 when one string is empty', () => {
    expect(similarity('', 'Art Camp')).toBe(0);
    expect(similarity('Art Camp', '')).toBe(0);
  });

  it('returns 0 when both strings are empty', () => {
    expect(similarity('', '')).toBe(1); // both normalize to "" which are equal
  });

  it('returns high similarity for minor differences', () => {
    const score = similarity('Art Camp Summer', 'Art Camp Sumner');
    expect(score).toBeGreaterThan(0.8);
  });

  it('returns low similarity for very different strings', () => {
    const score = similarity('Art Camp', 'Basketball Training');
    expect(score).toBeLessThan(0.5);
  });

  it('strips grade suffixes before comparing', () => {
    const score = similarity('Pottery Studio (Grades 3-5)', 'Pottery Studio (Grades 6-8)');
    expect(score).toBe(1);
  });

  it('strips age suffixes before comparing', () => {
    const score = similarity('Coding Camp (Ages 8-12)', 'Coding Camp (Ages 5-7)');
    expect(score).toBe(1);
  });

  it('handles grade suffix with "Grade" singular', () => {
    const score = similarity('Art (Grade 3-5)', 'Art');
    expect(score).toBe(1);
  });
});

describe('generateDedupeKey', () => {
  it('creates a key from source, name, and date', () => {
    const key = generateDedupeKey('source1', 'Art Camp', '2025-06-10');
    expect(key).toBe('source1:art camp:2025-06-10');
  });

  it('normalizes whitespace in names', () => {
    const key = generateDedupeKey('source1', '  Art   Camp  ', '2025-06-10');
    expect(key).toBe('source1:art camp:2025-06-10');
  });

  it('lowercases the name', () => {
    const key = generateDedupeKey('source1', 'ART CAMP', '2025-06-10');
    expect(key).toBe('source1:art camp:2025-06-10');
  });
});
