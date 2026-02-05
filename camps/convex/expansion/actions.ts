"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

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
 * Check domain availability and pricing via Porkbun
 */
export const checkDomainAvailability = action({
  args: {
    domain: v.string(),
  },
  handler: async (_, args): Promise<{
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
        error: "Porkbun API credentials not configured",
      };
    }

    try {
      // Porkbun pricing endpoint checks availability
      const response = await fetch("https://api.porkbun.com/api/json/v3/pricing/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      if (data.status !== "SUCCESS" || !data.pricing) {
        return {
          available: false,
          error: data.message || "Failed to get pricing",
        };
      }

      // Extract TLD from domain
      const tld = args.domain.split(".").pop() || "com";
      const pricing = data.pricing[tld];

      if (!pricing) {
        return {
          available: false,
          error: `TLD .${tld} not supported`,
        };
      }

      // Check specific domain availability
      const checkResponse = await fetch(
        `https://api.porkbun.com/api/json/v3/domain/checkDomain/${args.domain}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apikey: apiKey,
            secretapikey: secretKey,
          }),
        }
      );

      if (!checkResponse.ok) {
        return {
          available: false,
          error: `Domain check failed: ${checkResponse.status}`,
        };
      }

      const checkData = await checkResponse.json();

      // New API returns { status: "SUCCESS", response: { avail: "yes"|"no", price: "..." } }
      const isAvailable = checkData.status === "SUCCESS" && checkData.response?.avail === "yes";
      return {
        available: isAvailable,
        price: checkData.response?.price,
        renewalPrice: pricing.renewal,
      };
    } catch (error) {
      return {
        available: false,
        error: `API error: ${error instanceof Error ? error.message : "Unknown error"}`,
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
  handler: async (_, args): Promise<
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
        error: "Porkbun API credentials not configured",
      }));
    }

    const results = [];

    for (const domain of args.domains) {
      try {
        const response = await fetch(
          `https://api.porkbun.com/api/json/v3/domain/checkDomain/${domain}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apikey: apiKey,
              secretapikey: secretKey,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || data.status === "ERROR") {
          results.push({
            domain,
            available: false,
            error: data.message || `API error: ${response.status}`,
          });
          continue;
        }

        // New API returns { status: "SUCCESS", response: { avail: "yes"|"no", price: "..." } }
        const isAvailable = data.status === "SUCCESS" && data.response?.avail === "yes";
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
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },
});

/**
 * Purchase a domain via Porkbun
 */
export const purchaseDomain = action({
  args: {
    domain: v.string(),
    // Contact info for WHOIS (required for registration)
    contactEmail: v.optional(v.string()),
    contactName: v.optional(v.string()),
  },
  handler: async (_, args): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
  }> => {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return {
        success: false,
        error: "Porkbun API credentials not configured",
      };
    }

    try {
      const response = await fetch(
        `https://api.porkbun.com/api/json/v3/domain/register/${args.domain}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apikey: apiKey,
            secretapikey: secretKey,
            // Porkbun uses account contact info by default
            // Add years: 1 for single year registration
            years: 1,
          }),
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Registration failed: ${response.status}`,
        };
      }

      const data: PorkbunRegisterResponse = await response.json();

      if (data.status !== "SUCCESS") {
        return {
          success: false,
          error: data.message || "Registration failed",
        };
      }

      return {
        success: true,
        orderId: data.orderId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
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
  handler: async (_, args): Promise<{
    nameservers?: string[];
    error?: string;
  }> => {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return { error: "Porkbun API credentials not configured" };
    }

    try {
      const response = await fetch(
        `https://api.porkbun.com/api/json/v3/domain/getNameServers/${args.domain}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apikey: apiKey,
            secretapikey: secretKey,
          }),
        }
      );

      if (!response.ok) {
        return { error: `API error: ${response.status}` };
      }

      const data = await response.json();

      if (data.status !== "SUCCESS") {
        return { error: data.message || "Failed to get nameservers" };
      }

      return { nameservers: data.ns || [] };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
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
  handler: async (_, args): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return { success: false, error: "Porkbun API credentials not configured" };
    }

    try {
      const response = await fetch(
        `https://api.porkbun.com/api/json/v3/domain/updateNs/${args.domain}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apikey: apiKey,
            secretapikey: secretKey,
            ns: args.nameservers,
          }),
        }
      );

      if (!response.ok) {
        return { success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json();

      if (data.status !== "SUCCESS") {
        return { success: false, error: data.message || "Failed to update nameservers" };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
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
  handler: async (_, args): Promise<{
    success: boolean;
    zoneId?: string;
    nameservers?: string[];
    error?: string;
  }> => {
    const token = process.env.NETLIFY_ACCESS_TOKEN;

    if (!token) {
      return { success: false, error: "Netlify access token not configured" };
    }

    try {
      // Create DNS zone
      const response = await fetch("https://api.netlify.com/api/v1/dns_zones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Add DNS records to a Netlify zone
 * Sets up A records for root and CNAME for www
 */
export const configureNetlifyDnsRecords = action({
  args: {
    zoneId: v.string(),
    domain: v.string(),
    // Netlify load balancer IP for A record
    netlifyIp: v.optional(v.string()),
  },
  handler: async (_, args): Promise<{
    success: boolean;
    records?: Array<{ type: string; hostname: string; value: string }>;
    error?: string;
  }> => {
    const token = process.env.NETLIFY_ACCESS_TOKEN;

    if (!token) {
      return { success: false, error: "Netlify access token not configured" };
    }

    // Default Netlify load balancer IP
    const netlifyIp = args.netlifyIp || "75.2.60.5";

    const recordsToCreate = [
      // A record for root domain
      {
        type: "A",
        hostname: args.domain,
        value: netlifyIp,
        ttl: 3600,
      },
      // CNAME for www subdomain pointing to Netlify
      {
        type: "CNAME",
        hostname: `www.${args.domain}`,
        value: `${args.domain}.netlify.app`,
        ttl: 3600,
      },
    ];

    const createdRecords = [];

    try {
      for (const record of recordsToCreate) {
        const response = await fetch(
          `https://api.netlify.com/api/v1/dns_zones/${args.zoneId}/dns_records`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(record),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          return {
            success: false,
            error: `Failed to create ${record.type} record: ${errorText}`,
          };
        }

        const created: NetlifyDnsRecord = await response.json();
        createdRecords.push({
          type: created.type,
          hostname: created.hostname,
          value: created.value,
        });
      }

      return {
        success: true,
        records: createdRecords,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Full DNS setup workflow: Create zone, add records, update nameservers
 */
export const setupDnsForDomain = action({
  args: {
    domain: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    zoneId?: string;
    nameservers?: string[];
    error?: string;
  }> => {
    // Step 1: Create Netlify DNS zone
    const zoneResult = await ctx.runAction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).api.expansion.actions.createNetlifyDnsZone,
      { domain: args.domain }
    );

    if (!zoneResult.success || !zoneResult.zoneId) {
      return {
        success: false,
        error: zoneResult.error || "Failed to create DNS zone",
      };
    }

    // Step 2: Add DNS records
    const recordsResult = await ctx.runAction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).api.expansion.actions.configureNetlifyDnsRecords,
      { zoneId: zoneResult.zoneId, domain: args.domain }
    );

    if (!recordsResult.success) {
      return {
        success: false,
        zoneId: zoneResult.zoneId,
        error: recordsResult.error || "Failed to create DNS records",
      };
    }

    // Step 3: Update nameservers at Porkbun (if we have Netlify nameservers)
    if (zoneResult.nameservers && zoneResult.nameservers.length > 0) {
      const nsResult = await ctx.runAction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ctx as any).api.expansion.actions.updateNameservers,
        { domain: args.domain, nameservers: zoneResult.nameservers }
      );

      if (!nsResult.success) {
        return {
          success: false,
          zoneId: zoneResult.zoneId,
          nameservers: zoneResult.nameservers,
          error: `DNS zone created but nameserver update failed: ${nsResult.error}`,
        };
      }
    }

    return {
      success: true,
      zoneId: zoneResult.zoneId,
      nameservers: zoneResult.nameservers,
    };
  },
});
