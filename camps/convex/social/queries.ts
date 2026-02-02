import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireFamily, getFamily } from "../lib/auth";

/**
 * List all accepted friendships for the current family.
 * Returns friend family info for both directions (where family is requester or addressee).
 */
export const listFriends = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    // Get friendships where current family is the requester
    const asRequester = await ctx.db
      .query("friendships")
      .withIndex("by_requester_and_status", (q) =>
        q.eq("requesterId", family._id).eq("status", "accepted")
      )
      .collect();

    // Get friendships where current family is the addressee
    const asAddressee = await ctx.db
      .query("friendships")
      .withIndex("by_addressee_and_status", (q) =>
        q.eq("addresseeId", family._id).eq("status", "accepted")
      )
      .collect();

    // Collect friend family IDs
    const friendFamilyIds = [
      ...asRequester.map((f) => f.addresseeId),
      ...asAddressee.map((f) => f.requesterId),
    ];

    // Fetch friend family info
    const friendFamilies = await Promise.all(
      friendFamilyIds.map((id) => ctx.db.get(id))
    );

    // Build result with friendship info and friend details
    const allFriendships = [...asRequester, ...asAddressee];
    return allFriendships.map((friendship, index) => {
      const friendFamily = friendFamilies[index];
      return {
        friendshipId: friendship._id,
        acceptedAt: friendship.acceptedAt,
        friend: friendFamily
          ? {
              _id: friendFamily._id,
              displayName: friendFamily.displayName,
              primaryCityId: friendFamily.primaryCityId,
            }
          : null,
      };
    });
  },
});

/**
 * List pending friend requests for the current family.
 * Returns both sent and received requests.
 */
export const listPendingFriendRequests = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);
    if (!family) {
      return { sent: [], received: [] };
    }

    // Get pending requests sent by current family
    const sent = await ctx.db
      .query("friendships")
      .withIndex("by_requester_and_status", (q) =>
        q.eq("requesterId", family._id).eq("status", "pending")
      )
      .collect();

    // Get pending requests received by current family
    const received = await ctx.db
      .query("friendships")
      .withIndex("by_addressee_and_status", (q) =>
        q.eq("addresseeId", family._id).eq("status", "pending")
      )
      .collect();

    // Fetch addressee info for sent requests
    const sentFamilies = await Promise.all(
      sent.map((f) => ctx.db.get(f.addresseeId))
    );

    // Fetch requester info for received requests
    const receivedFamilies = await Promise.all(
      received.map((f) => ctx.db.get(f.requesterId))
    );

    return {
      sent: sent.map((request, index) => ({
        friendshipId: request._id,
        createdAt: request._creationTime,
        addressee: sentFamilies[index]
          ? {
              _id: sentFamilies[index]!._id,
              displayName: sentFamilies[index]!.displayName,
              email: sentFamilies[index]!.email,
            }
          : null,
      })),
      received: received.map((request, index) => ({
        friendshipId: request._id,
        createdAt: request._creationTime,
        requester: receivedFamilies[index]
          ? {
              _id: receivedFamilies[index]!._id,
              displayName: receivedFamilies[index]!.displayName,
              email: receivedFamilies[index]!.email,
            }
          : null,
      })),
    };
  },
});

/**
 * Get friends who have registered their children for a specific session.
 * Only shows friends who have shared their calendar with the current family.
 */
export const getFriendsAtSession = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    // Get all calendar shares where this family is the recipient
    const calendarShares = await ctx.db
      .query("calendarShares")
      .withIndex("by_shared_with", (q) => q.eq("sharedWithFamilyId", family._id))
      .collect();

    // Filter to active shares only
    const activeShares = calendarShares.filter((share) => share.isActive);

    if (activeShares.length === 0) {
      return [];
    }

    // Get registrations for this session
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Filter to registered or waitlisted statuses
    const activeRegistrations = registrations.filter(
      (r) => r.status === "registered" || r.status === "waitlisted"
    );

    // Build a map of family -> their calendar share info
    const shareByFamily = new Map(
      activeShares.map((share) => [share.ownerFamilyId.toString(), share])
    );

    // Find registrations from families that have shared with us
    const friendRegistrations = activeRegistrations.filter((reg) => {
      const share = shareByFamily.get(reg.familyId.toString());
      if (!share) return false;
      // Check if this child is included in the share
      return share.childIds.includes(reg.childId);
    });

    // Get unique family IDs and their registrations
    const familyRegistrationsMap = new Map<
      string,
      { familyId: typeof friendRegistrations[0]["familyId"]; childIds: typeof friendRegistrations[0]["childId"][]; share: typeof activeShares[0] }
    >();

    for (const reg of friendRegistrations) {
      const familyIdStr = reg.familyId.toString();
      const share = shareByFamily.get(familyIdStr)!;

      if (!familyRegistrationsMap.has(familyIdStr)) {
        familyRegistrationsMap.set(familyIdStr, {
          familyId: reg.familyId,
          childIds: [],
          share,
        });
      }
      familyRegistrationsMap.get(familyIdStr)!.childIds.push(reg.childId);
    }

    // Fetch family and children details
    const results = [];
    for (const [, data] of familyRegistrationsMap) {
      const friendFamily = await ctx.db.get(data.familyId);
      if (!friendFamily) continue;

      // Fetch children info based on permission level
      const children = await Promise.all(
        data.childIds.map((childId) => ctx.db.get(childId))
      );

      const childrenInfo = children
        .filter(Boolean)
        .map((child) => {
          // view_sessions shows only first name, view_details shows more
          if (data.share.permission === "view_details") {
            return {
              _id: child!._id,
              firstName: child!.firstName,
              lastName: child!.lastName,
            };
          }
          return {
            _id: child!._id,
            firstName: child!.firstName,
          };
        });

      results.push({
        family: {
          _id: friendFamily._id,
          displayName: friendFamily.displayName,
        },
        children: childrenInfo,
        permission: data.share.permission,
      });
    }

    return results;
  },
});

/**
 * Get calendars shared with the current family.
 * Returns list of families sharing their calendars and what permission level.
 */
export const getSharedCalendars = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    const calendarShares = await ctx.db
      .query("calendarShares")
      .withIndex("by_shared_with", (q) => q.eq("sharedWithFamilyId", family._id))
      .collect();

    // Filter to active shares
    const activeShares = calendarShares.filter((share) => share.isActive);

    // Fetch owner family info
    const results = await Promise.all(
      activeShares.map(async (share) => {
        const ownerFamily = await ctx.db.get(share.ownerFamilyId);
        const children = await Promise.all(
          share.childIds.map((childId) => ctx.db.get(childId))
        );

        return {
          shareId: share._id,
          permission: share.permission,
          owner: ownerFamily
            ? {
                _id: ownerFamily._id,
                displayName: ownerFamily.displayName,
              }
            : null,
          children: children.filter(Boolean).map((child) => ({
            _id: child!._id,
            firstName: child!.firstName,
          })),
        };
      })
    );

    return results;
  },
});

/**
 * Get the current family's outgoing calendar shares (shares they've created).
 * Returns list of shares with recipient family info, children, and permission level.
 */
export const getMyCalendarShares = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    const calendarShares = await ctx.db
      .query("calendarShares")
      .withIndex("by_owner", (q) => q.eq("ownerFamilyId", family._id))
      .collect();

    // Filter to active shares
    const activeShares = calendarShares.filter((share) => share.isActive);

    // Fetch recipient family info and children details
    const results = await Promise.all(
      activeShares.map(async (share) => {
        const sharedWithFamily = await ctx.db.get(share.sharedWithFamilyId);
        const children = await Promise.all(
          share.childIds.map((childId) => ctx.db.get(childId))
        );

        return {
          shareId: share._id,
          permission: share.permission,
          sharedWith: sharedWithFamily
            ? {
                _id: sharedWithFamily._id,
                displayName: sharedWithFamily.displayName,
              }
            : null,
          children: children.filter(Boolean).map((child) => ({
            _id: child!._id,
            firstName: child!.firstName,
          })),
        };
      })
    );

    return results;
  },
});

/**
 * Get a friend's calendar if they've shared it with the current family.
 * Returns registrations for the shared children based on permission level.
 */
export const getFriendCalendar = query({
  args: {
    friendFamilyId: v.id("families"),
  },
  handler: async (ctx, args) => {
    const family = await getFamily(ctx);
    if (!family) {
      return null;
    }

    // Check if this friend has shared their calendar with us
    const calendarShares = await ctx.db
      .query("calendarShares")
      .withIndex("by_shared_with", (q) => q.eq("sharedWithFamilyId", family._id))
      .collect();

    const share = calendarShares.find(
      (s) => s.ownerFamilyId === args.friendFamilyId && s.isActive
    );

    if (!share) {
      return null;
    }

    // Get the friend's family info
    const friendFamily = await ctx.db.get(args.friendFamilyId);
    if (!friendFamily) {
      return null;
    }

    // Get children info for shared children
    const children = await Promise.all(
      share.childIds.map((childId) => ctx.db.get(childId))
    );

    const validChildren = children.filter(Boolean);

    // Get registrations for each shared child
    const registrationsByChild = await Promise.all(
      validChildren.map(async (child) => {
        const registrations = await ctx.db
          .query("registrations")
          .withIndex("by_child", (q) => q.eq("childId", child!._id))
          .collect();

        // Filter to active registrations
        const activeRegistrations = registrations.filter(
          (r) =>
            r.status === "registered" ||
            r.status === "waitlisted" ||
            r.status === "interested"
        );

        // Get session details for each registration
        const registrationsWithSessions = await Promise.all(
          activeRegistrations.map(async (reg) => {
            const session = await ctx.db.get(reg.sessionId);
            if (!session) return null;

            // Get camp info
            const camp = await ctx.db.get(session.campId);

            // Base info available at view_sessions level
            const baseInfo = {
              registrationId: reg._id,
              status: reg.status,
              session: {
                _id: session._id,
                startDate: session.startDate,
                endDate: session.endDate,
                dropOffTime: session.dropOffTime,
                pickUpTime: session.pickUpTime,
              },
              camp: camp
                ? {
                    _id: camp._id,
                    name: camp.name,
                  }
                : null,
            };

            // Additional info at view_details level
            if (share.permission === "view_details") {
              return {
                ...baseInfo,
                session: {
                  ...baseInfo.session,
                  price: session.price,
                  currency: session.currency,
                },
                notes: reg.notes,
              };
            }

            return baseInfo;
          })
        );

        // Build child info based on permission level
        const childInfo =
          share.permission === "view_details"
            ? {
                _id: child!._id,
                firstName: child!.firstName,
                lastName: child!.lastName,
                birthdate: child!.birthdate,
              }
            : {
                _id: child!._id,
                firstName: child!.firstName,
              };

        return {
          child: childInfo,
          registrations: registrationsWithSessions.filter(Boolean),
        };
      })
    );

    return {
      family: {
        _id: friendFamily._id,
        displayName: friendFamily.displayName,
      },
      permission: share.permission,
      calendar: registrationsByChild,
    };
  },
});
