/**
 * SEO landing page definitions.
 * Maps page slugs to filter configurations and content.
 */

import { CATEGORIES } from './constants';

export interface SeoPageConfig {
  slug: string;
  /** Title template - {city} will be replaced */
  title: string;
  /** Meta description template */
  description: string;
  /** Intro paragraph template shown on page - should sound like a helpful local parent */
  intro: string;
  /** Filter to apply when querying sessions */
  filter:
    | { type: 'category'; category: string }
    | { type: 'age'; minAge: number; maxAge: number; label: string }
    | { type: 'price'; maxPriceCents: number; label: string }
    | { type: 'time'; timeOfDay: 'morning' | 'afternoon' | 'fullday'; label: string }
    | { type: 'free' }
    | { type: 'startsWithinDays'; days: number; label: string }
    | { type: 'extendedCare'; label: string };
}

// ---- Category pages ----

const categoryPages: SeoPageConfig[] = [
  {
    slug: 'stem-camps',
    title: 'STEM Camps in {city} | Summer {year}',
    description:
      'Find STEM summer camps in {city} for {year}. Robotics, coding, science, and engineering programs for kids of all ages.',
    intro:
      "If your kid lights up around robots, experiments, or anything with a screen and a keyboard, you're in the right place. We've rounded up every STEM camp we could find in {city} this summer -- from beginner coding classes to advanced robotics workshops. Prices, dates, and ages are all listed so you can compare without opening 50 browser tabs.",
    filter: { type: 'category', category: 'STEM' },
  },
  {
    slug: 'art-camps',
    title: 'Art Camps in {city} | Summer {year}',
    description:
      'Browse art summer camps in {city} for {year}. Painting, drawing, ceramics, mixed media, and creative arts programs for kids.',
    intro:
      "Looking for a camp where your kid can get messy and make something they're proud of? Here are the art camps running in {city} this summer. You'll find everything from painting and drawing to ceramics and mixed media. Most of these programs welcome beginners, so don't worry if your kiddo has never picked up a paintbrush outside of school.",
    filter: { type: 'category', category: 'Arts' },
  },
  {
    slug: 'sports-camps',
    title: 'Sports Camps in {city} | Summer {year}',
    description:
      'Find sports summer camps in {city} for {year}. Soccer, basketball, multi-sport, swimming, and athletic programs for kids.',
    intro:
      "Need to burn off some energy this summer? These are the sports camps in {city} that'll keep your kids active and having fun. Whether they're into a specific sport or just need to run around for a week, you'll find options here ranging from competitive skills clinics to laid-back multi-sport programs.",
    filter: { type: 'category', category: 'Sports' },
  },
  {
    slug: 'outdoor-camps',
    title: 'Outdoor & Nature Camps in {city} | Summer {year}',
    description:
      'Explore outdoor and nature summer camps in {city} for {year}. Hiking, nature exploration, gardening, and wilderness programs.',
    intro:
      "Want to get your kids off screens and into the woods? These outdoor and nature camps in {city} are exactly what you're looking for. From nature hikes and creek exploration to gardening and wildlife observation, these programs let kids get muddy, explore, and actually enjoy being outside.",
    filter: { type: 'category', category: 'Nature' },
  },
  {
    slug: 'music-camps',
    title: 'Music Camps in {city} | Summer {year}',
    description:
      'Discover music summer camps in {city} for {year}. Instrument lessons, band camps, songwriting, and music production programs.',
    intro:
      "Whether your child is already playing an instrument or just loves to sing in the car, these music camps in {city} have something for every level. You'll find everything from rock band camps to classical music intensives, plus songwriting and music production for the tech-savvy musician.",
    filter: { type: 'category', category: 'Music' },
  },
  {
    slug: 'drama-camps',
    title: 'Drama & Theater Camps in {city} | Summer {year}',
    description:
      'Find drama and theater summer camps in {city} for {year}. Acting, improv, musical theater, and performance programs for kids.',
    intro:
      "Got a little performer at home? These drama and theater camps in {city} will give them a stage (literally). From improv and acting classes to full musical theater productions, these programs build confidence and creativity. Most end with a performance for families, which is always a highlight.",
    filter: { type: 'category', category: 'Drama' },
  },
  {
    slug: 'adventure-camps',
    title: 'Adventure Camps in {city} | Summer {year}',
    description:
      'Browse adventure summer camps in {city} for {year}. Rock climbing, kayaking, survival skills, and outdoor adventure programs.',
    intro:
      "Ready for something a little more exciting than arts and crafts? These adventure camps in {city} push kids outside their comfort zones in the best way possible. Think rock climbing, kayaking, team challenges, and wilderness skills. Great for building confidence and making memories they'll actually talk about.",
    filter: { type: 'category', category: 'Adventure' },
  },
  {
    slug: 'cooking-camps',
    title: 'Cooking Camps in {city} | Summer {year}',
    description:
      'Find cooking and culinary summer camps in {city} for {year}. Baking, international cuisine, and kitchen skills programs for kids.',
    intro:
      "If your kid loves helping in the kitchen (or eating the results), a cooking camp might be the perfect summer pick. These programs in {city} teach real kitchen skills -- from baking and international cuisine to nutrition and food science. Plus, they usually come home with recipes they can actually make.",
    filter: { type: 'category', category: 'Cooking' },
  },
  {
    slug: 'dance-camps',
    title: 'Dance Camps in {city} | Summer {year}',
    description:
      'Discover dance summer camps in {city} for {year}. Ballet, hip-hop, contemporary, and creative movement programs for kids.',
    intro:
      "From ballet to hip-hop to creative movement, these dance camps in {city} cover every style. Whether your child has been dancing for years or just discovered they love to move, you'll find programs that match their level. Most camps end with a mini showcase so families can see what they've learned.",
    filter: { type: 'category', category: 'Dance' },
  },
  {
    slug: 'academic-camps',
    title: 'Academic & Learning Camps in {city} | Summer {year}',
    description:
      'Find academic summer camps in {city} for {year}. Reading, math enrichment, writing workshops, and educational programs.',
    intro:
      "Want to keep the learning going without it feeling like summer school? These academic camps in {city} make subjects like reading, writing, and math genuinely engaging. They're designed to prevent summer slide while still feeling like camp -- think hands-on projects and small group activities, not worksheets.",
    filter: { type: 'category', category: 'Academic' },
  },
];

// ---- Age pages ----

const agePages: SeoPageConfig[] = [
  {
    slug: 'camps-for-preschoolers',
    title: 'Preschool Camps in {city} | Ages 3-5 | Summer {year}',
    description:
      'Find preschool-friendly summer camps in {city} for ages 3-5. Half-day programs, gentle introductions, and age-appropriate activities.',
    intro:
      "Finding a camp for a 3-5 year old can feel tricky -- you want them to have fun but also feel safe and comfortable. These preschool-friendly camps in {city} are designed specifically for little ones, with shorter days, smaller groups, and activities geared toward their developmental stage. Many are half-day programs, which is usually the sweet spot for this age.",
    filter: { type: 'age', minAge: 3, maxAge: 5, label: 'Preschool (Ages 3-5)' },
  },
  {
    slug: 'camps-for-5-year-olds',
    title: 'Camps for 5-Year-Olds in {city} | Summer {year}',
    description:
      'Summer camps in {city} for 5-year-olds. Age-appropriate programs with the right mix of structure and play.',
    intro:
      "Five is a great age for camp -- they're ready for more independence but still need programs designed with younger kids in mind. These camps in {city} accept 5-year-olds and offer the right balance of structured activities and free play. We've flagged which ones are half-day vs. full-day so you can pick what works for your family.",
    filter: { type: 'age', minAge: 5, maxAge: 5, label: 'Age 5' },
  },
  {
    slug: 'camps-for-elementary-schoolers',
    title: 'Elementary School Camps in {city} | Ages 6-10 | Summer {year}',
    description:
      'Browse summer camps in {city} for elementary-age kids (6-10). Wide variety of activities, themes, and schedule options.',
    intro:
      "Elementary age is peak camp season -- kids are old enough to handle a full day but young enough to be excited about almost everything. These camps in {city} are designed for the 6-10 age range, covering everything from sports and art to science and outdoor adventure. This is where you'll find the most options.",
    filter: { type: 'age', minAge: 6, maxAge: 10, label: 'Elementary (Ages 6-10)' },
  },
  {
    slug: 'camps-for-middle-schoolers',
    title: 'Middle School Camps in {city} | Ages 11-14 | Summer {year}',
    description:
      'Find summer camps for middle schoolers in {city}. Programs for ages 11-14 with more advanced activities and teen-appropriate programming.',
    intro:
      "Finding camps for middle schoolers can be surprisingly hard -- they've aged out of the little kid programs but aren't ready for teen internships. These camps in {city} are specifically designed for the 11-14 age group, with more advanced activities and the kind of social environment where tweens actually want to show up.",
    filter: { type: 'age', minAge: 11, maxAge: 14, label: 'Middle School (Ages 11-14)' },
  },
  {
    slug: 'camps-for-teens',
    title: 'Teen Camps in {city} | Ages 13-17 | Summer {year}',
    description:
      'Summer camps for teenagers in {city}. Leadership programs, skill-building, CIT opportunities, and advanced workshops for ages 13-17.',
    intro:
      "Teen camps are a whole different ballgame -- your kid wants something that feels cool, not babysitting. These programs in {city} for ages 13-17 include leadership training, advanced skill workshops, counselor-in-training opportunities, and specialty camps where teens can go deep on something they're passionate about.",
    filter: { type: 'age', minAge: 13, maxAge: 17, label: 'Teens (Ages 13-17)' },
  },
];

// ---- Price pages ----

const pricePages: SeoPageConfig[] = [
  {
    slug: 'free-summer-camps',
    title: 'Free Summer Camps in {city} | Summer {year}',
    description:
      'Free summer camps in {city} for {year}. No-cost programs from parks departments, nonprofits, and community organizations.',
    intro:
      "Summer camp doesn't have to break the bank. These free programs in {city} are offered by parks departments, nonprofits, libraries, and community organizations. They fill up fast, so bookmark this page and check back as registration dates approach. We update this list as new free programs are announced.",
    filter: { type: 'free' },
  },
  {
    slug: 'affordable-summer-camps',
    title: 'Affordable Summer Camps in {city} | Under $200 | Summer {year}',
    description:
      'Budget-friendly summer camps in {city} under $200 per week. Quality programs that won\'t break the bank.',
    intro:
      "Camp costs add up fast when you're filling an entire summer. These affordable programs in {city} are all under $200 per session, which makes it a lot easier to plan multiple weeks without wincing at the total. You'll find a good mix of activities -- these aren't just the leftovers after the expensive programs.",
    filter: { type: 'price', maxPriceCents: 20000, label: 'Under $200' },
  },
  {
    slug: 'cheap-summer-camps',
    title: 'Budget Summer Camps in {city} | Under $150 | Summer {year}',
    description:
      'Budget-friendly summer camps in {city} under $150. Affordable options from community organizations and local providers.',
    intro:
      "Looking for summer camp options that won't wreck your budget? These camps in {city} are all under $150 per session. Parks departments, community centers, and local nonprofits tend to offer the best deals, and many also have scholarship or sliding-scale options if you ask.",
    filter: { type: 'price', maxPriceCents: 15000, label: 'Under $150' },
  },
];

// ---- Time of day pages ----

const timePages: SeoPageConfig[] = [
  {
    slug: 'full-day-summer-camps',
    title: 'Full-Day Summer Camps in {city} | Summer {year}',
    description:
      'Full-day summer camps in {city} with coverage from morning to afternoon. Find camps that match a working parent schedule.',
    intro:
      "If you need camp to cover a full work day, these full-day programs in {city} run from morning through the afternoon. We've included drop-off and pick-up times for each one so you can see exactly how they fit your schedule. Many also offer extended care for an additional fee if you need earlier drop-off or later pick-up.",
    filter: { type: 'time', timeOfDay: 'fullday', label: 'Full Day' },
  },
  {
    slug: 'half-day-morning-camps',
    title: 'Half-Day Morning Camps in {city} | Summer {year}',
    description:
      'Morning half-day summer camps in {city}. Programs that wrap up by lunchtime -- perfect for younger kids or mixing activities.',
    intro:
      "Half-day morning camps are perfect for younger kids who aren't ready for a full day, or for families who want to mix and match activities. These programs in {city} typically run from 9am to noon or 1pm. They're also great for stacking -- do a morning camp and have the afternoon free for swimming, playdates, or just hanging out.",
    filter: { type: 'time', timeOfDay: 'morning', label: 'Half-Day Morning' },
  },
  {
    slug: 'half-day-afternoon-camps',
    title: 'Half-Day Afternoon Camps in {city} | Summer {year}',
    description:
      'Afternoon half-day summer camps in {city}. Programs starting after lunch for flexible summer scheduling.',
    intro:
      "Afternoon camps are less common but can be a lifesaver for scheduling. These programs in {city} start after lunch, usually around 1pm, and run until 4 or 5pm. They pair well with morning activities, or they're perfect for families with kids who just aren't morning people.",
    filter: { type: 'time', timeOfDay: 'afternoon', label: 'Half-Day Afternoon' },
  },
];

// ---- Urgency / timing pages ----

const urgencyPages: SeoPageConfig[] = [
  {
    slug: 'camps-this-week',
    title: 'Camps Starting This Week in {city} | Summer {year}',
    description:
      'Summer camps starting this week in {city}. Last-minute options still available for {year}.',
    intro:
      "Need something for this week? These camps in {city} start in the next 7 days and still have spots. It's not too late -- some of the best camp experiences happen when you jump in last minute. We update this page daily so you always see what's currently available.",
    filter: { type: 'startsWithinDays', days: 7, label: 'Starting This Week' },
  },
  {
    slug: 'last-minute-camps',
    title: 'Last-Minute Summer Camps in {city} | Summer {year}',
    description:
      'Last-minute summer camps with open spots in {city} for {year}. Find available camps starting in the next 2 weeks.',
    intro:
      "Plans fell through? Kid bored already? These camps in {city} start within the next two weeks and still have spots available. We check availability regularly so you can find real openings, not phantom listings. Sort by start date to see what's coming up soonest.",
    filter: { type: 'startsWithinDays', days: 14, label: 'Last Minute' },
  },
];

// ---- Special feature pages ----

const featurePages: SeoPageConfig[] = [
  {
    slug: 'camps-with-extended-care',
    title: 'Camps with Extended Care in {city} | Summer {year}',
    description:
      'Summer camps in {city} with before and after care options. Extended hours for working parents.',
    intro:
      "Need early drop-off or late pick-up? These camps in {city} offer extended care options beyond the normal camp hours. Perfect for working parents who need coverage from 7-8am through 5-6pm. Extended care is sometimes included in the price and sometimes an add-on, so check each listing for details.",
    filter: { type: 'extendedCare', label: 'Extended Care' },
  },
];

export const SEO_PAGES: SeoPageConfig[] = [
  ...categoryPages,
  ...agePages,
  ...pricePages,
  ...timePages,
  ...urgencyPages,
  ...featurePages,
];

/** Look up a page config by slug */
export function getSeoPageBySlug(slug: string): SeoPageConfig | undefined {
  return SEO_PAGES.find((p) => p.slug === slug);
}

/** Get all valid slugs (for generateStaticParams / sitemap) */
export function getAllSeoSlugs(): string[] {
  return SEO_PAGES.map((p) => p.slug);
}

/** Interpolate template strings */
export function interpolate(template: string, vars: { city: string; year: string }): string {
  return template.replace(/\{city\}/g, vars.city).replace(/\{year\}/g, vars.year);
}
