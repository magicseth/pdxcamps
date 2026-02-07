#!/usr/bin/env npx tsx
/**
 * Migration script to copy organizations and scraper sources from dev to prod.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-prod.ts
 *
 * This script:
 * 1. Exports cities, organizations, locations, camps, and scrapeSources from dev
 * 2. Imports them into prod, mapping IDs appropriately
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

// Configuration
const DEV_URL = "https://brazen-vulture-927.convex.cloud";
const PROD_URL = "https://deafening-schnauzer-923.convex.cloud";

const devClient = new ConvexHttpClient(DEV_URL);
const prodClient = new ConvexHttpClient(PROD_URL);

// ID mapping from dev to prod
const idMap = {
  cities: new Map<string, string>(),
  organizations: new Map<string, string>(),
  locations: new Map<string, string>(),
  camps: new Map<string, string>(),
  scrapeSources: new Map<string, string>(),
};

async function main() {
  console.log("🚀 Starting migration from dev to prod...\n");

  // Step 1: Export and import cities
  console.log("📍 Migrating cities...");
  await migrateCities();

  // Step 2: Export and import organizations
  console.log("\n🏢 Migrating organizations...");
  await migrateOrganizations();

  // Step 3: Export and import locations
  console.log("\n📌 Migrating locations...");
  await migrateLocations();

  // Step 4: Export and import camps
  console.log("\n🏕️ Migrating camps...");
  await migrateCamps();

  // Step 5: Export and import scrapeSources
  console.log("\n🔧 Migrating scrape sources...");
  await migrateScrapeSources();

  console.log("\n✅ Migration complete!");
  console.log("\nID Mappings:");
  console.log(`  Cities: ${idMap.cities.size}`);
  console.log(`  Organizations: ${idMap.organizations.size}`);
  console.log(`  Locations: ${idMap.locations.size}`);
  console.log(`  Camps: ${idMap.camps.size}`);
  console.log(`  Scrape Sources: ${idMap.scrapeSources.size}`);
}

async function migrateCities() {
  const devCities = await devClient.query(api.cities.queries.listAllCities, {});
  console.log(`  Found ${devCities.length} cities in dev`);

  for (const city of devCities) {
    // Check if city already exists in prod by slug
    const existingCity = await prodClient.query(api.cities.queries.getCityBySlug, { slug: city.slug });

    if (existingCity) {
      console.log(`  ⏭️  City "${city.name}" already exists in prod`);
      idMap.cities.set(city._id, existingCity._id);
    } else {
      // Create city in prod
      const prodId = await prodClient.mutation(api.cities.mutations.createCity, {
        name: city.name,
        slug: city.slug,
        state: city.state,
        timezone: city.timezone,
        isActive: city.isActive,
        centerLatitude: city.centerLatitude,
        centerLongitude: city.centerLongitude,
      });
      console.log(`  ✅ Created city "${city.name}"`);
      idMap.cities.set(city._id, prodId);
    }
  }
}

async function migrateOrganizations() {
  const devOrgs = await devClient.query(api.organizations.queries.listAllOrganizations, {});
  console.log(`  Found ${devOrgs.length} organizations in dev`);

  for (const org of devOrgs) {
    // Check if org already exists in prod by slug
    const existingOrg = await prodClient.query(api.organizations.queries.getOrganizationBySlug, { slug: org.slug });

    if (existingOrg) {
      console.log(`  ⏭️  Org "${org.name}" already exists in prod`);
      idMap.organizations.set(org._id, existingOrg._id);
    } else {
      // Map city IDs
      const prodCityIds = org.cityIds
        .map((devCityId: string) => idMap.cities.get(devCityId))
        .filter((id): id is string => id !== undefined) as Id<"cities">[];

      if (prodCityIds.length === 0) {
        console.log(`  ⚠️  Skipping org "${org.name}" - no valid city mappings`);
        continue;
      }

      const prodId = await prodClient.mutation(api.organizations.mutations.createOrganization, {
        name: org.name,
        slug: org.slug,
        website: org.website,
        email: org.email,
        phone: org.phone,
        description: org.description,
        logoUrl: org.logoUrl,
        cityIds: prodCityIds,
        isVerified: org.isVerified,
        isActive: org.isActive,
      });
      console.log(`  ✅ Created org "${org.name}"`);
      idMap.organizations.set(org._id, prodId);
    }
  }
}

async function migrateLocations() {
  const devLocations = await devClient.query(api.locations.queries.listAllLocations, {});
  console.log(`  Found ${devLocations.length} locations in dev`);

  for (const loc of devLocations) {
    // Map IDs
    const prodCityId = idMap.cities.get(loc.cityId);
    const prodOrgId = loc.organizationId ? idMap.organizations.get(loc.organizationId) : undefined;

    if (!prodCityId) {
      console.log(`  ⚠️  Skipping location "${loc.name}" - no city mapping`);
      continue;
    }

    // Check if location already exists (by name and city)
    const existingLocations = await prodClient.query(api.locations.queries.listLocations, {
      cityId: prodCityId as Id<"cities">
    });
    const existingLoc = existingLocations?.find((l: any) => l.name === loc.name);

    if (existingLoc) {
      console.log(`  ⏭️  Location "${loc.name}" already exists in prod`);
      idMap.locations.set(loc._id, existingLoc._id);
    } else {
      const prodId = await prodClient.mutation(api.locations.mutations.createLocation, {
        organizationId: prodOrgId as Id<"organizations"> | undefined,
        name: loc.name,
        address: loc.address,
        cityId: prodCityId as Id<"cities">,
        neighborhoodId: undefined, // Skip neighborhood mapping for now
        latitude: loc.latitude,
        longitude: loc.longitude,
        parkingNotes: loc.parkingNotes,
        accessibilityNotes: loc.accessibilityNotes,
        isActive: loc.isActive,
      });
      console.log(`  ✅ Created location "${loc.name}"`);
      idMap.locations.set(loc._id, prodId);
    }
  }
}

async function migrateCamps() {
  const devCamps = await devClient.query(api.camps.queries.listAllCamps, {});
  console.log(`  Found ${devCamps.length} camps in dev`);

  for (const camp of devCamps) {
    // Map organization ID
    const prodOrgId = idMap.organizations.get(camp.organizationId);

    if (!prodOrgId) {
      console.log(`  ⚠️  Skipping camp "${camp.name}" - no org mapping`);
      continue;
    }

    // Check if camp already exists by slug
    const existingCamp = await prodClient.query(api.camps.queries.getCampBySlug, { slug: camp.slug });

    if (existingCamp) {
      console.log(`  ⏭️  Camp "${camp.name}" already exists in prod`);
      idMap.camps.set(camp._id, existingCamp._id);
    } else {
      const prodId = await prodClient.mutation(api.camps.mutations.createCamp, {
        organizationId: prodOrgId as Id<"organizations">,
        name: camp.name,
        slug: camp.slug,
        description: camp.description,
        categories: camp.categories,
        ageRequirements: camp.ageRequirements,
        typicalPriceRange: camp.typicalPriceRange,
        website: camp.website,
        imageUrls: camp.imageUrls,
        imageStylePrompt: camp.imageStylePrompt,
        isActive: camp.isActive,
        isFeatured: camp.isFeatured,
      });
      console.log(`  ✅ Created camp "${camp.name}"`);
      idMap.camps.set(camp._id, prodId);
    }
  }
}

async function migrateScrapeSources() {
  const devSources = await devClient.query(api.scraping.queries.listAllScrapeSources, {});
  console.log(`  Found ${devSources.length} scrape sources in dev`);

  for (const source of devSources) {
    // Map IDs
    const prodCityId = idMap.cities.get(source.cityId);
    const prodOrgId = source.organizationId ? idMap.organizations.get(source.organizationId) : undefined;

    if (!prodCityId) {
      console.log(`  ⚠️  Skipping source "${source.name}" - no city mapping`);
      continue;
    }

    // Check if source already exists by URL
    const existingSources = await prodClient.query(api.scraping.queries.getScrapeSourceByUrl, { url: source.url });

    if (existingSources) {
      console.log(`  ⏭️  Source "${source.name}" already exists in prod`);
      idMap.scrapeSources.set(source._id, existingSources._id);
    } else {
      const prodId = await prodClient.mutation(api.scraping.sources.createScrapeSource, {
        organizationId: prodOrgId as Id<"organizations"> | undefined,
        cityId: prodCityId as Id<"cities">,
        name: source.name,
        url: source.url,
        additionalUrls: source.additionalUrls,
        scraperModule: source.scraperModule,
        scraperCode: source.scraperCode,
        scraperConfig: source.scraperConfig,
        scraperHealth: source.scraperHealth,
        scrapeFrequencyHours: source.scrapeFrequencyHours,
        isActive: source.isActive,
      });
      console.log(`  ✅ Created source "${source.name}"`);
      idMap.scrapeSources.set(source._id, prodId);
    }
  }
}

main().catch(console.error);
