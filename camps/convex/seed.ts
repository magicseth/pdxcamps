import { mutation } from "./_generated/server";

/**
 * Seed the database with sample data for development/testing
 * Run with: npx convex run seed:seedAll
 */
export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existingCities = await ctx.db.query("cities").collect();
    if (existingCities.length > 0) {
      return { message: "Database already seeded", skipped: true };
    }

    // 1. Create Portland
    const portlandId = await ctx.db.insert("cities", {
      name: "Portland",
      slug: "portland",
      state: "OR",
      timezone: "America/Los_Angeles",
      isActive: true,
      centerLatitude: 45.5152,
      centerLongitude: -122.6784,
    });

    // 2. Create neighborhoods
    const neighborhoods = [
      "Alberta Arts District", "Alameda", "Beaumont-Wilshire", "Boise",
      "Brooklyn", "Buckman", "Division", "Downtown", "Eastmoreland",
      "Hawthorne", "Hollywood", "Irvington", "Kerns", "Laurelhurst",
      "Mississippi", "Montavilla", "Mt. Tabor", "Nob Hill", "Pearl District",
      "Richmond", "Rose City Park", "Sellwood-Moreland", "St. Johns",
      "Sunnyside", "University Park", "Woodstock"
    ];

    for (const name of neighborhoods) {
      await ctx.db.insert("neighborhoods", {
        cityId: portlandId,
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      });
    }

    // 3. Create organizations
    const parksId = await ctx.db.insert("organizations", {
      name: "Portland Parks & Recreation",
      slug: "portland-parks",
      website: "https://www.portlandoregon.gov/parks",
      description: "City of Portland parks department offering summer camps for kids of all ages",
      cityIds: [portlandId],
      isVerified: true,
      isActive: true,
    });

    const omsiId = await ctx.db.insert("organizations", {
      name: "OMSI Science Camps",
      slug: "omsi",
      website: "https://omsi.edu",
      description: "Oregon Museum of Science and Industry offering hands-on STEM camps",
      cityIds: [portlandId],
      isVerified: true,
      isActive: true,
    });

    const artMuseumId = await ctx.db.insert("organizations", {
      name: "Portland Art Museum",
      slug: "portland-art-museum",
      website: "https://portlandartmuseum.org",
      description: "Art camps for creative kids",
      cityIds: [portlandId],
      isVerified: true,
      isActive: true,
    });

    // 4. Create camps
    const natureCampId = await ctx.db.insert("camps", {
      organizationId: parksId,
      name: "Summer Nature Explorers",
      slug: "summer-nature-explorers",
      description: "Kids explore Portland parks, learn about local wildlife, and enjoy outdoor adventures. Activities include hiking, nature crafts, wildlife observation, and environmental education.",
      categories: ["Nature", "Adventure", "STEM"],
      ageRequirements: { minAge: 6, maxAge: 12 },
      imageStorageIds: [],
      isActive: true,
    });

    const roboticsCampId = await ctx.db.insert("camps", {
      organizationId: omsiId,
      name: "Robotics & Coding Camp",
      slug: "robotics-coding",
      description: "Build robots, learn to code, and explore the exciting world of technology. Kids will use LEGO Mindstorms, Scratch programming, and more.",
      categories: ["STEM", "Academic"],
      ageRequirements: { minAge: 8, maxAge: 14 },
      imageStorageIds: [],
      isActive: true,
    });

    const artCampId = await ctx.db.insert("camps", {
      organizationId: artMuseumId,
      name: "Young Artists Studio",
      slug: "young-artists-studio",
      description: "Explore painting, sculpture, mixed media, and art history. Campers create their own masterpieces inspired by the museum's collection.",
      categories: ["Arts", "Drama"],
      ageRequirements: { minAge: 5, maxAge: 10 },
      imageStorageIds: [],
      isActive: true,
    });

    // 5. Create locations
    const mtTaborId = await ctx.db.insert("locations", {
      organizationId: parksId,
      name: "Mt. Tabor Park",
      address: { street: "6220 SE Salmon St", city: "Portland", state: "OR", zip: "97215" },
      cityId: portlandId,
      latitude: 45.5112,
      longitude: -122.5936,
      isActive: true,
    });

    const omsiLocationId = await ctx.db.insert("locations", {
      organizationId: omsiId,
      name: "OMSI",
      address: { street: "1945 SE Water Ave", city: "Portland", state: "OR", zip: "97214" },
      cityId: portlandId,
      latitude: 45.5083,
      longitude: -122.6658,
      isActive: true,
    });

    const artMuseumLocationId = await ctx.db.insert("locations", {
      organizationId: artMuseumId,
      name: "Portland Art Museum",
      address: { street: "1219 SW Park Ave", city: "Portland", state: "OR", zip: "97205" },
      cityId: portlandId,
      latitude: 45.5163,
      longitude: -122.6835,
      isActive: true,
    });

    // 6. Create sessions (use current year + future dates)
    const currentYear = new Date().getFullYear();
    const summerStart = `${currentYear}-06-15`;

    // Nature camp sessions
    await ctx.db.insert("sessions", {
      campId: natureCampId,
      locationId: mtTaborId,
      organizationId: parksId,
      cityId: portlandId,
      startDate: `${currentYear}-06-15`,
      endDate: `${currentYear}-06-19`,
      dropOffTime: { hour: 9, minute: 0 },
      pickUpTime: { hour: 15, minute: 0 },
      extendedCareAvailable: true,
      price: 35000,
      currency: "USD",
      capacity: 20,
      enrolledCount: 0,
      waitlistCount: 0,
      ageRequirements: { minAge: 6, maxAge: 12 },
      status: "active",
      waitlistEnabled: true,
    });

    await ctx.db.insert("sessions", {
      campId: natureCampId,
      locationId: mtTaborId,
      organizationId: parksId,
      cityId: portlandId,
      startDate: `${currentYear}-07-13`,
      endDate: `${currentYear}-07-17`,
      dropOffTime: { hour: 9, minute: 0 },
      pickUpTime: { hour: 15, minute: 0 },
      extendedCareAvailable: true,
      price: 35000,
      currency: "USD",
      capacity: 20,
      enrolledCount: 15,
      waitlistCount: 0,
      ageRequirements: { minAge: 6, maxAge: 12 },
      status: "active",
      waitlistEnabled: true,
    });

    // Robotics camp sessions
    await ctx.db.insert("sessions", {
      campId: roboticsCampId,
      locationId: omsiLocationId,
      organizationId: omsiId,
      cityId: portlandId,
      startDate: `${currentYear}-06-22`,
      endDate: `${currentYear}-06-26`,
      dropOffTime: { hour: 9, minute: 0 },
      pickUpTime: { hour: 16, minute: 0 },
      extendedCareAvailable: false,
      price: 45000,
      currency: "USD",
      capacity: 16,
      enrolledCount: 0,
      waitlistCount: 0,
      ageRequirements: { minAge: 8, maxAge: 14 },
      status: "active",
      waitlistEnabled: true,
    });

    await ctx.db.insert("sessions", {
      campId: roboticsCampId,
      locationId: omsiLocationId,
      organizationId: omsiId,
      cityId: portlandId,
      startDate: `${currentYear}-07-20`,
      endDate: `${currentYear}-07-24`,
      dropOffTime: { hour: 9, minute: 0 },
      pickUpTime: { hour: 16, minute: 0 },
      extendedCareAvailable: false,
      price: 45000,
      currency: "USD",
      capacity: 16,
      enrolledCount: 16,
      waitlistCount: 3,
      ageRequirements: { minAge: 8, maxAge: 14 },
      status: "sold_out",
      waitlistEnabled: true,
    });

    // Art camp sessions
    await ctx.db.insert("sessions", {
      campId: artCampId,
      locationId: artMuseumLocationId,
      organizationId: artMuseumId,
      cityId: portlandId,
      startDate: `${currentYear}-06-29`,
      endDate: `${currentYear}-07-03`,
      dropOffTime: { hour: 9, minute: 30 },
      pickUpTime: { hour: 14, minute: 30 },
      extendedCareAvailable: true,
      price: 32500,
      currency: "USD",
      capacity: 12,
      enrolledCount: 0,
      waitlistCount: 0,
      ageRequirements: { minAge: 5, maxAge: 10 },
      status: "active",
      waitlistEnabled: true,
    });

    await ctx.db.insert("sessions", {
      campId: artCampId,
      locationId: artMuseumLocationId,
      organizationId: artMuseumId,
      cityId: portlandId,
      startDate: `${currentYear}-08-03`,
      endDate: `${currentYear}-08-07`,
      dropOffTime: { hour: 9, minute: 30 },
      pickUpTime: { hour: 14, minute: 30 },
      extendedCareAvailable: true,
      price: 32500,
      currency: "USD",
      capacity: 12,
      enrolledCount: 10,
      waitlistCount: 0,
      ageRequirements: { minAge: 5, maxAge: 10 },
      status: "active",
      waitlistEnabled: true,
    });

    return {
      message: "Database seeded successfully",
      skipped: false,
      created: {
        cities: 1,
        neighborhoods: neighborhoods.length,
        organizations: 3,
        camps: 3,
        locations: 3,
        sessions: 6,
      },
    };
  },
});
