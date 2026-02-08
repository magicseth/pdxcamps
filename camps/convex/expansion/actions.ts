'use node';

import { action, internalAction } from '../_generated/server';
import { api, internal } from '../_generated/api';
import { v } from 'convex/values';

// Porkbun API types
interface PorkbunPricingResponse {
  status: string;
  pricing?: {
    [domain: string]: {
      registration: string;
      renewal: string;
      transfer: string;
    };
  };
  message?: string;
}

interface PorkbunRegisterResponse {
  status: string;
  domain?: string;
  orderId?: string;
  message?: string;
}

// Netlify API types
interface NetlifyDnsZone {
  id: string;
  name: string;
  records: unknown[];
}

interface NetlifyDnsRecord {
  id: string;
  hostname: string;
  type: string;
  value: string;
  ttl: number;
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check domain availability using Fastly Domain Research API (powered by Domainr)
 * Fast and reliable - no strict rate limiting like Porkbun
 * Endpoint: https://api.fastly.com/domain-management/v1/tools/status
 */
async function checkDomainFastly(
  domain: string,
  apiKey: string,
): Promise<{ available: boolean; status?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://api.fastly.com/domain-management/v1/tools/status?domain=${encodeURIComponent(domain)}`,
      {
        method: 'GET',
        headers: {
          'Fastly-Key': apiKey,
          'Accept': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        available: false,
        error: `Fastly API error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();

    // Fastly returns status like "undelegated inactive" for available domains
    // "undelegated" or "inactive" = available
    // "active", "marketed", "parked" = taken
    const statusStr = data.status || '';
    const isAvailable = statusStr.includes('undelegated') || statusStr.includes('inactive');

    return {
      available: isAvailable,
      status: statusStr,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check multiple domains using Fastly Domain Research API
 * Much faster than Porkbun - can check in parallel
 */
async function checkDomainsWithFastly(
  domains: string[],
  apiKey: string,
): Promise<Array<{ domain: string; available: boolean; price?: string; error?: string }>> {
  // Check all domains in parallel - Fastly doesn't have strict rate limits
  const results = await Promise.all(
    domains.map(async (domain) => {
      const result = await checkDomainFastly(domain, apiKey);
      return {
        domain,
        available: result.available,
        // Fastly doesn't return price - we'll get actual price from Porkbun when purchasing
        price: result.available ? undefined : undefined,
        error: result.error,
      };
    }),
  );

  return results;
}

/**
 * Bulk domain availability check using Fastly Domain Research API
 * Fast parallel checking - completes in ~1-2 seconds for multiple domains
 */
export const checkDomainsQuick = action({
  args: {
    domains: v.array(v.string()),
  },
  handler: async (
    _,
    args,
  ): Promise<
    Array<{
      domain: string;
      available: boolean;
      price?: string;
      error?: string;
    }>
  > => {
    const fastlyKey = process.env.FASTLY_API_KEY;

    if (!fastlyKey) {
      return args.domains.map((domain) => ({
        domain,
        available: false,
        error: 'Fastly API key not configured',
      }));
    }

    return checkDomainsWithFastly(args.domains, fastlyKey);
  },
});

/**
 * Get actual price from Porkbun for a specific domain
 * Called when user wants to purchase to verify/get exact price
 */
export const getDomainPrice = action({
  args: {
    domain: v.string(),
  },
  handler: async (
    _,
    args,
  ): Promise<{
    available: boolean;
    price?: string;
    error?: string;
  }> => {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return { available: false, error: 'Porkbun API credentials not configured' };
    }

    try {
      const response = await fetch(`https://api.porkbun.com/api/json/v3/domain/checkDomain/${args.domain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: secretKey,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status === 'ERROR') {
        return {
          available: false,
          error: data.message || `API error: ${response.status}`,
        };
      }

      const isAvailable = data.status === 'SUCCESS' && data.response?.avail === 'yes';
      return {
        available: isAvailable,
        price: data.response?.price,
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Check domain availability and pricing via Porkbun
 */
export const checkDomainAvailability = action({
  args: {
    domain: v.string(),
  },
  handler: async (
    _,
    args,
  ): Promise<{
    available: boolean;
    price?: string;
    renewalPrice?: string;
    error?: string;
  }> => {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return {
        available: false,
        error: 'Porkbun API credentials not configured',
      };
    }

    try {
      // Porkbun pricing endpoint checks availability
      const response = await fetch('https://api.porkbun.com/api/json/v3/pricing/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: secretKey,
        }),
      });

      if (!response.ok) {
        return {
          available: false,
          error: `Porkbun API error: ${response.status}`,
        };
      }

      const data: PorkbunPricingResponse = await response.json();

      if (data.status !== 'SUCCESS' || !data.pricing) {
        return {
          available: false,
          error: data.message || 'Failed to get pricing',
        };
      }

      // Extract TLD from domain
      const tld = args.domain.split('.').pop() || 'com';
      const pricing = data.pricing[tld];

      if (!pricing) {
        return {
          available: false,
          error: `TLD .${tld} not supported`,
        };
      }

      // Check specific domain availability
      const checkResponse = await fetch(`https://api.porkbun.com/api/json/v3/domain/checkDomain/${args.domain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: secretKey,
        }),
      });

      if (!checkResponse.ok) {
        return {
          available: false,
          error: `Domain check failed: ${checkResponse.status}`,
        };
      }

      const checkData = await checkResponse.json();

      // New API returns { status: "SUCCESS", response: { avail: "yes"|"no", price: "..." } }
      const isAvailable = checkData.status === 'SUCCESS' && checkData.response?.avail === 'yes';
      return {
        available: isAvailable,
        price: checkData.response?.price,
        renewalPrice: pricing.renewal,
      };
    } catch (error) {
      return {
        available: false,
        error: `API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

/**
 * Check multiple domains at once
 */
export const checkMultipleDomains = action({
  args: {
    domains: v.array(v.string()),
  },
  handler: async (
    _,
    args,
  ): Promise<
    Array<{
      domain: string;
      available: boolean;
      price?: string;
      error?: string;
    }>
  > => {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return args.domains.map((domain) => ({
        domain,
        available: false,
        error: 'Porkbun API credentials not configured',
      }));
    }

    const results = [];

    for (const domain of args.domains) {
      try {
        const response = await fetch(`https://api.porkbun.com/api/json/v3/domain/checkDomain/${domain}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apikey: apiKey,
            secretapikey: secretKey,
          }),
        });

        const data = await response.json();

        if (!response.ok || data.status === 'ERROR') {
          results.push({
            domain,
            available: false,
            error: data.message || `API error: ${response.status}`,
          });
          continue;
        }

        // New API returns { status: "SUCCESS", response: { avail: "yes"|"no", price: "..." } }
        const isAvailable = data.status === 'SUCCESS' && data.response?.avail === 'yes';
        results.push({
          domain,
          available: isAvailable,
          price: data.response?.price,
        });

        // Porkbun rate limits to 1 check per 10 seconds
        await new Promise((resolve) => setTimeout(resolve, 10500));
      } catch (error) {
        results.push({
          domain,
          available: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  },
});

/**
 * Purchase a domain via Porkbun
 * If price is not provided or wrong, will fetch actual price from Porkbun first
 */
export const purchaseDomain = action({
  args: {
    domain: v.string(),
    // Price from domain check (e.g., "9.73" for $9.73) - optional, will fetch if not provided
    price: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    orderId?: string;
    actualPrice?: string;
    error?: string;
  }> => {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return {
        success: false,
        error: 'Porkbun API credentials not configured',
      };
    }

    // If no price provided or price is empty/invalid, get it from Porkbun first
    let priceToUse = args.price;
    if (!priceToUse || priceToUse.trim() === '' || isNaN(parseFloat(priceToUse))) {
      console.log(`No valid price provided for ${args.domain}, fetching from Porkbun...`);
      const priceResult = await ctx.runAction(api.expansion.actions.getDomainPrice, { domain: args.domain });

      if (!priceResult.available) {
        return {
          success: false,
          error: priceResult.error || 'Domain is not available',
        };
      }

      if (!priceResult.price) {
        return {
          success: false,
          error: 'Could not get price from Porkbun',
        };
      }

      priceToUse = priceResult.price;
      console.log(`Got price ${priceToUse} for ${args.domain}`);
    }

    // Helper to attempt purchase with given price
    async function attemptPurchase(priceStr: string): Promise<{
      success: boolean;
      orderId?: string;
      error?: string;
      needsPriceCheck?: boolean;
    }> {
      const priceFloat = parseFloat(priceStr);
      if (isNaN(priceFloat)) {
        return { success: false, error: `Invalid price: ${priceStr}` };
      }
      const costInPennies = Math.round(priceFloat * 100);

      const response = await fetch(`https://api.porkbun.com/api/json/v3/domain/create/${args.domain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: secretKey,
          cost: costInPennies,
          agreeToTerms: 'yes',
        }),
      });

      const data: PorkbunRegisterResponse = await response.json();

      if (!response.ok || data.status !== 'SUCCESS') {
        const errorMsg = data.message || `Registration failed: ${response.status}`;
        // Check if error is about wrong price
        if (errorMsg.toLowerCase().includes('price') || errorMsg.toLowerCase().includes('cost')) {
          return { success: false, error: errorMsg, needsPriceCheck: true };
        }
        return { success: false, error: errorMsg };
      }

      return {
        success: true,
        orderId: data.orderId ? String(data.orderId) : undefined,
      };
    }

    try {
      // Attempt purchase with the price we have
      const firstAttempt = await attemptPurchase(priceToUse);

      if (firstAttempt.success) {
        return {
          success: true,
          orderId: firstAttempt.orderId,
          actualPrice: priceToUse,
        };
      }

      // If price was wrong, get actual price from Porkbun and retry
      if (firstAttempt.needsPriceCheck) {
        console.log(`Price mismatch for ${args.domain}, fetching actual price from Porkbun...`);

        const priceResult = await ctx.runAction(api.expansion.actions.getDomainPrice, { domain: args.domain });

        if (!priceResult.available || !priceResult.price) {
          return {
            success: false,
            error: priceResult.error || 'Domain no longer available',
          };
        }

        // Retry with actual price
        const secondAttempt = await attemptPurchase(priceResult.price);

        if (secondAttempt.success) {
          return {
            success: true,
            orderId: secondAttempt.orderId,
            actualPrice: priceResult.price,
          };
        }

        return {
          success: false,
          actualPrice: priceResult.price,
          error: secondAttempt.error,
        };
      }

      return {
        success: false,
        error: firstAttempt.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Get nameservers for a domain (to configure at registrar)
 */
export const getNameservers = action({
  args: {
    domain: v.string(),
  },
  handler: async (
    _,
    args,
  ): Promise<{
    nameservers?: string[];
    error?: string;
  }> => {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return { error: 'Porkbun API credentials not configured' };
    }

    try {
      const response = await fetch(`https://api.porkbun.com/api/json/v3/domain/getNs/${args.domain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: secretKey,
        }),
      });

      if (!response.ok) {
        return { error: `API error: ${response.status}` };
      }

      const data = await response.json();

      if (data.status !== 'SUCCESS') {
        return { error: data.message || 'Failed to get nameservers' };
      }

      return { nameservers: data.ns || [] };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Update nameservers for a domain to point to Netlify
 */
export const updateNameservers = action({
  args: {
    domain: v.string(),
    nameservers: v.array(v.string()),
  },
  handler: async (
    _,
    args,
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return { success: false, error: 'Porkbun API credentials not configured' };
    }

    try {
      const response = await fetch(`https://api.porkbun.com/api/json/v3/domain/updateNs/${args.domain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: secretKey,
          ns: args.nameservers,
        }),
      });

      if (!response.ok) {
        return { success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json();

      if (data.status !== 'SUCCESS') {
        return { success: false, error: data.message || 'Failed to update nameservers' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Create a DNS zone in Netlify for the domain
 */
export const createNetlifyDnsZone = action({
  args: {
    domain: v.string(),
  },
  handler: async (
    _,
    args,
  ): Promise<{
    success: boolean;
    zoneId?: string;
    nameservers?: string[];
    error?: string;
  }> => {
    const token = process.env.NETLIFY_ACCESS_TOKEN;

    if (!token) {
      return { success: false, error: 'Netlify access token not configured' };
    }

    try {
      // Create DNS zone
      const response = await fetch('https://api.netlify.com/api/v1/dns_zones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: args.domain,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Netlify API error: ${response.status} - ${errorText}`,
        };
      }

      const zone: NetlifyDnsZone & { dns_servers?: string[] } = await response.json();

      return {
        success: true,
        zoneId: zone.id,
        nameservers: zone.dns_servers,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * List DNS records for a Netlify DNS zone
 */
export const listNetlifyDnsRecords = action({
  args: { zoneId: v.string() },
  handler: async (_, args): Promise<{
    success: boolean;
    records?: Array<{ id: string; type: string; hostname: string; value: string; ttl?: number; priority?: number }>;
    error?: string;
  }> => {
    const token = process.env.NETLIFY_ACCESS_TOKEN;
    if (!token) return { success: false, error: 'Netlify access token not configured' };

    try {
      const response = await fetch(
        `https://api.netlify.com/api/v1/dns_zones/${args.zoneId}/dns_records`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) return { success: false, error: `API error: ${response.status}` };

      const records = await response.json();
      return {
        success: true,
        records: records.map((r: Record<string, unknown>) => ({
          id: r.id,
          type: r.type,
          hostname: r.hostname,
          value: r.value,
          ttl: r.ttl,
          priority: r.priority,
        })),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
});

/**
 * Delete a DNS record from a Netlify DNS zone
 */
export const deleteNetlifyDnsRecord = action({
  args: { zoneId: v.string(), recordId: v.string() },
  handler: async (_, args): Promise<{ success: boolean; error?: string }> => {
    const token = process.env.NETLIFY_ACCESS_TOKEN;
    if (!token) return { success: false, error: 'Netlify access token not configured' };

    try {
      const response = await fetch(
        `https://api.netlify.com/api/v1/dns_zones/${args.zoneId}/dns_records/${args.recordId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `API error: ${response.status} - ${text}` };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
});

/**
 * Remove a domain from a specific Netlify site
 */
export const removeDomainFromNetlifySite = action({
  args: {
    siteId: v.string(),
    domain: v.string(),
  },
  handler: async (_, args): Promise<{ success: boolean; error?: string }> => {
    const token = process.env.NETLIFY_ACCESS_TOKEN;
    if (!token) return { success: false, error: 'Netlify access token not configured' };

    try {
      const getResponse = await fetch(`https://api.netlify.com/api/v1/sites/${args.siteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!getResponse.ok) {
        return { success: false, error: `Failed to get site info: ${getResponse.status}` };
      }

      const site = await getResponse.json();
      const currentAliases: string[] = site.domain_aliases || [];
      const newAliases = currentAliases.filter(
        (a) => a !== args.domain && a !== `www.${args.domain}`,
      );

      const patchResponse = await fetch(`https://api.netlify.com/api/v1/sites/${args.siteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ domain_aliases: newAliases }),
      });

      if (!patchResponse.ok) {
        const errorText = await patchResponse.text();
        return { success: false, error: `Failed to remove domain: ${patchResponse.status} - ${errorText}` };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
});

/**
 * Add a custom domain to the Netlify site
 * This connects the domain to the project so Netlify serves it
 */
export const addDomainToNetlifySite = action({
  args: {
    domain: v.string(),
  },
  handler: async (
    _,
    args,
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const token = process.env.NETLIFY_ACCESS_TOKEN;
    const siteId = process.env.NETLIFY_SITE_ID;

    if (!token) {
      return { success: false, error: 'Netlify access token not configured' };
    }
    if (!siteId) {
      return { success: false, error: 'Netlify site ID not configured' };
    }

    try {
      // First, get current domain aliases
      const getResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!getResponse.ok) {
        return {
          success: false,
          error: `Failed to get site info: ${getResponse.status}`,
        };
      }

      const site = await getResponse.json();
      const currentAliases: string[] = site.domain_aliases || [];

      // Add new domain and www if not already present
      const newAliases = [...new Set([...currentAliases, args.domain, `www.${args.domain}`])];

      // PATCH the site with updated domain_aliases
      const patchResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ domain_aliases: newAliases }),
      });

      if (!patchResponse.ok) {
        const errorText = await patchResponse.text();
        return {
          success: false,
          error: `Failed to add domain to site: ${patchResponse.status} - ${errorText}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Debug: Get current Netlify site domain configuration
 */
export const getNetlifySiteConfig = action({
  args: {},
  handler: async (): Promise<{
    customDomain?: string;
    domainAliases?: string[];
    ssl?: unknown;
    sslUrl?: string;
    error?: string;
  }> => {
    const token = process.env.NETLIFY_ACCESS_TOKEN;
    const siteId = process.env.NETLIFY_SITE_ID;

    if (!token || !siteId) {
      return { error: 'Netlify credentials not configured' };
    }

    try {
      const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return { error: `Netlify API error: ${response.status}` };
      }

      const site = await response.json();
      return {
        customDomain: site.custom_domain,
        domainAliases: site.domain_aliases,
        ssl: site.ssl,
        sslUrl: site.ssl_url,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
});

/**
 * List all Netlify DNS zones to check domain configuration
 */
export const listNetlifyDnsZones = action({
  args: {},
  handler: async (): Promise<{
    zones?: Array<{ id: string; name: string }>;
    error?: string;
  }> => {
    const token = process.env.NETLIFY_ACCESS_TOKEN;

    if (!token) {
      return { error: 'Netlify credentials not configured' };
    }

    try {
      const response = await fetch('https://api.netlify.com/api/v1/dns_zones', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return { error: `Netlify API error: ${response.status}` };
      }

      const zones = await response.json();
      return {
        zones: zones.map((z: { id: string; name: string; dns_servers?: string[] }) => ({
          id: z.id,
          name: z.name,
          nameservers: z.dns_servers,
        })),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
});

/**
 * Check SSL status for the Netlify site
 */
export const getSslStatus = action({
  args: {},
  handler: async (): Promise<{
    success: boolean;
    ssl?: unknown;
    error?: string;
  }> => {
    const token = process.env.NETLIFY_ACCESS_TOKEN;
    const siteId = process.env.NETLIFY_SITE_ID;

    if (!token || !siteId) {
      return { success: false, error: 'Netlify credentials not configured' };
    }

    try {
      const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/ssl`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to get SSL status: ${response.status} - ${errorText}`,
        };
      }

      const ssl = await response.json();
      return { success: true, ssl };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Provision SSL for the Netlify site (triggers Let's Encrypt cert)
 */
export const provisionSsl = action({
  args: {},
  handler: async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const token = process.env.NETLIFY_ACCESS_TOKEN;
    const siteId = process.env.NETLIFY_SITE_ID;

    if (!token || !siteId) {
      return { success: false, error: 'Netlify credentials not configured' };
    }

    try {
      // Netlify provisions SSL automatically when domain is added
      // but we can trigger it explicitly via the certificates endpoint
      const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/ssl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `SSL provision failed: ${response.status} - ${errorText}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Full DNS setup workflow: Add domain to site, create zone, update nameservers
 */
export const setupDnsForDomain = action({
  args: {
    domain: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    zoneId?: string;
    nameservers?: string[];
    error?: string;
  }> => {
    // Step 1: Add domain to Netlify site (connects domain to project)
    const siteResult = await ctx.runAction(api.expansion.actions.addDomainToNetlifySite, { domain: args.domain });

    if (!siteResult.success) {
      return {
        success: false,
        error: siteResult.error || 'Failed to add domain to Netlify site',
      };
    }

    // Step 2: Create Netlify DNS zone
    const zoneResult = await ctx.runAction(api.expansion.actions.createNetlifyDnsZone, { domain: args.domain });

    if (!zoneResult.success || !zoneResult.zoneId) {
      return {
        success: false,
        error: zoneResult.error || 'Failed to create DNS zone',
      };
    }

    // Step 3: Update nameservers at Porkbun (if we have Netlify nameservers)
    if (zoneResult.nameservers && zoneResult.nameservers.length > 0) {
      const nsResult = await ctx.runAction(api.expansion.actions.updateNameservers, {
        domain: args.domain,
        nameservers: zoneResult.nameservers,
      });

      if (!nsResult.success) {
        return {
          success: false,
          zoneId: zoneResult.zoneId,
          nameservers: zoneResult.nameservers,
          error: `DNS zone created but nameserver update failed: ${nsResult.error}`,
        };
      }
    }

    // Step 4: Trigger SSL provisioning
    try {
      await ctx.runAction(api.expansion.actions.provisionSsl, {});
    } catch (sslError) {
      console.warn(`SSL provisioning attempt: ${sslError instanceof Error ? sslError.message : 'Unknown error'}`);
    }

    return {
      success: true,
      zoneId: zoneResult.zoneId,
      nameservers: zoneResult.nameservers,
    };
  },
});

/**
 * Ensure a domain is fully configured in Netlify (idempotent)
 * Checks existing config and only sets up what's missing
 */
export const ensureDomainConfigured = action({
  args: {
    domain: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    addedToSite: boolean;
    createdDnsZone: boolean;
    zoneId?: string;
    error?: string;
  }> => {
    const token = process.env.NETLIFY_ACCESS_TOKEN;
    const siteId = process.env.NETLIFY_SITE_ID;

    if (!token || !siteId) {
      return {
        success: false,
        addedToSite: false,
        createdDnsZone: false,
        error: 'Netlify credentials not configured',
      };
    }

    let addedToSite = false;
    let createdDnsZone = false;
    let zoneId: string | undefined;

    try {
      // Step 1: Check if domain is already in site aliases
      const siteResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!siteResponse.ok) {
        return {
          success: false,
          addedToSite: false,
          createdDnsZone: false,
          error: `Failed to get site info: ${siteResponse.status}`,
        };
      }

      const site = await siteResponse.json();
      const currentAliases: string[] = site.domain_aliases || [];
      const domainInAliases = currentAliases.includes(args.domain) || currentAliases.includes(`www.${args.domain}`);

      // Add domain to site if not present
      if (!domainInAliases) {
        const addResult = await ctx.runAction(api.expansion.actions.addDomainToNetlifySite, { domain: args.domain });

        if (!addResult.success) {
          return {
            success: false,
            addedToSite: false,
            createdDnsZone: false,
            error: addResult.error || 'Failed to add domain to site',
          };
        }
        addedToSite = true;
      }

      // Step 2: Check if DNS zone exists
      const zonesResponse = await fetch('https://api.netlify.com/api/v1/dns_zones', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!zonesResponse.ok) {
        return {
          success: false,
          addedToSite,
          createdDnsZone: false,
          error: `Failed to list DNS zones: ${zonesResponse.status}`,
        };
      }

      const zones = await zonesResponse.json();
      const existingZone = zones.find((z: { name: string; id: string }) => z.name === args.domain);

      if (existingZone) {
        zoneId = existingZone.id;
      } else {
        // Create DNS zone
        const zoneResult = await ctx.runAction(api.expansion.actions.createNetlifyDnsZone, { domain: args.domain });

        if (zoneResult.success && zoneResult.zoneId) {
          createdDnsZone = true;
          zoneId = zoneResult.zoneId;

          // Update nameservers at registrar if possible
          if (zoneResult.nameservers && zoneResult.nameservers.length > 0) {
            await ctx.runAction(api.expansion.actions.updateNameservers, {
              domain: args.domain,
              nameservers: zoneResult.nameservers,
            });
          }
        }
      }

      // Step 3: Provision SSL if we made changes
      if (addedToSite || createdDnsZone) {
        try {
          await ctx.runAction(api.expansion.actions.provisionSsl, {});
        } catch (sslError) {
          // SSL provisioning can fail if DNS hasn't propagated yet - non-fatal
          console.warn(`SSL provisioning attempt: ${sslError instanceof Error ? sslError.message : 'Unknown error'}`);
        }
      }

      return {
        success: true,
        addedToSite,
        createdDnsZone,
        zoneId,
      };
    } catch (error) {
      return {
        success: false,
        addedToSite,
        createdDnsZone,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ============ RESEND DOMAIN PROVISIONING ============

/**
 * Register a domain in Resend for sending email
 * Returns the domain ID and required DNS records (SPF, DKIM, MX)
 */
export const setupResendDomain = action({
  args: {
    domain: v.string(),
  },
  handler: async (
    _,
    args,
  ): Promise<{
    success: boolean;
    domainId?: string;
    records?: Array<{
      type: string;
      name: string;
      value: string;
      priority?: number;
      ttl?: string;
    }>;
    error?: string;
  }> => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    try {
      const { data, error } = await resend.domains.create({ name: args.domain });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'No data returned from Resend' };
      }

      return {
        success: true,
        domainId: data.id,
        records: data.records?.map((r) => ({
          type: r.type,
          name: r.name,
          value: r.value,
          priority: r.priority ?? undefined,
          ttl: r.ttl,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Trigger verification of a Resend domain
 */
export const verifyResendDomain = action({
  args: {
    domainId: v.string(),
  },
  handler: async (
    _,
    args,
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    try {
      const { error } = await resend.domains.verify(args.domainId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Check the verification status of a Resend domain
 */
export const checkResendDomainStatus = action({
  args: {
    domainId: v.string(),
  },
  handler: async (
    _,
    args,
  ): Promise<{
    success: boolean;
    status?: string;
    records?: Array<{
      type: string;
      name: string;
      value: string;
      status: string;
      priority?: number;
    }>;
    error?: string;
  }> => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    try {
      const { data, error } = await resend.domains.get(args.domainId);

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'No data returned from Resend' };
      }

      return {
        success: true,
        status: data.status,
        records: data.records?.map((r) => ({
          type: r.type,
          name: r.name,
          value: r.value,
          status: r.status,
          priority: r.priority ?? undefined,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * List all Resend domains with their records and status
 */
export const listResendDomains = action({
  args: {},
  handler: async (): Promise<{
    success: boolean;
    domains?: Array<{
      id: string;
      name: string;
      status: string;
      records?: Array<{ type: string; name: string; value: string; status: string; priority?: number }>;
    }>;
    error?: string;
  }> => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    try {
      const { data, error } = await resend.domains.list();
      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: 'No data returned' };

      // Get records for each domain
      const domains = await Promise.all(
        data.data.map(async (d) => {
          const detail = await resend.domains.get(d.id);
          return {
            id: d.id,
            name: d.name,
            status: d.status,
            records: detail.data?.records?.map((r) => ({
              type: r.type,
              name: r.name,
              value: r.value,
              status: r.status,
              priority: r.priority ?? undefined,
            })),
          };
        }),
      );

      return { success: true, domains };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
});

// ============ NETLIFY DNS RECORD MANAGEMENT ============

/**
 * Add DNS records to a Netlify DNS zone
 * Used to add Resend-required DKIM/SPF/MX records
 */
export const addNetlifyDnsRecords = action({
  args: {
    zoneId: v.string(),
    records: v.array(
      v.object({
        type: v.string(),
        hostname: v.string(),
        value: v.string(),
        priority: v.optional(v.number()),
        ttl: v.optional(v.number()),
      }),
    ),
  },
  handler: async (
    _,
    args,
  ): Promise<{
    success: boolean;
    created: number;
    errors: string[];
  }> => {
    const token = process.env.NETLIFY_ACCESS_TOKEN;
    if (!token) {
      return { success: false, created: 0, errors: ['NETLIFY_ACCESS_TOKEN not configured'] };
    }

    let created = 0;
    const errors: string[] = [];

    for (const record of args.records) {
      try {
        const response = await fetch(
          `https://api.netlify.com/api/v1/dns_zones/${args.zoneId}/dns_records`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              type: record.type,
              hostname: record.hostname,
              value: record.value,
              priority: record.priority,
              ttl: record.ttl || 3600,
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          errors.push(`${record.type} ${record.hostname}: ${response.status} - ${errorText}`);
        } else {
          created++;
        }
      } catch (error) {
        errors.push(
          `${record.type} ${record.hostname}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return {
      success: errors.length === 0,
      created,
      errors,
    };
  },
});

// ============ EMAIL SETUP ORCHESTRATOR ============

/**
 * Full email setup for a domain:
 * 1. Register domain in Resend
 * 2. Add required DNS records to Netlify
 * 3. Trigger Resend verification
 * 4. Save Resend domain ID on the market record
 */
export const setupEmailForDomain = action({
  args: {
    marketKey: v.string(),
    domain: v.string(),
    netlifyZoneId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    resendDomainId?: string;
    dnsRecordsAdded?: number;
    error?: string;
  }> => {
    // Step 1: Register domain in Resend
    const resendResult = await ctx.runAction(api.expansion.actions.setupResendDomain, {
      domain: args.domain,
    });

    if (!resendResult.success || !resendResult.domainId) {
      return {
        success: false,
        error: `Resend domain registration failed: ${resendResult.error}`,
      };
    }

    // Step 2: Map Resend DNS records to Netlify format and add them
    const dnsRecords = (resendResult.records || []).map((r) => ({
      type: r.type,
      hostname: r.name,
      value: r.value,
      priority: r.priority,
      ttl: 3600,
    }));

    if (dnsRecords.length > 0) {
      const dnsResult = await ctx.runAction(api.expansion.actions.addNetlifyDnsRecords, {
        zoneId: args.netlifyZoneId,
        records: dnsRecords,
      });

      if (!dnsResult.success) {
        // Non-fatal: DNS records may partially succeed
        console.warn(`Some DNS records failed: ${dnsResult.errors.join(', ')}`);
      }
    }

    // Step 3: Trigger Resend domain verification
    await ctx.runAction(api.expansion.actions.verifyResendDomain, {
      domainId: resendResult.domainId,
    });

    // Step 4: Save Resend domain ID on the market record
    await ctx.runMutation(api.expansion.mutations.recordResendDomain, {
      marketKey: args.marketKey,
      domain: args.domain,
      resendDomainId: resendResult.domainId,
    });

    return {
      success: true,
      resendDomainId: resendResult.domainId,
      dnsRecordsAdded: dnsRecords.length,
    };
  },
});

/**
 * Create a city with full automation: DB record + Netlify domain setup
 * This is the preferred way to create new cities as it handles everything
 */
export const createCityWithDomainSetup = action({
  args: {
    marketKey: v.string(),
    name: v.string(),
    slug: v.string(),
    state: v.string(),
    timezone: v.string(),
    centerLatitude: v.number(),
    centerLongitude: v.number(),
    brandName: v.string(),
    domain: v.string(),
    fromEmail: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    cityId?: string;
    domainConfigured: boolean;
    error?: string;
  }> => {
    // Step 1: Create the city in the database
    let cityId: string;
    try {
      const result = await ctx.runMutation(api.expansion.mutations.createCityForMarket, args);
      cityId = result.cityId;
    } catch (error) {
      return {
        success: false,
        domainConfigured: false,
        error: `City creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    // Step 2: Configure domain in Netlify
    const domainResult = await ctx.runAction(api.expansion.actions.ensureDomainConfigured, { domain: args.domain });

    if (!domainResult.success) {
      // City was created but domain setup failed - log but don't fail
      console.error(`Domain setup failed for ${args.domain}: ${domainResult.error}`);
      return {
        success: true,
        cityId,
        domainConfigured: false,
        error: `City created but domain setup failed: ${domainResult.error}`,
      };
    }

    return {
      success: true,
      cityId,
      domainConfigured: true,
    };
  },
});

/**
 * Setup all domains for active cities that aren't configured in Netlify
 * Run this to catch any cities that were created without proper Netlify setup
 */
export const ensureAllCityDomainsConfigured = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    processed: Array<{
      city: string;
      domain: string;
      success: boolean;
      addedToSite: boolean;
      createdDnsZone: boolean;
      error?: string;
    }>;
  }> => {
    // Get all active cities with domains
    const cities = await ctx.runQuery(api.cities.queries.listAllCities, {});

    const results = [];

    for (const city of cities) {
      if (!city.domain || !city.isActive) continue;

      const result = await ctx.runAction(api.expansion.actions.ensureDomainConfigured, { domain: city.domain });

      results.push({
        city: city.name,
        domain: city.domain,
        success: result.success,
        addedToSite: result.addedToSite,
        createdDnsZone: result.createdDnsZone,
        error: result.error,
      });
    }

    return { processed: results };
  },
});

// ============================================
// WORKFLOW HELPERS
// ============================================

/**
 * Find first available domain from a list and purchase it.
 * Used by the market launch workflow.
 */
export const findAndPurchaseDomain = internalAction({
  args: {
    marketKey: v.string(),
    suggestedDomains: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; domain?: string; error?: string }> => {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretApiKey = process.env.PORKBUN_SECRET_API_KEY;

    if (!apiKey || !secretApiKey) {
      return { success: false, error: 'Porkbun API credentials not configured' };
    }

    for (const domain of args.suggestedDomains) {
      try {
        // Check availability
        const checkResponse = await fetch('https://porkbun.com/api/json/v3/domain/checkAvailability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secretapikey: secretApiKey,
            apikey: apiKey,
            domain,
          }),
        });

        const checkData = await checkResponse.json();

        if (checkData.status === 'SUCCESS' && checkData.yourPrice) {
          console.log(`[${args.marketKey}] Domain ${domain} available at $${checkData.yourPrice}`);

          // Select domain
          await ctx.runMutation(api.expansion.mutations.selectDomain, {
            marketKey: args.marketKey,
            domain,
          });

          // Purchase it
          const purchaseResponse = await fetch('https://porkbun.com/api/json/v3/domain/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              secretapikey: secretApiKey,
              apikey: apiKey,
              domain,
            }),
          });

          const purchaseData = await purchaseResponse.json();

          if (purchaseData.status === 'SUCCESS') {
            // Record purchase
            await ctx.runMutation(api.expansion.mutations.recordDomainPurchase, {
              marketKey: args.marketKey,
              domain,
              porkbunOrderId: purchaseData.orderId?.toString(),
            });

            // Also add to domains array
            await ctx.runMutation(api.expansion.mutations.addDomain, {
              marketKey: args.marketKey,
              domain,
              orderId: purchaseData.orderId?.toString(),
              makePrimary: true,
            });

            return { success: true, domain };
          } else {
            console.log(`[${args.marketKey}] Purchase failed for ${domain}: ${purchaseData.message}`);
          }
        } else {
          console.log(`[${args.marketKey}] Domain ${domain} not available`);
        }
      } catch (error) {
        console.error(`[${args.marketKey}] Error checking ${domain}:`, error instanceof Error ? error.message : error);
      }
    }

    return { success: false, error: `None of ${args.suggestedDomains.length} suggested domains were available` };
  },
});
