import { query } from '../_generated/server';
import { v } from 'convex/values';
import { getFamily } from '../lib/auth';

/**
 * Get calendar events for a family's saved camps.
 * Returns data suitable for iCal/Google Calendar export.
 */
export const getCalendarEvents = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);
    if (!family) return [];

    // Get all interested/registered registrations for this family
    const registrations = await ctx.db
      .query('registrations')
      .withIndex('by_family', (q) => q.eq('familyId', family._id))
      .collect();

    const activeRegs = registrations.filter(
      (r) => r.status === 'interested' || r.status === 'registered',
    );

    // Batch fetch sessions
    const sessionIds = [...new Set(activeRegs.map((r) => r.sessionId))];
    const sessions = await Promise.all(sessionIds.map((id) => ctx.db.get(id)));
    const sessionMap = new Map(sessions.filter(Boolean).map((s) => [s!._id, s!]));

    // Batch fetch children
    const childIds = [...new Set(activeRegs.map((r) => r.childId))];
    const children = await Promise.all(childIds.map((id) => ctx.db.get(id)));
    const childMap = new Map(children.filter(Boolean).map((c) => [c!._id, c!]));

    // Build calendar events
    const events = [];
    for (const reg of activeRegs) {
      const session = sessionMap.get(reg.sessionId);
      if (!session || session.status !== 'active') continue;

      const child = childMap.get(reg.childId);
      const location = session.locationId ? await ctx.db.get(session.locationId) : null;

      const childName = child ? `${child.firstName}` : '';
      const title = childName
        ? `${session.campName ?? 'Camp'} - ${childName}`
        : session.campName ?? 'Camp';

      let locationStr = session.locationName ?? '';
      if (location?.address) {
        const addr = location.address;
        locationStr = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
      }

      events.push({
        id: reg._id,
        title,
        startDate: session.startDate,
        endDate: session.endDate,
        startTime: session.dropOffTime,
        endTime: session.pickUpTime,
        location: locationStr,
        description: [
          `Org: ${session.organizationName ?? ''}`,
          session.price > 0 ? `Price: $${(session.price / 100).toFixed(2)}` : 'Free',
          reg.status === 'registered' ? 'Status: Registered' : 'Status: Interested',
          session.externalRegistrationUrl ? `Register: ${session.externalRegistrationUrl}` : '',
        ].filter(Boolean).join('\n'),
        status: reg.status,
        isOvernight: session.isOvernight,
      });
    }

    events.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return events;
  },
});

/**
 * Get calendar events by share token (for iCal subscription feed).
 * No auth required - token-based access.
 */
export const getCalendarEventsByToken = query({
  args: {
    shareToken: v.string(),
  },
  handler: async (ctx, args) => {
    // Look up the family share
    const share = await ctx.db
      .query('familyShares')
      .withIndex('by_token', (q) => q.eq('shareToken', args.shareToken))
      .first();

    if (!share) return [];

    const family = await ctx.db.get(share.familyId);
    if (!family) return [];

    // Get registrations for the shared children
    const registrations = await ctx.db
      .query('registrations')
      .withIndex('by_family', (q) => q.eq('familyId', family._id))
      .collect();

    const activeRegs = registrations.filter(
      (r) =>
        (r.status === 'interested' || r.status === 'registered') &&
        share.childIds.includes(r.childId),
    );

    const sessionIds = [...new Set(activeRegs.map((r) => r.sessionId))];
    const sessions = await Promise.all(sessionIds.map((id) => ctx.db.get(id)));
    const sessionMap = new Map(sessions.filter(Boolean).map((s) => [s!._id, s!]));

    const childIds = [...new Set(activeRegs.map((r) => r.childId))];
    const children = await Promise.all(childIds.map((id) => ctx.db.get(id)));
    const childMap = new Map(children.filter(Boolean).map((c) => [c!._id, c!]));

    const events = [];
    for (const reg of activeRegs) {
      const session = sessionMap.get(reg.sessionId);
      if (!session || session.status !== 'active') continue;

      const child = childMap.get(reg.childId);
      const location = session.locationId ? await ctx.db.get(session.locationId) : null;

      const childName = child ? `${child.firstName}` : '';
      const title = childName
        ? `${session.campName ?? 'Camp'} - ${childName}`
        : session.campName ?? 'Camp';

      let locationStr = session.locationName ?? '';
      if (location?.address) {
        const addr = location.address;
        locationStr = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
      }

      events.push({
        id: reg._id,
        title,
        startDate: session.startDate,
        endDate: session.endDate,
        startTime: session.dropOffTime,
        endTime: session.pickUpTime,
        location: locationStr,
        description: `Org: ${session.organizationName ?? ''}`,
        status: reg.status,
        isOvernight: session.isOvernight,
      });
    }

    events.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return events;
  },
});
