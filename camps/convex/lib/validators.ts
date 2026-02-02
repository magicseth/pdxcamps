import { v } from "convex/values";

// Reusable validators matching schema.ts definitions

export const ageRangeValidator = v.object({
  minAge: v.optional(v.number()),
  maxAge: v.optional(v.number()),
  minGrade: v.optional(v.number()), // K=0, 1st=1, Pre-K=-1
  maxGrade: v.optional(v.number()),
});

export const timeValidator = v.object({
  hour: v.number(), // 0-23
  minute: v.number(), // 0-59
});

export const addressValidator = v.object({
  street: v.string(),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
});

// Additional validators for common input patterns

export const paginationValidator = v.object({
  cursor: v.optional(v.string()),
  limit: v.optional(v.number()),
});

export const dateRangeValidator = v.object({
  startDate: v.string(),
  endDate: v.string(),
});

// Status validators
export const sessionStatusValidator = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("sold_out"),
  v.literal("cancelled"),
  v.literal("completed")
);

export const registrationStatusValidator = v.union(
  v.literal("interested"),
  v.literal("waitlisted"),
  v.literal("registered"),
  v.literal("cancelled")
);

export const friendshipStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("blocked")
);

export const calendarSharingDefaultValidator = v.union(
  v.literal("private"),
  v.literal("friends_only"),
  v.literal("public")
);
