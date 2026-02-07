/**
 * OMSI (Oregon Museum of Science and Industry) Scraper
 *
 * Scrapes camp data from OMSI's Salesforce Visualforce API.
 * OMSI uses a Salesforce-based system that exposes camp data via a remoting API.
 *
 * Entry point: https://secure.omsi.edu/camps-and-classes
 * API endpoint: https://secure.omsi.edu/apexremote
 */

import { ScraperConfig, ScraperLogger, ScrapeResult, ScrapedSession, ScraperRegistryEntry } from './types';

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

/**
 * Main scraper function for OMSI
 */
async function scrape(config: ScraperConfig, log: ScraperLogger): Promise<ScrapeResult> {
  const startTime = Date.now();
  const sessions: ScrapedSession[] = [];

  try {
    log('INFO', 'Starting OMSI scrape', { url: config.url });

    // Step 1: Fetch the catalog page to get CSRF token
    const catalogUrl = 'https://secure.omsi.edu/camps-and-classes';
    log('DEBUG', 'Fetching catalog page for CSRF token', { url: catalogUrl });

    const pageResponse = await fetch(catalogUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch catalog page: ${pageResponse.status}`);
    }

    const pageHtml = await pageResponse.text();
    log('DEBUG', 'Got catalog page', { length: pageHtml.length });

    // Extract CSRF token and context from page
    const csrfMatch = pageHtml.match(/"csrf":"([^"]+)"/);
    const vidMatch = pageHtml.match(/"vid":"([^"]+)"/);
    const verMatch = pageHtml.match(/"ver":(\d+)/);

    const csrf = csrfMatch?.[1] || '';
    const vid = vidMatch?.[1] || '066f40000026br6';
    const ver = verMatch?.[1] ? parseInt(verMatch[1]) : 65;

    if (!csrf) {
      log('WARN', 'Could not extract CSRF token, proceeding anyway');
    }

    log('DEBUG', 'Extracted context', {
      csrf: csrf.substring(0, 20) + '...',
      vid,
      ver,
    });

    // Step 2: Call the Visualforce Remoting API
    const apiUrl = 'https://secure.omsi.edu/apexremote';
    const requestBody = {
      action: 'ecomm_CampsClassesCatalogController',
      method: 'getCampsClasses',
      data: [
        JSON.stringify({
          typeFormatList: [],
          gradeList: [],
          dateList: [],
          locationList: [],
          siteList: [],
          showSoldOutProducts: false,
        }),
        '',
      ],
      type: 'rpc',
      tid: 2,
      ctx: { csrf, vid, ns: '', ver },
    };

    log('DEBUG', 'Calling Visualforce API', { url: apiUrl });

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-User-Agent': 'Visualforce-Remoting',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://secure.omsi.edu/camps-and-classes',
      },
      body: JSON.stringify(requestBody),
    });

    log('DEBUG', 'API Response', {
      status: apiResponse.status,
      statusText: apiResponse.statusText,
    });

    if (!apiResponse.ok) {
      throw new Error(`API request failed: ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    log('DEBUG', 'Got API response', {
      isArray: Array.isArray(data),
      length: Array.isArray(data) ? data.length : undefined,
    });

    // Step 3: Parse the response
    if (!Array.isArray(data) || data.length === 0 || !data[0].result) {
      throw new Error('Unexpected API response format');
    }

    const resultStr = data[0].result;
    const parsed = typeof resultStr === 'string' ? JSON.parse(resultStr) : resultStr;

    if (!parsed.dateResults || !Array.isArray(parsed.dateResults)) {
      throw new Error('No dateResults in API response');
    }

    const omsiData = parsed as OmsiApiResponse;
    log('INFO', 'Found camp products', { count: omsiData.dateResults.length });

    // Step 4: Extract sessions from each product
    for (const product of omsiData.dateResults) {
      if (product.sessionList && product.sessionList.length > 0) {
        for (const session of product.sessionList) {
          const scraped = extractSession(product, session, log);
          if (scraped) {
            sessions.push(scraped);
          }
        }
      } else {
        // Product without sessions - still record it
        const scraped = extractSession(product, null, log);
        if (scraped) {
          sessions.push(scraped);
        }
      }
    }

    log('INFO', 'Scrape complete', { sessionsFound: sessions.length });

    return {
      success: true,
      sessions,
      organization: {
        name: 'OMSI Science Camps',
        description: 'Oregon Museum of Science and Industry offering hands-on STEM camps',
        website: 'https://omsi.edu',
        logoUrl: 'https://omsi.edu/wp-content/uploads/2023/07/OMSI-Logo.svg',
      },
      scrapedAt: Date.now(),
      durationMs: Date.now() - startTime,
      pagesScraped: 1,
      rawDataSummary: `${omsiData.dateResults.length} products, ${sessions.length} sessions`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('ERROR', 'Scrape failed', { error: errorMessage });

    return {
      success: false,
      sessions,
      error: errorMessage,
      scrapedAt: Date.now(),
      durationMs: Date.now() - startTime,
      pagesScraped: 0,
    };
  }
}

/**
 * Extract a session from OMSI product/session data
 */
function extractSession(
  product: OmsiCampProduct,
  session: OmsiSession | null,
  log: ScraperLogger,
): ScrapedSession | null {
  if (!product.name) return null;

  // OMSI location with actual address
  const locationName = session?.location || 'OMSI';
  const isMainOmsi = locationName === 'OMSI' || locationName.toLowerCase().includes('omsi');

  const scraped: ScrapedSession = {
    name: product.name,
    description: product.shortDescription || undefined,
    category: product.subject || 'STEM',
    ageGradeRaw: product.gradeLevel || undefined,
    location: locationName,
    // Include actual OMSI address and coordinates for the main location
    locationAddress: isMainOmsi
      ? {
          street: '1945 SE Water Ave',
          city: 'Portland',
          state: 'OR',
          zip: '97214',
        }
      : undefined,
    locationLatitude: isMainOmsi ? 45.5084 : undefined,
    locationLongitude: isMainOmsi ? -122.6655 : undefined,
    isAvailable: session?.available ?? true,
    availabilityRaw: session?.available ? 'Available' : 'Sold Out',
    registrationUrl: `https://secure.omsi.edu/camps-and-classes/${product.safeURL}`,
    sourceProductId: product.productId,
    sourceSessionId: session?.campClassProductId,
    dateRaw: session?.startDate || undefined,
    timeRaw: session?.activityTime || undefined,
    priceRaw: session?.pricing || undefined,
  };

  // Parse price - OMSI format: "$495.00/$550.00" (member/non-member)
  if (session?.pricing) {
    const prices = session.pricing.match(/\$?([\d,]+(?:\.\d{2})?)/g);
    if (prices && prices.length >= 1) {
      const memberPrice = parseFloat(prices[0].replace(/[$,]/g, ''));
      scraped.memberPriceInCents = Math.round(memberPrice * 100);
      if (prices.length >= 2) {
        const regularPrice = parseFloat(prices[1].replace(/[$,]/g, ''));
        scraped.priceInCents = Math.round(regularPrice * 100);
      } else {
        scraped.priceInCents = scraped.memberPriceInCents;
      }
    }
  }

  // Parse dates - OMSI format: "Mar 23, 2026" or "Jun 16 - 20, 2026"
  if (session?.startDate) {
    const dateRange = session.startDate.match(/(\w+\s+\d+)(?:\s*-\s*(\d+))?,?\s*(\d{4})/);
    if (dateRange) {
      const year = dateRange[3];
      const monthDay = dateRange[1];
      const endDay = dateRange[2];

      const startDate = new Date(`${monthDay}, ${year}`);
      if (!isNaN(startDate.getTime())) {
        scraped.startDate = startDate.toISOString().split('T')[0];

        if (endDay) {
          const endDate = new Date(`${monthDay.split(' ')[0]} ${endDay}, ${year}`);
          if (!isNaN(endDate.getTime())) {
            scraped.endDate = endDate.toISOString().split('T')[0];
          }
        } else {
          // Assume 5-day camp (Mon-Fri)
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 4);
          scraped.endDate = endDate.toISOString().split('T')[0];
        }
      }
    }
  }

  // Parse times - OMSI format: "9am-4pm Mon-Fri"
  if (session?.activityTime) {
    const timeMatch = session.activityTime.match(/(\d+)(am|pm)\s*-\s*(\d+)(am|pm)/i);
    if (timeMatch) {
      let dropOffHour = parseInt(timeMatch[1]);
      if (timeMatch[2].toLowerCase() === 'pm' && dropOffHour !== 12) dropOffHour += 12;
      if (timeMatch[2].toLowerCase() === 'am' && dropOffHour === 12) dropOffHour = 0;

      let pickUpHour = parseInt(timeMatch[3]);
      if (timeMatch[4].toLowerCase() === 'pm' && pickUpHour !== 12) pickUpHour += 12;
      if (timeMatch[4].toLowerCase() === 'am' && pickUpHour === 12) pickUpHour = 0;

      scraped.dropOffHour = dropOffHour;
      scraped.dropOffMinute = 0;
      scraped.pickUpHour = pickUpHour;
      scraped.pickUpMinute = 0;
    }
  }

  // Parse grades
  if (product.gradeLevel) {
    const gradeMatch = product.gradeLevel.match(/(\d+)\s*[-,]\s*(\d+)/);
    if (gradeMatch) {
      scraped.minGrade = parseInt(gradeMatch[1]);
      scraped.maxGrade = parseInt(gradeMatch[2]);
    }
  }

  // Extract image URL from imageName
  if (product.imageName) {
    // OMSI image URL pattern: /resource/{timestamp}/Camps_Classes_Images/{imageName}
    const imageUrl = `https://secure.omsi.edu/resource/1737139886000/Camps_Classes_Images/${product.imageName}`;
    scraped.imageUrls = [imageUrl];
  }

  log('DEBUG', 'Extracted session', {
    name: scraped.name,
    startDate: scraped.startDate,
    price: scraped.priceInCents,
  });

  return scraped;
}

// Export as registry entry
export const omsiScraper: ScraperRegistryEntry = {
  name: 'omsi',
  description: 'OMSI Science Camps - Salesforce Visualforce API scraper',
  scrape,
  domains: ['omsi.edu', 'secure.omsi.edu'],
};

export default omsiScraper;
