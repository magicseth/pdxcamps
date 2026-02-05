/**
 * Find available domains for summer camp markets
 * Uses Domainr API to check availability
 */

// Market codes and variations to check
const markets = [
  // Tier 1
  { city: "Dallas-Fort Worth", codes: ["dfw", "dallas", "dtx"] },
  { city: "Seattle", codes: ["sea", "seattle", "seatown"] },
  { city: "Houston", codes: ["hou", "houston", "htx"] },
  { city: "San Francisco", codes: ["sf", "sfo", "bayarea", "bay"] },
  { city: "Denver", codes: ["den", "denver", "mile"] },
  { city: "Boston", codes: ["bos", "boston"] }, // boscamps.com taken
  { city: "Washington DC", codes: ["dc", "dmv", "nova"] },
  { city: "Atlanta", codes: ["atl", "atlanta"] },
  { city: "Phoenix", codes: ["phx", "phoenix", "az"] },
  { city: "Minneapolis", codes: ["msp", "mpls", "minn"] },
  // Tier 2
  { city: "Austin", codes: ["aus", "austin", "atx"] },
  { city: "Salt Lake City", codes: ["slc", "saltlake", "utc"] },
  { city: "Charlotte", codes: ["clt", "charlotte"] },
  { city: "Raleigh-Durham", codes: ["rdu", "raleigh", "triangle"] },
  { city: "Nashville", codes: ["nash", "nashville", "music"] },
  { city: "San Diego", codes: ["sd", "sandiego"] },
  { city: "Tampa Bay", codes: ["tpa", "tampa", "tbay"] },
  { city: "San Jose", codes: ["sjc", "sanjose", "southbay"] },
  { city: "Orange County", codes: ["oc", "orangeco", "irvine"] },
  { city: "Cincinnati", codes: ["cin", "cincy", "cinci"] },
  // Tier 3
  { city: "Chicago", codes: ["chi", "chicago"] },
  { city: "San Antonio", codes: ["sat", "sanantonio", "satx"] },
  { city: "Columbus", codes: ["cmh", "columbus", "cbus"] },
  { city: "Indianapolis", codes: ["ind", "indy"] },
  { city: "Orlando", codes: ["orl", "orlando", "mco"] },
  { city: "Kansas City", codes: ["kc", "kansascity"] },
  { city: "Sacramento", codes: ["sac", "sacramento"] },
  { city: "Jacksonville", codes: ["jax", "jacksonville"] },
  { city: "Pittsburgh", codes: ["pit", "pgh", "pittsburgh"] },
  { city: "Ann Arbor", codes: ["a2", "annarbor"] },
];

const suffixes = ["camps", "summercamps", "daycamps", "kidscamps"];
const tlds = [".com"];

async function checkDomainWhois(domain: string): Promise<{available: boolean; status: string}> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    const { stdout } = await execAsync(`whois ${domain}`, { timeout: 10000 });
    const output = stdout.toLowerCase();

    // Check for common "not found" patterns indicating availability
    if (
      output.includes("no match for") ||
      output.includes("not found") ||
      output.includes("no data found") ||
      output.includes("domain not found") ||
      output.includes("no entries found") ||
      output.includes("status: free")
    ) {
      return { available: true, status: "available" };
    }

    // Check for registered indicators
    if (
      output.includes("registrar:") ||
      output.includes("creation date:") ||
      output.includes("registered on:") ||
      output.includes("domain name:") && output.includes("registrar")
    ) {
      return { available: false, status: "registered" };
    }

    return { available: false, status: "registered" };
  } catch (e: any) {
    // whois command failing often means the domain doesn't exist (available)
    if (e.stderr?.toLowerCase().includes("no match") || e.stdout?.toLowerCase().includes("no match")) {
      return { available: true, status: "available" };
    }
    return { available: false, status: "error" };
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("# Available Domains for Summer Camp Markets\n");
  console.log("Checking domain availability...\n");

  const available: Array<{city: string; domain: string}> = [];

  for (const market of markets) {
    console.log(`\n## ${market.city}`);

    for (const code of market.codes) {
      for (const suffix of suffixes) {
        for (const tld of tlds) {
          const domain = code + suffix + tld;

          // Small delay between whois calls
          await sleep(100);

          const result = await checkDomainWhois(domain);

          if (result.available) {
            console.log(`  ✅ ${domain} - AVAILABLE`);
            available.push({ city: market.city, domain });
          } else {
            console.log(`  ❌ ${domain} - ${result.status}`);
          }
        }
      }
    }
  }

  // Summary
  console.log("\n\n# Summary\n");

  console.log("## Available Domains (register now!)\n");
  if (available.length === 0) {
    console.log("No standard domains available.");
  } else {
    for (const d of available) {
      console.log(`- ${d.domain} (${d.city})`);
    }
  }

}

main().catch(console.error);
