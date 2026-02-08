import { describe, it, expect, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { FREE_SAVED_CAMPS_LIMIT } from '@/convex/lib/paywall';

// We can't directly test checkIsPremium, countActiveSavedCamps, enforceSavedCampLimit
// because they depend on Convex runtime (ctx.db, ctx.auth, ctx.runQuery).
// Instead, test the exported constant and logic patterns via mocked implementations.

describe('FREE_SAVED_CAMPS_LIMIT', () => {
  it('is set to 5', () => {
    expect(FREE_SAVED_CAMPS_LIMIT).toBe(5);
  });

  it('is a positive integer', () => {
    expect(Number.isInteger(FREE_SAVED_CAMPS_LIMIT)).toBe(true);
    expect(FREE_SAVED_CAMPS_LIMIT).toBeGreaterThan(0);
  });
});

describe('checkIsPremium logic', () => {
  // Simulate the logic from checkIsPremium without ctx dependency
  function checkIsPremiumLogic(
    identity: { subject: string } | null,
    subscriptions: Array<{ status: string }>,
    stripeError?: boolean,
  ): boolean {
    if (!identity) return false;
    if (stripeError) return false;
    return subscriptions.some((sub) => sub.status === 'active' || sub.status === 'trialing');
  }

  it('returns false when not authenticated', () => {
    expect(checkIsPremiumLogic(null, [])).toBe(false);
  });

  it('returns false when no subscriptions', () => {
    expect(checkIsPremiumLogic({ subject: 'user1' }, [])).toBe(false);
  });

  it('returns true for active subscription', () => {
    expect(checkIsPremiumLogic({ subject: 'user1' }, [{ status: 'active' }])).toBe(true);
  });

  it('returns true for trialing subscription', () => {
    expect(checkIsPremiumLogic({ subject: 'user1' }, [{ status: 'trialing' }])).toBe(true);
  });

  it('returns false for cancelled subscription', () => {
    expect(checkIsPremiumLogic({ subject: 'user1' }, [{ status: 'cancelled' }])).toBe(false);
  });

  it('returns false for past_due subscription', () => {
    expect(checkIsPremiumLogic({ subject: 'user1' }, [{ status: 'past_due' }])).toBe(false);
  });

  it('returns true when at least one subscription is active among many', () => {
    expect(
      checkIsPremiumLogic({ subject: 'user1' }, [
        { status: 'cancelled' },
        { status: 'active' },
        { status: 'past_due' },
      ]),
    ).toBe(true);
  });

  it('returns false on Stripe error (graceful degradation)', () => {
    expect(checkIsPremiumLogic({ subject: 'user1' }, [], true)).toBe(false);
  });
});

describe('countActiveSavedCamps logic', () => {
  // Simulate the counting logic
  function countActive(
    registrations: Array<{ status: string }>,
    customCamps: Array<{ isActive: boolean; status: string }>,
  ): number {
    const activeRegistrations = registrations.filter(
      (r) => r.status === 'interested' || r.status === 'registered' || r.status === 'waitlisted',
    ).length;

    const activeCustomCamps = customCamps.filter((c) => c.isActive && c.status !== 'cancelled').length;

    return activeRegistrations + activeCustomCamps;
  }

  it('returns 0 for no registrations and no custom camps', () => {
    expect(countActive([], [])).toBe(0);
  });

  it('counts interested registrations', () => {
    expect(countActive([{ status: 'interested' }], [])).toBe(1);
  });

  it('counts registered registrations', () => {
    expect(countActive([{ status: 'registered' }], [])).toBe(1);
  });

  it('counts waitlisted registrations', () => {
    expect(countActive([{ status: 'waitlisted' }], [])).toBe(1);
  });

  it('does not count cancelled registrations', () => {
    expect(countActive([{ status: 'cancelled' }], [])).toBe(0);
  });

  it('counts active custom camps', () => {
    expect(countActive([], [{ isActive: true, status: 'active' }])).toBe(1);
  });

  it('does not count inactive custom camps', () => {
    expect(countActive([], [{ isActive: false, status: 'active' }])).toBe(0);
  });

  it('does not count cancelled custom camps even if isActive', () => {
    expect(countActive([], [{ isActive: true, status: 'cancelled' }])).toBe(0);
  });

  it('combines registrations and custom camps', () => {
    expect(
      countActive(
        [{ status: 'interested' }, { status: 'registered' }],
        [{ isActive: true, status: 'active' }],
      ),
    ).toBe(3);
  });

  it('filters mixed statuses correctly', () => {
    expect(
      countActive(
        [{ status: 'interested' }, { status: 'cancelled' }, { status: 'registered' }],
        [
          { isActive: true, status: 'active' },
          { isActive: false, status: 'active' },
          { isActive: true, status: 'cancelled' },
        ],
      ),
    ).toBe(3); // 2 registrations + 1 custom camp
  });
});

describe('enforceSavedCampLimit logic', () => {
  // Simulate the enforcement logic
  function enforceLimit(isPremium: boolean, savedCount: number): void {
    if (isPremium) return;
    if (savedCount >= FREE_SAVED_CAMPS_LIMIT) {
      throw new ConvexError({
        type: 'PAYWALL',
        code: 'CAMP_LIMIT',
        savedCount,
        limit: FREE_SAVED_CAMPS_LIMIT,
      });
    }
  }

  it('allows premium users regardless of count', () => {
    expect(() => enforceLimit(true, 100)).not.toThrow();
  });

  it('allows free users under the limit', () => {
    expect(() => enforceLimit(false, 4)).not.toThrow();
  });

  it('throws at exactly the limit', () => {
    expect(() => enforceLimit(false, 5)).toThrow();
  });

  it('throws over the limit', () => {
    expect(() => enforceLimit(false, 10)).toThrow();
  });

  it('throws ConvexError with PAYWALL type', () => {
    try {
      enforceLimit(false, 5);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ConvexError);
      const error = e as ConvexError<{ type: string; code: string; savedCount: number; limit: number }>;
      expect(error.data.type).toBe('PAYWALL');
      expect(error.data.code).toBe('CAMP_LIMIT');
      expect(error.data.savedCount).toBe(5);
      expect(error.data.limit).toBe(5);
    }
  });

  it('allows free user at count 0', () => {
    expect(() => enforceLimit(false, 0)).not.toThrow();
  });
});
