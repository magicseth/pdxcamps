import { describe, it, expect } from 'vitest';
import { resolveCampName } from '@/convex/lib/helpers';
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
