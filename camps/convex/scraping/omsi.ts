"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import * as cheerio from "cheerio";

// Debug logger
function log(level: "INFO" | "DEBUG" | "WARN" | "ERROR", message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` | ${JSON.stringify(data, null, 2)}` : "";
  console.log(`[${timestamp}] [${level}] ${message}${dataStr}`);
}

// OMSI API response types
interface OmsiSession {
  startDate: string;
  pricing: string;
  location: string;
  activityTime: string;
  isPreview?: boolean;
  campClassProductId: string;
  available: boolean;
}

interface OmsiCampProduct {
  name: string;
  subject: string;
  shortDescription: string;
  sessionList: OmsiSession[];
  safeURL: string;
  productId: string;
  imageName?: string;
  gradeLevel?: string;
}

interface OmsiApiResponse {
  dateResults: OmsiCampProduct[];
  alphaResults: OmsiCampProduct[];
}

// Helper to parse camp data from Visualforce API response
function parseCampData(
  data: unknown,
  addLog: (level: "INFO" | "DEBUG" | "WARN" | "ERROR", msg: string, data?: unknown) => void
): ScrapedCamp[] {
  const camps: ScrapedCamp[] = [];

  try {
    // The data could be in various formats - let's explore
    if (typeof data === 'string') {
      addLog("DEBUG", "Data is string, attempting to parse as JSON");
      data = JSON.parse(data);
    }

    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      addLog("DEBUG", "Data is object", { keys: Object.keys(obj) });

      // OMSI-specific: Check for dateResults/alphaResults structure
      if (Array.isArray(obj.dateResults)) {
        addLog("INFO", "Found OMSI dateResults", { count: obj.dateResults.length });
        const omsiData = obj as unknown as OmsiApiResponse;

        for (const product of omsiData.dateResults) {
          addLog("DEBUG", "Processing product", {
            name: product.name,
            sessionCount: product.sessionList?.length
          });

          // Each product can have multiple sessions (dates)
          if (product.sessionList && product.sessionList.length > 0) {
            for (const session of product.sessionList) {
              const camp = extractOmsiCamp(product, session, addLog);
              if (camp) {
                camps.push(camp);
              }
            }
          } else {
            // Product without sessions - still record it
            const camp = extractOmsiCamp(product, null, addLog);
            if (camp) {
              camps.push(camp);
            }
          }
        }
      }

      // Fallback: Check common field names for camp lists
      if (camps.length === 0) {
        const listFields = ['camps', 'classes', 'products', 'items', 'programs', 'sessions', 'results', 'data'];
        for (const field of listFields) {
          if (Array.isArray(obj[field])) {
            addLog("DEBUG", `Found array in field "${field}"`, { length: (obj[field] as unknown[]).length });
            for (const item of obj[field] as unknown[]) {
              const camp = extractCampFromItem(item, addLog);
              if (camp) {
                camps.push(camp);
              }
            }
          }
        }
      }

      // If still no list found, try to extract from the object itself
      if (camps.length === 0) {
        const camp = extractCampFromItem(obj, addLog);
        if (camp) {
          camps.push(camp);
        }
      }
    } else if (Array.isArray(data)) {
      addLog("DEBUG", "Data is array", { length: data.length });
      for (const item of data) {
        const camp = extractCampFromItem(item, addLog);
        if (camp) {
          camps.push(camp);
        }
      }
    }
  } catch (error) {
    addLog("ERROR", "Failed to parse camp data", { error: String(error) });
  }

  return camps;
}

// Extract a camp from OMSI-specific data structure
function extractOmsiCamp(
  product: OmsiCampProduct,
  session: OmsiSession | null,
  addLog: (level: "INFO" | "DEBUG" | "WARN" | "ERROR", msg: string, data?: unknown) => void
): ScrapedCamp | null {
  const name = product.name || '';
  if (!name) return null;

  const camp: ScrapedCamp = {
    name,
    description: product.shortDescription || '',
    category: product.subject || 'STEM',
    grades: product.gradeLevel || '',
    dates: session?.startDate || '',
    times: session?.activityTime || '',
    price: session?.pricing || '',
    location: session?.location || 'OMSI',
    availability: session?.available ? 'Available' : 'Sold Out',
    registrationUrl: `https://secure.omsi.edu/camps-and-classes?product=${product.safeURL}`,
    productId: product.productId,
    sessionProductId: session?.campClassProductId,
  };

  // Parse price - OMSI format: "$495.00/$550.00" (member/non-member)
  if (camp.price) {
    const prices = camp.price.match(/\$?([\d,]+(?:\.\d{2})?)/g);
    if (prices && prices.length >= 1) {
      const memberPrice = parseFloat(prices[0].replace(/[$,]/g, ''));
      camp.memberPriceInCents = Math.round(memberPrice * 100);
      if (prices.length >= 2) {
        const regularPrice = parseFloat(prices[1].replace(/[$,]/g, ''));
        camp.priceInCents = Math.round(regularPrice * 100);
      } else {
        camp.priceInCents = camp.memberPriceInCents;
      }
    }
  }

  // Parse dates - OMSI format: "Mar 23, 2026" or "Jun 16 - 20, 2026"
  if (camp.dates) {
    const dateRange = camp.dates.match(/(\w+\s+\d+)(?:\s*-\s*(\d+))?,?\s*(\d{4})/);
    if (dateRange) {
      const year = dateRange[3];
      const monthDay = dateRange[1]; // "Mar 23" or "Jun 16"
      const endDay = dateRange[2]; // "20" if range, undefined if single day

      const startDate = new Date(`${monthDay}, ${year}`);
      if (!isNaN(startDate.getTime())) {
        camp.startDate = startDate.toISOString().split('T')[0];

        if (endDay) {
          // Same month range
          const endDate = new Date(`${monthDay.split(' ')[0]} ${endDay}, ${year}`);
          if (!isNaN(endDate.getTime())) {
            camp.endDate = endDate.toISOString().split('T')[0];
          }
        } else {
          // Single day or need to infer end (assume 1 week for camps)
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 4); // Mon-Fri = 5 days
          camp.endDate = endDate.toISOString().split('T')[0];
        }
      }
    }
  }

  // Parse times - OMSI format: "9am-4pm Mon-Fri"
  if (camp.times) {
    const timeMatch = camp.times.match(/(\d+)(am|pm)\s*-\s*(\d+)(am|pm)/i);
    if (timeMatch) {
      let dropOffHour = parseInt(timeMatch[1]);
      if (timeMatch[2].toLowerCase() === 'pm' && dropOffHour !== 12) dropOffHour += 12;
      if (timeMatch[2].toLowerCase() === 'am' && dropOffHour === 12) dropOffHour = 0;

      let pickUpHour = parseInt(timeMatch[3]);
      if (timeMatch[4].toLowerCase() === 'pm' && pickUpHour !== 12) pickUpHour += 12;
      if (timeMatch[4].toLowerCase() === 'am' && pickUpHour === 12) pickUpHour = 0;

      camp.dropOffHour = dropOffHour;
      camp.dropOffMinute = 0;
      camp.pickUpHour = pickUpHour;
      camp.pickUpMinute = 0;
    }
  }

  // Parse grades - OMSI might have "Grades 3-5" or similar
  if (camp.grades) {
    const gradeMatch = camp.grades.match(/grades?\s*(\d+)\s*-\s*(\d+)/i);
    if (gradeMatch) {
      camp.minGrade = parseInt(gradeMatch[1]);
      camp.maxGrade = parseInt(gradeMatch[2]);
    }
  }

  addLog("DEBUG", "Extracted OMSI camp", {
    name: camp.name,
    startDate: camp.startDate,
    price: camp.priceInCents,
    available: camp.availability,
  });

  return camp;
}

// Extract a single camp from an item
function extractCampFromItem(
  item: unknown,
  addLog: (level: "INFO" | "DEBUG" | "WARN" | "ERROR", msg: string, data?: unknown) => void
): ScrapedCamp | null {
  if (typeof item !== 'object' || item === null) {
    return null;
  }

  const obj = item as Record<string, unknown>;

  // Log the item structure for debugging
  addLog("DEBUG", "Examining item", {
    keys: Object.keys(obj),
    sample: JSON.stringify(obj).substring(0, 500),
  });

  // Try to extract common camp fields
  const name = String(obj.name || obj.Name || obj.title || obj.Title || obj.productName || obj.ProductName || '');
  const description = String(obj.description || obj.Description || obj.details || obj.Details || '');
  const dates = String(obj.dates || obj.Dates || obj.dateRange || obj.DateRange || obj.sessionDates || '');
  const times = String(obj.times || obj.Times || obj.schedule || obj.Schedule || '');
  const price = String(obj.price || obj.Price || obj.cost || obj.Cost || obj.fee || obj.Fee || '');
  const grades = String(obj.grades || obj.Grades || obj.gradeRange || obj.GradeRange || obj.gradeLevel || '');
  const ages = String(obj.ages || obj.Ages || obj.ageRange || obj.AgeRange || '');
  const location = String(obj.location || obj.Location || obj.site || obj.Site || obj.venue || '');
  const availability = String(obj.availability || obj.Availability || obj.status || obj.Status || obj.spotsAvailable || '');

  if (!name) {
    return null;
  }

  const camp: ScrapedCamp = {
    name,
    description,
    dates,
    times,
    price,
    grades,
    ages,
    location,
    availability,
  };

  // Try to parse numeric values
  const priceMatch = price.match(/\$?([\d,]+(?:\.\d{2})?)/);
  if (priceMatch) {
    camp.priceInCents = Math.round(parseFloat(priceMatch[1].replace(',', '')) * 100);
  }

  // Parse grades
  const gradeMatch = grades.match(/(\d+)(?:\s*-\s*|\s+to\s+)(\d+)/i);
  if (gradeMatch) {
    camp.minGrade = parseInt(gradeMatch[1]);
    camp.maxGrade = parseInt(gradeMatch[2]);
  }

  // Parse ages
  const ageMatch = ages.match(/(\d+)(?:\s*-\s*|\s+to\s+)(\d+)/i);
  if (ageMatch) {
    camp.minAge = parseInt(ageMatch[1]);
    camp.maxAge = parseInt(ageMatch[2]);
  }

  addLog("DEBUG", "Extracted camp", { name: camp.name, price: camp.price, grades: camp.grades });

  return camp;
}

interface ScrapedCamp {
  name: string;
  description: string;
  category?: string;
  dates: string;
  startDate?: string;
  endDate?: string;
  times: string;
  dropOffHour?: number;
  dropOffMinute?: number;
  pickUpHour?: number;
  pickUpMinute?: number;
  price: string;
  priceInCents?: number;
  memberPrice?: string;
  memberPriceInCents?: number;
  grades: string;
  minGrade?: number;
  maxGrade?: number;
  ages?: string;
  minAge?: number;
  maxAge?: number;
  location: string;
  availability: string;
  registrationUrl?: string;
  productId?: string;
  sessionProductId?: string;
  rawHtml?: string;
}

/**
 * Scrape OMSI camps page - attempts multiple methods
 */
export const scrapeOmsi = action({
  args: {
    debug: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const debug = args.debug ?? true;
    const results: {
      method: string;
      success: boolean;
      camps: ScrapedCamp[];
      error?: string;
      rawResponse?: string;
      logs: string[];
    } = {
      method: "unknown",
      success: false,
      camps: [],
      logs: [],
    };

    const addLog = (level: "INFO" | "DEBUG" | "WARN" | "ERROR", msg: string, data?: unknown) => {
      log(level, msg, data);
      results.logs.push(`[${level}] ${msg}${data ? ": " + JSON.stringify(data) : ""}`);
    };

    addLog("INFO", "Starting OMSI scrape");

    // Method 1: Try the Salesforce Visualforce Remoting API
    try {
      addLog("INFO", "Method 1: Fetching OMSI Visualforce Remoting API");

      // First, get the page to extract CSRF token
      const pageResponse = await fetch("https://secure.omsi.edu/camps-and-classes", {
        headers: {
          "Accept": "text/html,application/xhtml+xml",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
        },
      });

      const pageHtml = await pageResponse.text();
      addLog("DEBUG", "Got catalog page", { length: pageHtml.length });

      // Extract CSRF token and other context from the page
      const csrfMatch = pageHtml.match(/"csrf":"([^"]+)"/);
      const vidMatch = pageHtml.match(/"vid":"([^"]+)"/);
      const verMatch = pageHtml.match(/"ver":(\d+)/);

      if (!csrfMatch) {
        addLog("WARN", "Could not find CSRF token in page");
      }

      const csrf = csrfMatch?.[1] || "";
      const vid = vidMatch?.[1] || "066f40000026br6";
      const ver = verMatch?.[1] ? parseInt(verMatch[1]) : 65;

      addLog("DEBUG", "Extracted context", { csrf: csrf.substring(0, 20) + "...", vid, ver });

      // Now call the API
      const apiUrl = "https://secure.omsi.edu/apexremote";
      const requestBody = {
        action: "ecomm_CampsClassesCatalogController",
        method: "getCampsClasses",
        data: [
          JSON.stringify({
            typeFormatList: [],
            gradeList: [],
            dateList: [],
            locationList: [],
            siteList: [],
            showSoldOutProducts: false,
          }),
          "",
        ],
        type: "rpc",
        tid: 2,
        ctx: {
          csrf,
          vid,
          ns: "",
          ver,
        },
      };

      addLog("DEBUG", "Calling Visualforce API", { url: apiUrl });

      const apiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Accept": "*/*",
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-User-Agent": "Visualforce-Remoting",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
          "Referer": "https://secure.omsi.edu/camps-and-classes",
        },
        body: JSON.stringify(requestBody),
      });

      addLog("DEBUG", "API Response", { status: apiResponse.status, statusText: apiResponse.statusText });

      if (apiResponse.ok) {
        const data = await apiResponse.json();
        addLog("INFO", "Got Visualforce API response", {
          type: typeof data,
          isArray: Array.isArray(data),
          length: Array.isArray(data) ? data.length : undefined,
        });

        if (debug) {
          results.rawResponse = JSON.stringify(data, null, 2).substring(0, 20000);
        }

        // Parse the Visualforce response
        // Response format is typically: [{ result: {...}, ... }]
        if (Array.isArray(data) && data.length > 0 && data[0].result) {
          const campData = data[0].result;
          addLog("INFO", "Parsing camp data", {
            type: typeof campData,
            keys: typeof campData === 'object' ? Object.keys(campData) : undefined,
          });

          // Try to extract camps from the result
          const camps = parseCampData(campData, addLog);
          if (camps.length > 0) {
            results.camps = camps;
            results.success = true;
            results.method = "visualforce_api";
            addLog("INFO", "Successfully parsed camps", { count: camps.length });
          }
        } else {
          addLog("WARN", "Unexpected API response format", { data: JSON.stringify(data).substring(0, 1000) });
        }
      }
    } catch (apiError) {
      addLog("ERROR", "Visualforce API method failed", { error: String(apiError) });
    }

    // Method 2: Scrape the main camps page
    if (!results.success) {
      try {
        addLog("INFO", "Method 2: Fetching main camps page");

        const mainUrl = "https://omsi.edu/camps/";
        const response = await fetch(mainUrl, {
          headers: {
            "Accept": "text/html,application/xhtml+xml",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });

        addLog("DEBUG", "Response", { status: response.status, contentType: response.headers.get("content-type") });

        const html = await response.text();
        addLog("DEBUG", "HTML length", { length: html.length });

        if (debug) {
          results.rawResponse = html.substring(0, 10000);
        }

        const $ = cheerio.load(html);

        // Look for camp-related content
        addLog("DEBUG", "Searching for camp content...");

        // Try various selectors
        const selectors = [
          ".camp-card",
          ".program-card",
          "[class*='camp']",
          ".wp-block-columns",
          "article",
          ".entry-content a[href*='camp']",
          "a[href*='camp']",
        ];

        for (const selector of selectors) {
          const elements = $(selector);
          addLog("DEBUG", `Selector "${selector}"`, { count: elements.length });

          if (elements.length > 0 && elements.length < 50) {
            elements.each((i, el) => {
              const text = $(el).text().trim().substring(0, 200);
              const href = $(el).attr("href") || "";
              if (text || href) {
                addLog("DEBUG", `  Element ${i}`, { text: text.substring(0, 100), href });
              }
            });
          }
        }

        // Look for any links to camp-related pages
        const campLinks: string[] = [];
        $("a").each((i, el) => {
          const href = $(el).attr("href") || "";
          if (href.includes("camp") || href.includes("class") || href.includes("program")) {
            campLinks.push(href);
          }
        });

        addLog("INFO", "Found camp-related links", { count: campLinks.length, links: [...new Set(campLinks)].slice(0, 20) });

        results.method = "html_scrape";
        results.success = campLinks.length > 0;

      } catch (htmlError) {
        addLog("ERROR", "HTML scrape failed", { error: String(htmlError) });
        results.error = String(htmlError);
      }
    }

    // Method 3: Try the secure catalog page
    if (!results.success) {
      try {
        addLog("INFO", "Method 3: Fetching secure catalog page");

        const catalogUrl = "https://secure.omsi.edu/camps-and-classes";
        const response = await fetch(catalogUrl, {
          headers: {
            "Accept": "text/html,application/xhtml+xml",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        });

        addLog("DEBUG", "Catalog response", { status: response.status });

        const html = await response.text();
        addLog("DEBUG", "Catalog HTML length", { length: html.length });

        if (debug) {
          results.rawResponse = html.substring(0, 10000);
        }

        const $ = cheerio.load(html);

        // Look for any script tags that might contain camp data
        $("script").each((i, el) => {
          const content = $(el).html() || "";
          if (content.includes("camp") || content.includes("class") || content.includes("program")) {
            addLog("DEBUG", `Found relevant script ${i}`, { preview: content.substring(0, 500) });
          }
        });

        // Look for any data attributes
        $("[data-camps], [data-classes], [data-programs]").each((i, el) => {
          addLog("DEBUG", `Found data attribute element ${i}`, {
            html: $(el).prop("outerHTML")?.substring(0, 500)
          });
        });

        results.method = "catalog_scrape";

      } catch (catalogError) {
        addLog("ERROR", "Catalog scrape failed", { error: String(catalogError) });
      }
    }

    // Method 4: Check for any embedded JSON or API endpoints in scripts
    try {
      addLog("INFO", "Method 4: Looking for embedded data/APIs");

      const urls = [
        "https://omsi.edu/wp-json/wp/v2/camps",
        "https://omsi.edu/wp-json/wp/v2/posts?categories=camps",
        "https://secure.omsi.edu/api/v1/programs",
      ];

      for (const url of urls) {
        try {
          addLog("DEBUG", "Trying API endpoint", { url });
          const resp = await fetch(url, {
            headers: { "Accept": "application/json" },
          });
          addLog("DEBUG", "Response", { url, status: resp.status });

          if (resp.ok) {
            const data = await resp.text();
            addLog("INFO", "Got data from API", { url, preview: data.substring(0, 500) });
          }
        } catch (e) {
          addLog("DEBUG", "Endpoint failed", { url, error: String(e) });
        }
      }
    } catch (e) {
      addLog("WARN", "Method 4 failed", { error: String(e) });
    }

    addLog("INFO", "Scrape complete", {
      method: results.method,
      success: results.success,
      campsFound: results.camps.length,
      totalLogs: results.logs.length,
    });

    return results;
  },
});

/**
 * Parse OMSI camp data and create sessions in the database
 */
export const importOmsiCamps = action({
  args: {
    camps: v.array(v.object({
      name: v.string(),
      description: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      dropOffHour: v.number(),
      dropOffMinute: v.number(),
      pickUpHour: v.number(),
      pickUpMinute: v.number(),
      priceInCents: v.number(),
      minAge: v.optional(v.number()),
      maxAge: v.optional(v.number()),
      minGrade: v.optional(v.number()),
      maxGrade: v.optional(v.number()),
      location: v.string(),
      registrationUrl: v.optional(v.string()),
    })),
    organizationId: v.id("organizations"),
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    log("INFO", "Importing OMSI camps", { count: args.camps.length });

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const camp of args.camps) {
      try {
        // Check if camp already exists
        const existingCamp = await ctx.runQuery(api.camps.queries.searchCamps, {
          query: camp.name,
          cityId: args.cityId,
        });

        let campId: string;

        if (existingCamp.length > 0) {
          campId = existingCamp[0]._id;
          log("DEBUG", "Using existing camp", { name: camp.name, campId });
        } else {
          // Create camp
          campId = await ctx.runMutation(api.camps.mutations.createCamp, {
            organizationId: args.organizationId,
            name: camp.name,
            description: camp.description,
            categories: ["STEM"], // Default for OMSI
            ageRequirements: {
              minAge: camp.minAge,
              maxAge: camp.maxAge,
              minGrade: camp.minGrade,
              maxGrade: camp.maxGrade,
            },
          });
          log("INFO", "Created camp", { name: camp.name, campId });
        }

        // Get or create location
        const locations = await ctx.runQuery(api.locations.queries.listLocations, {
          cityId: args.cityId,
          organizationId: args.organizationId,
        });

        let locationId: string;
        const existingLocation = locations.find((l: { name: string }) => l.name.includes(camp.location));

        if (existingLocation) {
          locationId = existingLocation._id;
        } else {
          locationId = await ctx.runMutation(api.locations.mutations.createLocation, {
            organizationId: args.organizationId,
            name: camp.location,
            address: {
              street: "1945 SE Water Ave",
              city: "Portland",
              state: "OR",
              zip: "97214",
            },
            cityId: args.cityId,
            latitude: 45.5083,
            longitude: -122.6658,
          });
          log("INFO", "Created location", { name: camp.location, locationId });
        }

        // Create session
        await ctx.runMutation(api.sessions.mutations.createSession, {
          campId: campId as any,
          locationId: locationId as any,
          startDate: camp.startDate,
          endDate: camp.endDate,
          dropOffTime: { hour: camp.dropOffHour, minute: camp.dropOffMinute },
          pickUpTime: { hour: camp.pickUpHour, minute: camp.pickUpMinute },
          price: camp.priceInCents,
          currency: "USD",
          capacity: 20,
          ageRequirements: {
            minAge: camp.minAge,
            maxAge: camp.maxAge,
            minGrade: camp.minGrade,
            maxGrade: camp.maxGrade,
          },
          extendedCareAvailable: false,
          waitlistEnabled: true,
          externalRegistrationUrl: camp.registrationUrl,
        });

        results.imported++;
        log("INFO", "Created session", { name: camp.name, startDate: camp.startDate });

      } catch (error) {
        const errorMsg = `Failed to import "${camp.name}": ${error}`;
        log("ERROR", errorMsg);
        results.errors.push(errorMsg);
      }
    }

    return results;
  },
});

/**
 * Manual test endpoint - creates sample OMSI camps directly
 * Use this if scraping doesn't work
 */
export const createSampleOmsiCamps = action({
  args: {
    organizationId: v.id("organizations"),
    cityId: v.id("cities"),
  },
  handler: async (ctx, args): Promise<{ imported: number; skipped: number; errors: string[] }> => {
    log("INFO", "Creating sample OMSI camps");

    // Sample OMSI camps based on their typical offerings
    const sampleCamps = [
      {
        name: "Robotics: LEGO Mindstorms",
        description: "Build and program LEGO Mindstorms robots! Learn fundamental programming concepts while creating robots that can navigate mazes, respond to sensors, and complete challenges.",
        startDate: "2026-06-23",
        endDate: "2026-06-27",
        dropOffHour: 9,
        dropOffMinute: 0,
        pickUpHour: 16,
        pickUpMinute: 0,
        priceInCents: 42500,
        minGrade: 3,
        maxGrade: 5,
        location: "OMSI",
      },
      {
        name: "Chemistry Wizards",
        description: "Discover the magic of chemistry through hands-on experiments! Create slime, make things fizz and bubble, and learn about chemical reactions in a safe, fun environment.",
        startDate: "2026-06-23",
        endDate: "2026-06-27",
        dropOffHour: 9,
        dropOffMinute: 0,
        pickUpHour: 16,
        pickUpMinute: 0,
        priceInCents: 39500,
        minGrade: 1,
        maxGrade: 3,
        location: "OMSI",
      },
      {
        name: "Coding with Scratch",
        description: "Learn to code by creating your own video games and animations! Using MIT's Scratch programming language, campers will develop computational thinking skills while having fun.",
        startDate: "2026-06-30",
        endDate: "2026-07-04",
        dropOffHour: 9,
        dropOffMinute: 0,
        pickUpHour: 16,
        pickUpMinute: 0,
        priceInCents: 42500,
        minGrade: 2,
        maxGrade: 5,
        location: "OMSI",
      },
      {
        name: "Forensic Science CSI",
        description: "Become a forensic scientist! Analyze fingerprints, examine evidence, solve mysteries using real forensic techniques. Great for kids who love solving puzzles.",
        startDate: "2026-07-07",
        endDate: "2026-07-11",
        dropOffHour: 9,
        dropOffMinute: 0,
        pickUpHour: 16,
        pickUpMinute: 0,
        priceInCents: 42500,
        minGrade: 4,
        maxGrade: 6,
        location: "OMSI",
      },
      {
        name: "Nature Explorers at Oregon Zoo",
        description: "Explore the Oregon Zoo and learn about animals from around the world! Meet zookeepers, observe animal behaviors, and discover what it takes to care for zoo animals.",
        startDate: "2026-07-14",
        endDate: "2026-07-18",
        dropOffHour: 9,
        dropOffMinute: 0,
        pickUpHour: 15,
        pickUpMinute: 30,
        priceInCents: 44500,
        minGrade: 1,
        maxGrade: 3,
        location: "Oregon Zoo",
      },
      {
        name: "Engineering Challenge",
        description: "Design, build, and test! Tackle engineering challenges using everyday materials. Build bridges, towers, catapults, and more while learning about structural engineering.",
        startDate: "2026-07-21",
        endDate: "2026-07-25",
        dropOffHour: 9,
        dropOffMinute: 0,
        pickUpHour: 16,
        pickUpMinute: 0,
        priceInCents: 42500,
        minGrade: 3,
        maxGrade: 6,
        location: "OMSI",
      },
    ];

    return await ctx.runAction(api.scraping.omsi.importOmsiCamps, {
      camps: sampleCamps,
      organizationId: args.organizationId,
      cityId: args.cityId,
    });
  },
});
