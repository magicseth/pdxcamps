import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Additional Portland camp providers from PDX Parent, Kids Out and About, and Portland Summer Camps guides
 */
export const seedAdditionalSources = mutation({
  args: {
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    // Get existing sources to avoid duplicates
    const existingSources = await ctx.db.query("scrapeSources").collect();
    const existingUrls = new Set(existingSources.map((s) => s.url.toLowerCase()));
    const existingNames = new Set(existingSources.map((s) => s.name.toLowerCase()));

    // Additional Portland camp providers
    const additionalProviders = [
      // STEM & Tech
      {
        name: "iD Tech Camps",
        url: "https://www.idtech.com/locations/oregon-summer-camps",
        category: "STEM",
      },
      {
        name: "Coding with Kids",
        url: "https://codingwithkids.com/locations/portland/",
        category: "STEM",
      },
      {
        name: "EG Robotics",
        url: "https://www.egrobotics.com/",
        category: "STEM",
      },
      {
        name: "Camp Invention",
        url: "https://www.invent.org/programs/camp-invention",
        category: "STEM",
      },
      {
        name: "Brainbox Science",
        url: "https://www.brainboxscience.com/classes",
        category: "STEM",
      },
      {
        name: "Saturday Academy",
        url: "https://www.saturdayacademy.org/",
        category: "STEM",
      },
      {
        name: "Tinker Camp",
        url: "https://www.tinkercamp.org/",
        category: "STEM",
      },
      {
        name: "Math Gamers",
        url: "https://www.mathgamers.net/",
        category: "STEM",
      },

      // Arts - Theater & Performing Arts
      {
        name: "Northwest Children's Theater",
        url: "https://nwcts.org/summer-camp-25/",
        category: "Arts",
      },
      {
        name: "Spotlight Musical Theatre Academy",
        url: "https://www.spotlightmusicaltheatre.com/camps.html",
        category: "Arts",
      },
      {
        name: "Pivot PDX",
        url: "https://www.thisispivotpdx.com/youth",
        category: "Arts",
      },
      {
        name: "Lovegood Performing Arts",
        url: "https://www.lovegood.company/",
        category: "Arts",
      },
      {
        name: "The Aspire Project",
        url: "https://www.theaspireproject.org/",
        category: "Arts",
      },

      // Arts - Visual & Music
      {
        name: "One River School Lake Oswego",
        url: "https://lakeoswego.oneriverschool.com/camps/",
        category: "Arts",
      },
      {
        name: "Vibe of Portland",
        url: "https://www.vibepdx.org/",
        category: "Arts",
      },
      {
        name: "Willowbrook Arts Camp",
        url: "https://www.willowbrookartscamp.org/",
        category: "Arts",
      },
      {
        name: "My Voice Music",
        url: "https://www.myvoicemusic.org/",
        category: "Arts",
      },
      {
        name: "FairyCamp",
        url: "https://www.fairycamp.org/",
        category: "Arts",
      },
      {
        name: "Tucker-Maxon School",
        url: "https://www.tuckermaxon.org/",
        category: "Arts",
      },
      {
        name: "Camp Scrap (SCRAP PDX)",
        url: "https://www.scrappdx.org/",
        category: "Arts",
      },
      {
        name: "NewSpace Center for Photography",
        url: "https://www.newspacephoto.org/",
        category: "Arts",
      },
      {
        name: "Little Loft Studios",
        url: "https://www.littleloftstudios.com/",
        category: "Arts",
      },

      // Sports
      {
        name: "Portland Timbers FC Camps",
        url: "https://www.timbers.com/camps",
        category: "Sports",
      },
      {
        name: "The People's Courts Pickleball",
        url: "https://thepeoplescourts.com/",
        category: "Sports",
      },
      {
        name: "Commonwealth Skateboarding",
        url: "https://www.commonwealthskateboarding.com/",
        category: "Sports",
      },
      {
        name: "Oregon Gymnastics Academy",
        url: "https://www.ogagym.org/",
        category: "Sports",
      },
      {
        name: "Sky High Sports",
        url: "https://www.skyhighsports.com/",
        category: "Sports",
      },
      {
        name: "Rose City Hockey Club",
        url: "https://www.rosecityhockeyclub.com/",
        category: "Sports",
      },
      {
        name: "Girls Rock Yoga",
        url: "https://www.girlsrockyoga.com/",
        category: "Sports",
      },
      {
        name: "The Circuit Bouldering Gym",
        url: "https://www.thecircuitgym.com/",
        category: "Sports",
      },
      {
        name: "Anthony Newman Sports Camps",
        url: "https://www.anthonynewmancamps.com/",
        category: "Sports",
      },
      {
        name: "River Ranch Horse Camp",
        url: "https://www.riverranchhorse.com/",
        category: "Sports",
      },
      {
        name: "Aim High Martial Arts",
        url: "https://www.aimhighma.org/",
        category: "Sports",
      },
      {
        name: "Pedalheads Bike Camps",
        url: "https://pedalheads.com/",
        category: "Sports",
      },
      {
        name: "Parkour Visions",
        url: "https://parkourvisions.org/",
        category: "Sports",
      },

      // Nature & Outdoor
      {
        name: "Northwest Outward Bound",
        url: "https://www.nwobs.org/",
        category: "Nature",
      },
      {
        name: "Growing Gardens",
        url: "https://www.growing-gardens.org/",
        category: "Nature",
      },
      {
        name: "Schoolyard Farms",
        url: "https://www.schoolyardfarms.org/",
        category: "Nature",
      },
      {
        name: "Triskelee Farm",
        url: "https://triskeleefarm.com/school-%26-camps",
        category: "Nature",
      },
      {
        name: "Mazamas Adventure Wild",
        url: "https://mazamas.org/",
        category: "Nature",
      },
      {
        name: "Portland Audubon SWIFTS",
        url: "https://audubonportland.org/go-outside/camps/",
        category: "Nature",
      },

      // General Day Camps
      {
        name: "Steve & Kate's Camp",
        url: "https://steveandkatescamp.com/portland/",
        category: "General",
      },
      {
        name: "Champions Great Outdoors",
        url: "https://www.discoverchampions.com/",
        category: "General",
      },
      {
        name: "Catlin Gabel Summer",
        url: "https://www.catlin.edu/summer",
        category: "General",
      },
      {
        name: "St. Mary's Summer Program",
        url: "https://www.stmaryspdx.org/",
        category: "General",
      },

      // Residential / Overnight
      {
        name: "Camp Collins (YMCA)",
        url: "https://www.ymcacw.org/camps/camp-collins",
        category: "Residential",
      },
      {
        name: "YEA! Camp",
        url: "https://www.yeacamp.org/",
        category: "Residential",
      },
      {
        name: "Upward Bound Camp",
        url: "https://www.upwardboundcamp.org/",
        category: "Residential",
      },

      // Academic & Language
      {
        name: "Evergreen Aviation & Space Museum",
        url: "https://www.evergreenmuseum.org/",
        category: "STEM",
      },
      {
        name: "JA BizTown",
        url: "https://jaorswwa.org/",
        category: "Academic",
      },
      {
        name: "L'etoile French Immersion",
        url: "https://www.letoilefrenchschool.com/",
        category: "Academic",
      },
      {
        name: "Kids Like Languages",
        url: "https://www.kidslikelanguages.com/",
        category: "Academic",
      },

      // Museums & Specialty
      {
        name: "Oregon JCC Day Camp",
        url: "https://www.oregonjcc.org/",
        category: "General",
      },
      {
        name: "Backbeat Music Academy",
        url: "https://www.backbeatmusic.com/",
        category: "Arts",
      },
      {
        name: "School of Rock Portland",
        url: "https://www.schoolofrock.com/locations/portland",
        category: "Arts",
      },
    ];

    let created = 0;
    let skipped = 0;
    const skippedNames: string[] = [];

    for (const provider of additionalProviders) {
      // Check for duplicate URL or name
      const urlLower = provider.url.toLowerCase();
      const nameLower = provider.name.toLowerCase();

      if (existingUrls.has(urlLower) || existingNames.has(nameLower)) {
        skipped++;
        skippedNames.push(provider.name);
        continue;
      }

      // Mark as existing to avoid duplicates within this batch
      existingUrls.add(urlLower);
      existingNames.add(nameLower);

      const scraperConfig = {
        version: 1,
        generatedAt: Date.now(),
        generatedBy: "manual" as const,
        entryPoints: [
          {
            url: provider.url,
            type: "session_list" as const,
          },
        ],
        pagination: {
          type: "none" as const,
          selector: undefined,
        },
        sessionExtraction: {
          containerSelector: ".camp, .session, .program, article, .event",
          fields: {
            name: { selector: "h2, h3, .title, .name" },
            dates: { selector: ".dates, .schedule, .time, .date", format: "auto" },
            price: { selector: ".price, .cost, .fee" },
            ageRange: { selector: ".ages, .grades, .age", pattern: "(\\d+)-(\\d+)" },
            status: {
              selector: ".status, .availability",
              soldOutIndicators: ["sold out", "full", "waitlist", "closed"],
            },
            registrationUrl: { selector: "a.register, a.signup, a.enroll" },
          },
        },
        requiresJavaScript: true, // Most modern sites need JS
        waitForSelector: undefined,
      };

      const scraperHealth = {
        lastSuccessAt: undefined,
        lastFailureAt: undefined,
        consecutiveFailures: 0,
        totalRuns: 0,
        successRate: 0,
        lastError: undefined,
        needsRegeneration: true,
      };

      await ctx.db.insert("scrapeSources", {
        organizationId: undefined,
        name: provider.name,
        url: provider.url,
        scraperConfig,
        scraperHealth,
        scrapeFrequencyHours: 24,
        lastScrapedAt: undefined,
        nextScheduledScrape: undefined,
        isActive: false,
      });
      created++;
    }

    return {
      message: `Added ${created} new camp sources`,
      created,
      skipped,
      skippedNames,
      total: existingSources.length + created,
    };
  },
});
