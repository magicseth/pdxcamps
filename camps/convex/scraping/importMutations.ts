/**
 * Import Mutations
 *
 * Mutations for creating records during import.
 * Separated from import.ts because mutations can't be in "use node" files.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Create an organization
 */
export const createOrganization = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return ctx.db.insert("organizations", {
      name: args.name,
      slug,
      description: args.description,
      website: args.website,
      logoUrl: args.logoUrl,
      cityIds: [args.cityId],
      isVerified: false,
      isActive: true,
    });
  },
});

/**
 * Create a camp
 */
export const createCamp = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.string(),
    categories: v.array(v.string()),
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
    minGrade: v.optional(v.number()),
    maxGrade: v.optional(v.number()),
    website: v.optional(v.string()),
    imageUrls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return ctx.db.insert("camps", {
      organizationId: args.organizationId,
      name: args.name,
      slug,
      description: args.description,
      categories: args.categories,
      ageRequirements: {
        minAge: args.minAge,
        maxAge: args.maxAge,
        minGrade: args.minGrade,
        maxGrade: args.maxGrade,
      },
      website: args.website,
      imageUrls: args.imageUrls,
      imageStorageIds: [],
      isActive: true,
    });
  },
});

/**
 * Create a location
 */
export const createLocation = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("locations", {
      organizationId: args.organizationId,
      name: args.name,
      address: {
        street: "TBD",
        city: "Portland",
        state: "OR",
        zip: "97201",
      },
      cityId: args.cityId,
      latitude: 45.5152,
      longitude: -122.6784,
      isActive: true,
    });
  },
});

/**
 * Create a session
 */
export const createSession = mutation({
  args: {
    campId: v.id("camps"),
    locationId: v.id("locations"),
    organizationId: v.id("organizations"),
    cityId: v.id("cities"),
    startDate: v.string(),
    endDate: v.string(),
    dropOffHour: v.number(),
    dropOffMinute: v.number(),
    pickUpHour: v.number(),
    pickUpMinute: v.number(),
    price: v.number(),
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
    minGrade: v.optional(v.number()),
    maxGrade: v.optional(v.number()),
    registrationUrl: v.optional(v.string()),
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("sessions", {
      campId: args.campId,
      locationId: args.locationId,
      organizationId: args.organizationId,
      cityId: args.cityId,
      startDate: args.startDate,
      endDate: args.endDate,
      dropOffTime: { hour: args.dropOffHour, minute: args.dropOffMinute },
      pickUpTime: { hour: args.pickUpHour, minute: args.pickUpMinute },
      extendedCareAvailable: false,
      price: args.price,
      currency: "USD",
      capacity: 20,
      enrolledCount: 0,
      waitlistCount: 0,
      ageRequirements: {
        minAge: args.minAge,
        maxAge: args.maxAge,
        minGrade: args.minGrade,
        maxGrade: args.maxGrade,
      },
      status: "active",
      waitlistEnabled: true,
      externalRegistrationUrl: args.registrationUrl,
      sourceId: args.sourceId,
      lastScrapedAt: Date.now(),
    });
  },
});
