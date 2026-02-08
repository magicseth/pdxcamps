/**
 * Find available creative camp domain names
 * Uses Fastly Domain Management API (powered by Domainr)
 */

const FASTLY_API_KEY = 'An-RzN1xbinO6lB-xuy-8wHA_ALKdXzY';

// Creative camp name prefixes to check - prioritized by quality
const prefixes = [
  // Best/Short
  'wow', 'go', 'my', 'fun', 'the', 'all', 'ace', 'top', 'joy',
  // Excitement/Energy
  'epic', 'super', 'mega', 'rad', 'wild', 'boom', 'spark', 'flash', 'zoom', 'zip',
  // Nature
  'sunny', 'bright', 'shine', 'sky', 'lake', 'trail', 'peak',
  // Fun/Play
  'play', 'happy', 'magic', 'dream', 'star', 'wonder',
  // Adventure
  'quest', 'explore', 'discover', 'scout',
  // Action
  'leap', 'jump', 'splash', 'soar', 'fly', 'launch', 'rocket',
  // Community
  'buddy', 'pal', 'crew', 'squad', 'tribe', 'club',
  // Kid-focused
  'kids', 'kidz', 'junior', 'little', 'mini', 'tiny',
  // Summer
  'summer', 'golden', 'warm',
];

const suffixes = ['camps', 'camp'];
const tlds = ['.com'];

async function checkDomainFastly(domain: string): Promise<{ available: boolean; status: string }> {
  try {
    const response = await fetch(
      `https://api.fastly.com/domain-management/v1/tools/status?domain=${encodeURIComponent(domain)}`,
      {
        method: 'GET',
        headers: {
          'Fastly-Key': FASTLY_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { available: false, status: `error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();

    // Fastly returns status like "undelegated inactive" for available domains
    // "undelegated" or "inactive" = available
    // "active", "marketed", "parked" = taken
    const statusStr = data.status || '';
    const isAvailable = statusStr.includes('undelegated') || statusStr.includes('inactive');

    return { available: isAvailable, status: statusStr };
  } catch (error) {
    return { available: false, status: `error: ${error}` };
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('# Creative Camp Domain Availability\n');
  console.log('Checking domain availability via Fastly API...\n');

  const available: string[] = [];
  const allDomains: string[] = [];

  // Generate all domain combinations
  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      for (const tld of tlds) {
        allDomains.push(prefix + suffix + tld);
      }
    }
  }

  console.log(`Total domains to check: ${allDomains.length}\n`);

  // Check domains in parallel batches for speed
  const batchSize = 5;
  for (let i = 0; i < allDomains.length; i += batchSize) {
    const batch = allDomains.slice(i, i + batchSize);
    process.stdout.write(`\r[${i + batch.length}/${allDomains.length}] Checking...`.padEnd(60));

    const results = await Promise.all(
      batch.map(async (domain) => {
        const result = await checkDomainFastly(domain);
        return { domain, ...result };
      })
    );

    for (const result of results) {
      if (result.available) {
        console.log(`\n  ✅ ${result.domain} - AVAILABLE (${result.status})`);
        available.push(result.domain);
      }
    }

    // Small delay between batches
    await sleep(100);
  }

  // Summary
  console.log('\n\n# Summary\n');
  console.log(`## Available Domains (${available.length} found)\n`);

  if (available.length === 0) {
    console.log('No domains available.');
  } else {
    // Sort by length (shorter = better)
    available.sort((a, b) => a.length - b.length);
    for (const domain of available) {
      console.log(`- ${domain}`);
    }
  }
}

main().catch(console.error);
