/**
 * JSON-LD structured data helpers for SEO.
 * These generate Schema.org compliant JSON-LD objects.
 */

export interface EventJsonLdInput {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  locationName: string;
  locationCity?: string;
  locationState?: string;
  organizerName: string;
  price: number; // in cents
  currency: string;
  isAvailable: boolean;
  url: string;
  imageUrl?: string;
}

export function buildEventJsonLd(event: EventJsonLdInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: event.locationName,
      address: {
        '@type': 'PostalAddress',
        addressLocality: event.locationCity,
        addressRegion: event.locationState,
      },
    },
    organizer: {
      '@type': 'Organization',
      name: event.organizerName,
    },
    offers: {
      '@type': 'Offer',
      price: (event.price / 100).toFixed(2),
      priceCurrency: event.currency,
      availability: event.isAvailable
        ? 'https://schema.org/InStock'
        : 'https://schema.org/SoldOut',
      url: event.url,
    },
    ...(event.imageUrl ? { image: event.imageUrl } : {}),
  };
}

export interface OrganizationJsonLdInput {
  name: string;
  url?: string;
  logoUrl?: string;
  description?: string;
  slug: string;
}

export function buildOrganizationJsonLd(org: OrganizationJsonLdInput, baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    url: org.url ?? `${baseUrl}/organization/${org.slug}`,
    ...(org.logoUrl ? { logo: org.logoUrl } : {}),
    ...(org.description ? { description: org.description } : {}),
  };
}

export function buildWebApplicationJsonLd(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'PDX Camps',
    url: baseUrl,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
    description:
      'Free summer camp planner for families. Browse camps, track coverage week-by-week, and fill gaps in your summer schedule.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };
}

export interface BlogPostingJsonLdInput {
  headline: string;
  description: string;
  datePublished: string; // ISO date
  dateModified?: string;
  authorName: string;
  imageUrl?: string;
  url: string;
  articleBody?: string;
}

export function buildBlogPostingJsonLd(post: BlogPostingJsonLdInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.headline,
    description: post.description,
    datePublished: post.datePublished,
    ...(post.dateModified ? { dateModified: post.dateModified } : {}),
    author: {
      '@type': 'Organization',
      name: post.authorName,
    },
    ...(post.imageUrl ? { image: post.imageUrl } : {}),
    url: post.url,
    ...(post.articleBody ? { articleBody: post.articleBody } : {}),
  };
}

export function buildItemListJsonLd(
  name: string,
  url: string,
  items: Array<{ name: string; url: string; position: number }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url,
    numberOfItems: items.length,
    itemListElement: items.map((item) => ({
      '@type': 'ListItem',
      position: item.position,
      name: item.name,
      url: item.url,
    })),
  };
}
