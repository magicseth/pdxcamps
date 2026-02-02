import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireFamily, getFamily } from "../lib/auth";
import { friendshipStatusValidator } from "../lib/validators";

/**
 * Send a friend request by email.
 * Creates a pending friendship request.
 */
export const sendFriendRequest = mutation({
  args: {
    addresseeEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Find the family by email
    const addressee = await ctx.db
      .query("families")
      .withIndex("by_email", (q) => q.eq("email", args.addresseeEmail))
      .unique();

    if (!addressee) {
      throw new Error("No family found with that email address");
    }

    // Cannot friend yourself
    if (addressee._id === family._id) {
      throw new Error("Cannot send a friend request to yourself");
    }

    // Check if a friendship already exists between these families
    const existingAsRequester = await ctx.db
      .query("friendships")
      .withIndex("by_requester_and_addressee", (q) =>
        q.eq("requesterId", family._id).eq("addresseeId", addressee._id)
      )
      .unique();

    if (existingAsRequester) {
      if (existingAsRequester.status === "pending") {
        throw new Error("Friend request already sent");
      }
      if (existingAsRequester.status === "accepted") {
        throw new Error("You are already friends with this family");
      }
      if (existingAsRequester.status === "blocked") {
        throw new Error("Cannot send friend request to this family");
      }
      // If declined, allow re-requesting
      if (existingAsRequester.status === "declined") {
        await ctx.db.patch(existingAsRequester._id, {
          status: "pending",
        });
        return existingAsRequester._id;
      }
    }

    const existingAsAddressee = await ctx.db
      .query("friendships")
      .withIndex("by_requester_and_addressee", (q) =>
        q.eq("requesterId", addressee._id).eq("addresseeId", family._id)
      )
      .unique();

    if (existingAsAddressee) {
      if (existingAsAddressee.status === "pending") {
        // They already sent us a request, auto-accept it
        await ctx.db.patch(existingAsAddressee._id, {
          status: "accepted",
          acceptedAt: Date.now(),
        });
        return existingAsAddressee._id;
      }
      if (existingAsAddressee.status === "accepted") {
        throw new Error("You are already friends with this family");
      }
      if (existingAsAddressee.status === "blocked") {
        throw new Error("Cannot send friend request to this family");
      }
    }

    // Create new friend request
    const friendshipId = await ctx.db.insert("friendships", {
      requesterId: family._id,
      addresseeId: addressee._id,
      status: "pending",
    });

    return friendshipId;
  },
});

/**
 * Accept a pending friend request.
 */
export const acceptFriendRequest = mutation({
  args: {
    friendshipId: v.id("friendships"),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const friendship = await ctx.db.get(args.friendshipId);
    if (!friendship) {
      throw new Error("Friend request not found");
    }

    // Only the addressee can accept
    if (friendship.addresseeId !== family._id) {
      throw new Error("You cannot accept this friend request");
    }

    if (friendship.status !== "pending") {
      throw new Error("This friend request is no longer pending");
    }

    await ctx.db.patch(args.friendshipId, {
      status: "accepted",
      acceptedAt: Date.now(),
    });

    return args.friendshipId;
  },
});

/**
 * Decline a friend request.
 */
export const declineFriendRequest = mutation({
  args: {
    friendshipId: v.id("friendships"),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const friendship = await ctx.db.get(args.friendshipId);
    if (!friendship) {
      throw new Error("Friend request not found");
    }

    // Only the addressee can decline
    if (friendship.addresseeId !== family._id) {
      throw new Error("You cannot decline this friend request");
    }

    if (friendship.status !== "pending") {
      throw new Error("This friend request is no longer pending");
    }

    await ctx.db.patch(args.friendshipId, {
      status: "declined",
    });

    return args.friendshipId;
  },
});

/**
 * Remove an existing friendship.
 * Either party can remove a friendship.
 */
export const removeFriend = mutation({
  args: {
    friendshipId: v.id("friendships"),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const friendship = await ctx.db.get(args.friendshipId);
    if (!friendship) {
      throw new Error("Friendship not found");
    }

    // Either party can remove the friendship
    if (
      friendship.requesterId !== family._id &&
      friendship.addresseeId !== family._id
    ) {
      throw new Error("You are not part of this friendship");
    }

    if (friendship.status !== "accepted") {
      throw new Error("This is not an active friendship");
    }

    // Delete the friendship
    await ctx.db.delete(args.friendshipId);

    // Also revoke any calendar shares between these families
    const otherFamilyId =
      friendship.requesterId === family._id
        ? friendship.addresseeId
        : friendship.requesterId;

    // Find and deactivate calendar shares in both directions
    const ourShares = await ctx.db
      .query("calendarShares")
      .withIndex("by_owner", (q) => q.eq("ownerFamilyId", family._id))
      .collect();

    const theirShares = await ctx.db
      .query("calendarShares")
      .withIndex("by_owner", (q) => q.eq("ownerFamilyId", otherFamilyId))
      .collect();

    const sharesToRevoke = [
      ...ourShares.filter((s) => s.sharedWithFamilyId === otherFamilyId),
      ...theirShares.filter((s) => s.sharedWithFamilyId === family._id),
    ];

    for (const share of sharesToRevoke) {
      await ctx.db.patch(share._id, { isActive: false });
    }

    return args.friendshipId;
  },
});

/**
 * Block a family.
 * Prevents future friend requests and removes existing friendship.
 */
export const blockFamily = mutation({
  args: {
    familyId: v.id("families"),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    if (args.familyId === family._id) {
      throw new Error("Cannot block yourself");
    }

    // Check if target family exists
    const targetFamily = await ctx.db.get(args.familyId);
    if (!targetFamily) {
      throw new Error("Family not found");
    }

    // Check for existing friendship in either direction
    const existingAsRequester = await ctx.db
      .query("friendships")
      .withIndex("by_requester_and_addressee", (q) =>
        q.eq("requesterId", family._id).eq("addresseeId", args.familyId)
      )
      .unique();

    const existingAsAddressee = await ctx.db
      .query("friendships")
      .withIndex("by_requester_and_addressee", (q) =>
        q.eq("requesterId", args.familyId).eq("addresseeId", family._id)
      )
      .unique();

    // If we have an existing friendship record as requester, update it to blocked
    if (existingAsRequester) {
      await ctx.db.patch(existingAsRequester._id, {
        status: "blocked",
        acceptedAt: undefined,
      });
    } else if (existingAsAddressee) {
      // Delete their record and create our own blocked record
      await ctx.db.delete(existingAsAddressee._id);
      await ctx.db.insert("friendships", {
        requesterId: family._id,
        addresseeId: args.familyId,
        status: "blocked",
      });
    } else {
      // No existing relationship, create a blocked record
      await ctx.db.insert("friendships", {
        requesterId: family._id,
        addresseeId: args.familyId,
        status: "blocked",
      });
    }

    // Revoke any calendar shares between these families
    const ourShares = await ctx.db
      .query("calendarShares")
      .withIndex("by_owner", (q) => q.eq("ownerFamilyId", family._id))
      .collect();

    const theirShares = await ctx.db
      .query("calendarShares")
      .withIndex("by_owner", (q) => q.eq("ownerFamilyId", args.familyId))
      .collect();

    const sharesToRevoke = [
      ...ourShares.filter((s) => s.sharedWithFamilyId === args.familyId),
      ...theirShares.filter((s) => s.sharedWithFamilyId === family._id),
    ];

    for (const share of sharesToRevoke) {
      await ctx.db.patch(share._id, { isActive: false });
    }

    return args.familyId;
  },
});

/**
 * Share calendar with a friend.
 * Requires an accepted friendship between families.
 */
export const shareCalendar = mutation({
  args: {
    friendFamilyId: v.id("families"),
    childIds: v.array(v.id("children")),
    permission: v.union(v.literal("view_sessions"), v.literal("view_details")),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    if (args.childIds.length === 0) {
      throw new Error("Must share at least one child's calendar");
    }

    // Verify friendship exists and is accepted
    const friendshipAsRequester = await ctx.db
      .query("friendships")
      .withIndex("by_requester_and_addressee", (q) =>
        q.eq("requesterId", family._id).eq("addresseeId", args.friendFamilyId)
      )
      .unique();

    const friendshipAsAddressee = await ctx.db
      .query("friendships")
      .withIndex("by_requester_and_addressee", (q) =>
        q.eq("requesterId", args.friendFamilyId).eq("addresseeId", family._id)
      )
      .unique();

    const friendship = friendshipAsRequester || friendshipAsAddressee;

    if (!friendship || friendship.status !== "accepted") {
      throw new Error("You must be friends with this family to share your calendar");
    }

    // Verify all children belong to this family
    for (const childId of args.childIds) {
      const child = await ctx.db.get(childId);
      if (!child || child.familyId !== family._id) {
        throw new Error("Invalid child ID");
      }
    }

    // Check if share already exists
    const existingShares = await ctx.db
      .query("calendarShares")
      .withIndex("by_owner", (q) => q.eq("ownerFamilyId", family._id))
      .collect();

    const existingShare = existingShares.find(
      (s) => s.sharedWithFamilyId === args.friendFamilyId
    );

    if (existingShare) {
      // Update existing share
      await ctx.db.patch(existingShare._id, {
        childIds: args.childIds,
        permission: args.permission,
        isActive: true,
      });
      return existingShare._id;
    }

    // Create new share
    const shareId = await ctx.db.insert("calendarShares", {
      ownerFamilyId: family._id,
      sharedWithFamilyId: args.friendFamilyId,
      childIds: args.childIds,
      permission: args.permission,
      isActive: true,
    });

    return shareId;
  },
});

/**
 * Update calendar sharing settings.
 */
export const updateCalendarShare = mutation({
  args: {
    shareId: v.id("calendarShares"),
    childIds: v.optional(v.array(v.id("children"))),
    permission: v.optional(
      v.union(v.literal("view_sessions"), v.literal("view_details"))
    ),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const share = await ctx.db.get(args.shareId);
    if (!share) {
      throw new Error("Calendar share not found");
    }

    // Only the owner can update the share
    if (share.ownerFamilyId !== family._id) {
      throw new Error("You cannot update this calendar share");
    }

    const updates: Record<string, unknown> = {};

    if (args.childIds !== undefined) {
      if (args.childIds.length === 0) {
        throw new Error("Must share at least one child's calendar");
      }
      // Verify all children belong to this family
      for (const childId of args.childIds) {
        const child = await ctx.db.get(childId);
        if (!child || child.familyId !== family._id) {
          throw new Error("Invalid child ID");
        }
      }
      updates.childIds = args.childIds;
    }

    if (args.permission !== undefined) {
      updates.permission = args.permission;
    }

    if (args.isActive !== undefined) {
      updates.isActive = args.isActive;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.shareId, updates);
    }

    return args.shareId;
  },
});

/**
 * Revoke calendar sharing with a friend.
 */
export const revokeCalendarShare = mutation({
  args: {
    shareId: v.id("calendarShares"),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const share = await ctx.db.get(args.shareId);
    if (!share) {
      throw new Error("Calendar share not found");
    }

    // Only the owner can revoke the share
    if (share.ownerFamilyId !== family._id) {
      throw new Error("You cannot revoke this calendar share");
    }

    // Soft delete by setting isActive to false
    await ctx.db.patch(args.shareId, {
      isActive: false,
    });

    return args.shareId;
  },
});
