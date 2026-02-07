import { describe, it, expect } from 'vitest';
import { CATEGORIES, GRADE_LABELS, DEFAULT_CHILD_COLORS, CHILD_COLOR_OPTIONS } from '@/lib/constants';

describe('CATEGORIES', () => {
  it('is a non-empty array', () => {
    expect(CATEGORIES.length).toBeGreaterThan(0);
  });

  it('contains expected camp categories', () => {
    expect(CATEGORIES).toContain('Sports');
    expect(CATEGORIES).toContain('Arts');
    expect(CATEGORIES).toContain('STEM');
  });
});

describe('GRADE_LABELS', () => {
  it('covers grades -2 through 12', () => {
    for (let grade = -2; grade <= 12; grade++) {
      expect(GRADE_LABELS[grade]).toBeDefined();
      expect(typeof GRADE_LABELS[grade]).toBe('string');
    }
  });

  it('has correct labels for known grades', () => {
    expect(GRADE_LABELS[-2]).toBe('Preschool');
    expect(GRADE_LABELS[-1]).toBe('Pre-K');
    expect(GRADE_LABELS[0]).toBe('Kindergarten');
    expect(GRADE_LABELS[1]).toBe('1st Grade');
    expect(GRADE_LABELS[12]).toBe('12th Grade');
  });
});

describe('DEFAULT_CHILD_COLORS', () => {
  it('has 8 colors', () => {
    expect(DEFAULT_CHILD_COLORS).toHaveLength(8);
  });

  it('contains valid hex color strings', () => {
    for (const color of DEFAULT_CHILD_COLORS) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('CHILD_COLOR_OPTIONS', () => {
  it('has the same number of entries as DEFAULT_CHILD_COLORS', () => {
    expect(CHILD_COLOR_OPTIONS).toHaveLength(DEFAULT_CHILD_COLORS.length);
  });

  it('has matching values with DEFAULT_CHILD_COLORS', () => {
    const optionValues = CHILD_COLOR_OPTIONS.map((o) => o.value);
    for (const color of DEFAULT_CHILD_COLORS) {
      expect(optionValues).toContain(color);
    }
  });

  it('each option has a value and label', () => {
    for (const option of CHILD_COLOR_OPTIONS) {
      expect(option.value).toBeTruthy();
      expect(option.label).toBeTruthy();
    }
  });
});
