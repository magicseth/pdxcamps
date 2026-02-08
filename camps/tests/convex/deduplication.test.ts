import { describe, it, expect } from 'vitest';
import { similarity, generateDedupeKey, normalizeName } from '@/convex/scraping/deduplication';

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

describe('normalizeName', () => {
  it('strips grade suffix in parentheses', () => {
    expect(normalizeName('Pottery Studio (Grades 3-5)')).toBe('pottery studio');
  });

  it('strips age suffix in parentheses', () => {
    expect(normalizeName('Coding Camp (Ages 8-12)')).toBe('coding camp');
  });

  it('strips singular "Grade" suffix', () => {
    expect(normalizeName('Art (Grade 3-5)')).toBe('art');
  });

  it('strips singular "Age" suffix', () => {
    expect(normalizeName('Art (Age 5-7)')).toBe('art');
  });

  it('lowercases the name', () => {
    expect(normalizeName('ART CAMP')).toBe('art camp');
  });

  it('trims whitespace', () => {
    expect(normalizeName('  art camp  ')).toBe('art camp');
  });

  it('handles empty string', () => {
    expect(normalizeName('')).toBe('');
  });

  it('handles undefined/null with fallback', () => {
    expect(normalizeName(undefined as unknown as string)).toBe('');
  });

  it('preserves name without grade/age suffix', () => {
    expect(normalizeName('Summer Adventure Camp')).toBe('summer adventure camp');
  });
});

describe('similarity edge cases', () => {
  it('handles single character strings', () => {
    const score = similarity('a', 'b');
    expect(score).toBe(0); // completely different single chars
  });

  it('returns high score for substring match', () => {
    const score = similarity('Art Camp', 'Art Camp Extended');
    expect(score).toBeGreaterThan(0.4);
  });

  it('handles names with grade suffixes from different ranges', () => {
    // Both normalize to same base name
    expect(similarity('Soccer (Grades K-2)', 'Soccer (Grades 3-5)')).toBe(1);
  });

  it('handles names with mixed age/grade suffixes', () => {
    expect(similarity('Tennis (Ages 5-7)', 'Tennis (Grades 1-3)')).toBe(1);
  });

  it('returns low score for completely unrelated names', () => {
    const score = similarity('Underwater Basket Weaving', 'Extreme Mountain Biking');
    expect(score).toBeLessThan(0.3);
  });

  it('handles unicode characters', () => {
    const score = similarity('Cafe Camp', 'Cafe Camp');
    expect(score).toBe(1);
  });
});
