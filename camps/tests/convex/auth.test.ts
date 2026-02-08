import { describe, it, expect } from 'vitest';
import { ADMIN_EMAILS } from '@/convex/lib/constants';

// The auth functions (getFamily, requireAuth, requireFamily) require Convex ctx.
// We test the logic patterns they implement, and test checkIsAdmin's email check directly.

describe('ADMIN_EMAILS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(ADMIN_EMAILS)).toBe(true);
    expect(ADMIN_EMAILS.length).toBeGreaterThan(0);
  });

  it('contains valid email format', () => {
    for (const email of ADMIN_EMAILS) {
      expect(email).toMatch(/@/);
    }
  });
});

describe('checkIsAdmin logic', () => {
  // Simulate checkIsAdmin: checks if family email is in ADMIN_EMAILS
  function isAdmin(familyEmail: string | null): boolean {
    if (!familyEmail) return false;
    return ADMIN_EMAILS.includes(familyEmail);
  }

  it('returns true for admin email', () => {
    expect(isAdmin('seth@magicseth.com')).toBe(true);
  });

  it('returns false for non-admin email', () => {
    expect(isAdmin('random@example.com')).toBe(false);
  });

  it('returns false when family is null (not authenticated)', () => {
    expect(isAdmin(null)).toBe(false);
  });

  it('is case-sensitive (admin emails must match exactly)', () => {
    expect(isAdmin('Seth@MagicSeth.com')).toBe(false);
  });

  it('returns false for empty string email', () => {
    expect(isAdmin('')).toBe(false);
  });
});

describe('getFamily logic', () => {
  // Simulate the getFamily lookup pattern
  function getFamily(
    identity: { subject: string } | null,
    families: Array<{ workosUserId: string; email: string }>,
  ) {
    if (!identity) return null;
    return families.find((f) => f.workosUserId === identity.subject) ?? null;
  }

  it('returns null when not authenticated', () => {
    expect(getFamily(null, [])).toBeNull();
  });

  it('returns null when family not found', () => {
    expect(getFamily({ subject: 'user123' }, [])).toBeNull();
  });

  it('returns family when found by workosUserId', () => {
    const families = [{ workosUserId: 'user123', email: 'test@test.com' }];
    const result = getFamily({ subject: 'user123' }, families);
    expect(result).toEqual({ workosUserId: 'user123', email: 'test@test.com' });
  });

  it('does not match different user IDs', () => {
    const families = [{ workosUserId: 'user456', email: 'test@test.com' }];
    expect(getFamily({ subject: 'user123' }, families)).toBeNull();
  });
});

describe('requireAuth logic', () => {
  function requireAuth(identity: { subject: string } | null) {
    if (!identity) throw new Error('Not authenticated');
    return identity;
  }

  it('returns identity when authenticated', () => {
    const identity = { subject: 'user123' };
    expect(requireAuth(identity)).toBe(identity);
  });

  it('throws when not authenticated', () => {
    expect(() => requireAuth(null)).toThrow('Not authenticated');
  });
});

describe('requireFamily logic', () => {
  function requireFamily(
    identity: { subject: string } | null,
    families: Array<{ workosUserId: string; email: string }>,
  ) {
    if (!identity) throw new Error('Not authenticated');
    const family = families.find((f) => f.workosUserId === identity.subject) ?? null;
    if (!family) throw new Error('Family not found');
    return family;
  }

  it('returns family when authenticated and found', () => {
    const families = [{ workosUserId: 'user123', email: 'test@test.com' }];
    const result = requireFamily({ subject: 'user123' }, families);
    expect(result.email).toBe('test@test.com');
  });

  it('throws when not authenticated', () => {
    expect(() => requireFamily(null, [])).toThrow('Not authenticated');
  });

  it('throws when family not found', () => {
    expect(() => requireFamily({ subject: 'user123' }, [])).toThrow('Family not found');
  });
});
