import { query } from '../_generated/server';
import { v } from 'convex/values';
import { Doc, Id } from '../_generated/dataModel';
import { getFamily } from '../lib/auth';
import { registrationStatusValidator } from '../lib/validators';

/**
 * Get all registrations for the current family within a date range.
 * Returns registrations with full session, camp, location, and organization details.
 */
export const getFamilyCalendar = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    statuses: v.optional(v.array(registrationStatusValidator)),
  },
  handler: async (ctx, args) => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    // Get registrations for the family
    let registrations = await ctx.db
      .query('registrations')
      .withIndex('by_family', (q) => q.eq('familyId', family._id))
      .collect();

    // Filter by status if specified
    if (args.statuses && args.statuses.length > 0) {
      registrations = registrations.filter((reg) => args.statuses!.includes(reg.status));
    }

    // Fetch all related sessions
    const sessionIds = Array.from(new Set(registrations.map((r) => r.sessionId)));
    const sessionsRaw = await Promise.all(sessionIds.map((id) => ctx.db.get(id)));
    const sessions = sessionsRaw.filter((s): s is Doc<'sessions'> => s !== null);
    const sessionMap = new Map(sessions.map((s) => [s._id, s]));

    // Filter registrations by session date range
    registrations = registrations.filter((reg) => {
      const session = sessionMap.get(reg.sessionId);
      if (!session) return false;
      // Include if session overlaps with the date range
      return session.startDate <= args.endDate && session.endDate >= args.startDate;
    });

    // Collect all unique IDs for batch fetching
    const campIds = Array.from(new Set(sessions.map((s) => s.campId)));
    const locationIds = Array.from(new Set(sessions.map((s) => s.locationId)));
    const organizationIds = Array.from(new Set(sessions.map((s) => s.organizationId)));
    const childIds = Array.from(new Set(registrations.map((r) => r.childId)));

    // Batch fetch all related entities
    const [campsRaw, locationsRaw, organizationsRaw, childrenRaw] = await Promise.all([
      Promise.all(campIds.map((id) => ctx.db.get(id))),
      Promise.all(locationIds.map((id) => ctx.db.get(id))),
      Promise.all(organizationIds.map((id) => ctx.db.get(id))),
      Promise.all(childIds.map((id) => ctx.db.get(id))),
    ]);

    // Create lookup maps with proper typing
    const camps = campsRaw.filter((c): c is Doc<'camps'> => c !== null);
    const locations = locationsRaw.filter((l): l is Doc<'locations'> => l !== null);
    const organizations = organizationsRaw.filter((o): o is Doc<'organizations'> => o !== null);
    const children = childrenRaw.filter((c): c is Doc<'children'> => c !== null);

    const campMap = new Map(camps.map((c) => [c._id, c]));
    const locationMap = new Map(locations.map((l) => [l._id, l]));
    const organizationMap = new Map(organizations.map((o) => [o._id, o]));
    const childMap = new Map(children.map((c) => [c._id, c]));

    // Build enriched results
    return registrations.map((registration) => {
      const session = sessionMap.get(registration.sessionId);
      const camp = session ? campMap.get(session.campId) : null;
      const location = session ? locationMap.get(session.locationId) : null;
      const organization = session ? organizationMap.get(session.organizationId) : null;
      const child = childMap.get(registration.childId);

      return {
        ...registration,
        child: child ?? null,
        session: session
          ? {
              ...session,
              camp: camp ?? null,
              location: location ?? null,
              organization: organization ?? null,
            }
          : null,
      };
    });
  },
});

/**
 * Get a specific registration with full session details.
 * Verifies the registration belongs to the current family.
 */
export const getRegistration = query({
  args: {
    registrationId: v.id('registrations'),
  },
  handler: async (ctx, args) => {
    const family = await getFamily(ctx);
    if (!family) {
      return null;
    }

    const registration = await ctx.db.get(args.registrationId);
    if (!registration) {
      return null;
    }

    // Verify the registration belongs to the current family
    if (registration.familyId !== family._id) {
      return null;
    }

    // Fetch the session and related entities
    const session = await ctx.db.get(registration.sessionId);
    if (!session) {
      return { ...registration, session: null, child: null };
    }

    const [camp, location, organization, child] = await Promise.all([
      ctx.db.get(session.campId),
      ctx.db.get(session.locationId),
      ctx.db.get(session.organizationId),
      ctx.db.get(registration.childId),
    ]);

    return {
      ...registration,
      child: child ?? null,
      session: {
        ...session,
        camp: camp ?? null,
        location: location ?? null,
        organization: organization ?? null,
      },
    };
  },
});

/**
 * Get all registrations for a session.
 * Useful for seeing who's attending a session.
 * Only returns basic registration info (not full family details for privacy).
 */
export const getRegistrationsBySession = query({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const family = await getFamily(ctx);

    // Get all registrations for this session
    const registrations = await ctx.db
      .query('registrations')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect();

    // Get unique child IDs
    const childIds = Array.from(new Set(registrations.map((r) => r.childId)));
    const childrenRaw = await Promise.all(childIds.map((id) => ctx.db.get(id)));
    const children = childrenRaw.filter((c): c is Doc<'children'> => c !== null);
    const childMap = new Map(children.map((c) => [c._id, c]));

    // Return registrations with child first name only (for privacy)
    return registrations.map((registration) => {
      const child = childMap.get(registration.childId);
      const isOwnFamily = family !== null && registration.familyId === family._id;

      return {
        _id: registration._id,
        status: registration.status,
        waitlistPosition: registration.waitlistPosition,
        // Only show full details for own family's registrations
        childFirstName: child?.firstName ?? 'Unknown',
        isOwnFamily,
        // Include notes only for own family
        notes: isOwnFamily ? registration.notes : undefined,
        externalConfirmationCode: isOwnFamily ? registration.externalConfirmationCode : undefined,
      };
    });
  },
});

/**
 * Get registrations for a specific child within a date range.
 * Verifies the child belongs to the current family.
 */
export const getChildCalendar = query({
  args: {
    childId: v.id('children'),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    // Verify the child belongs to the current family
    const child = await ctx.db.get(args.childId);
    if (!child || child.familyId !== family._id) {
      return [];
    }

    // Get registrations for this child
    const registrations = await ctx.db
      .query('registrations')
      .withIndex('by_child', (q) => q.eq('childId', args.childId))
      .collect();

    // Fetch all sessions
    const sessionIds = Array.from(new Set(registrations.map((r) => r.sessionId)));
    const sessionsRaw = await Promise.all(sessionIds.map((id) => ctx.db.get(id)));
    const sessions = sessionsRaw.filter((s): s is Doc<'sessions'> => s !== null);
    const sessionMap = new Map(sessions.map((s) => [s._id, s]));

    // Filter by date range
    const filteredRegistrations = registrations.filter((reg) => {
      const session = sessionMap.get(reg.sessionId);
      if (!session) return false;
      return session.startDate <= args.endDate && session.endDate >= args.startDate;
    });

    // Collect IDs for batch fetching
    const campIds = Array.from(new Set(sessions.map((s) => s.campId)));
    const locationIds = Array.from(new Set(sessions.map((s) => s.locationId)));
    const organizationIds = Array.from(new Set(sessions.map((s) => s.organizationId)));

    const [campsRaw, locationsRaw, organizationsRaw] = await Promise.all([
      Promise.all(campIds.map((id) => ctx.db.get(id))),
      Promise.all(locationIds.map((id) => ctx.db.get(id))),
      Promise.all(organizationIds.map((id) => ctx.db.get(id))),
    ]);

    const camps = campsRaw.filter((c): c is Doc<'camps'> => c !== null);
    const locations = locationsRaw.filter((l): l is Doc<'locations'> => l !== null);
    const organizations = organizationsRaw.filter((o): o is Doc<'organizations'> => o !== null);

    const campMap = new Map(camps.map((c) => [c._id, c]));
    const locationMap = new Map(locations.map((l) => [l._id, l]));
    const organizationMap = new Map(organizations.map((o) => [o._id, o]));

    return filteredRegistrations.map((registration) => {
      const session = sessionMap.get(registration.sessionId);
      const camp = session ? campMap.get(session.campId) : null;
      const location = session ? locationMap.get(session.locationId) : null;
      const organization = session ? organizationMap.get(session.organizationId) : null;

      return {
        ...registration,
        child,
        session: session
          ? {
              ...session,
              camp: camp ?? null,
              location: location ?? null,
              organization: organization ?? null,
            }
          : null,
      };
    });
  },
});

/**
 * Get all saved camps for the current family, organized by status.
 * Returns camps with full details including registration URLs.
 */
export const getSavedCamps = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);
    if (!family) {
      return {
        interested: [],
        registered: [],
        waitlisted: [],
        cancelled: [],
      };
    }

    // Get all registrations for the family
    const registrations = await ctx.db
      .query('registrations')
      .withIndex('by_family', (q) => q.eq('familyId', family._id))
      .collect();

    // Fetch all related sessions
    const sessionIds = Array.from(new Set(registrations.map((r) => r.sessionId)));
    const sessionsRaw = await Promise.all(sessionIds.map((id) => ctx.db.get(id)));
    const sessions = sessionsRaw.filter((s): s is Doc<'sessions'> => s !== null);
    const sessionMap = new Map(sessions.map((s) => [s._id, s]));

    // Collect all unique IDs for batch fetching
    const campIds = Array.from(new Set(sessions.map((s) => s.campId)));
    const locationIds = Array.from(new Set(sessions.map((s) => s.locationId)));
    const organizationIds = Array.from(new Set(sessions.map((s) => s.organizationId)));
    const childIds = Array.from(new Set(registrations.map((r) => r.childId)));

    // Batch fetch all related entities
    const [campsRaw, locationsRaw, organizationsRaw, childrenRaw] = await Promise.all([
      Promise.all(campIds.map((id) => ctx.db.get(id))),
      Promise.all(locationIds.map((id) => ctx.db.get(id))),
      Promise.all(organizationIds.map((id) => ctx.db.get(id))),
      Promise.all(childIds.map((id) => ctx.db.get(id))),
    ]);

    // Create lookup maps
    const camps = campsRaw.filter((c): c is Doc<'camps'> => c !== null);
    const locations = locationsRaw.filter((l): l is Doc<'locations'> => l !== null);
    const organizations = organizationsRaw.filter((o): o is Doc<'organizations'> => o !== null);
    const children = childrenRaw.filter((c): c is Doc<'children'> => c !== null);

    const campMap = new Map(camps.map((c) => [c._id, c]));
    const locationMap = new Map(locations.map((l) => [l._id, l]));
    const organizationMap = new Map(organizations.map((o) => [o._id, o]));
    const childMap = new Map(children.map((c) => [c._id, c]));

    // Build enriched registrations
    const enrichedRegistrations = registrations.map((registration) => {
      const session = sessionMap.get(registration.sessionId);
      const camp = session ? campMap.get(session.campId) : null;
      const location = session ? locationMap.get(session.locationId) : null;
      const organization = session ? organizationMap.get(session.organizationId) : null;
      const child = childMap.get(registration.childId);

      return {
        ...registration,
        child: child ?? null,
        session: session
          ? {
              ...session,
              camp: camp ?? null,
              location: location ?? null,
              organization: organization ?? null,
            }
          : null,
      };
    });

    // Sort by session start date
    const sortByDate = (a: (typeof enrichedRegistrations)[0], b: (typeof enrichedRegistrations)[0]) => {
      const dateA = a.session?.startDate ?? '';
      const dateB = b.session?.startDate ?? '';
      return dateA.localeCompare(dateB);
    };

    // Group by status
    return {
      interested: enrichedRegistrations.filter((r) => r.status === 'interested').sort(sortByDate),
      registered: enrichedRegistrations.filter((r) => r.status === 'registered').sort(sortByDate),
      waitlisted: enrichedRegistrations.filter((r) => r.status === 'waitlisted').sort(sortByDate),
      cancelled: enrichedRegistrations.filter((r) => r.status === 'cancelled').sort(sortByDate),
    };
  },
});
