import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { getSeoPageBySlug, getAllSeoSlugs, interpolate, SeoPageConfig } from '@/lib/seoPages';
import { MARKETS } from '@/lib/markets';
import { JsonLd } from '@/components/shared/JsonLd';
import { SeoPageClient } from './SeoPageClient';

type Props = {
  params: Promise<{ citySlug: string; pageSlug: string }>;
};

const CURRENT_YEAR = new Date().getFullYear().toString();

export async function generateStaticParams() {
  const citySlugs = MARKETS.filter((m) => m.slug !== 'mix').map((m) => m.slug);
  const pageSlugs = getAllSeoSlugs();

  return citySlugs.flatMap((citySlug) =>
    pageSlugs.map((pageSlug) => ({ citySlug, pageSlug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug, pageSlug } = await params;
  const page = getSeoPageBySlug(pageSlug);
  if (!page) return {};

  let cityName = citySlug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  try {
    const city = await fetchQuery(api.cities.queries.getCityBySlug, { slug: citySlug });
    if (city) cityName = city.name;
  } catch {
    // Use formatted slug
  }

  const vars = { city: cityName, year: CURRENT_YEAR };
  const title = interpolate(page.title, vars);
  const description = interpolate(page.description, vars);

  const baseUrl = 'https://pdxcamps.com';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${citySlug}/${pageSlug}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/${citySlug}/${pageSlug}`,
    },
  };
}

async function fetchSeoSessions(cityId: string, page: SeoPageConfig) {
  const filter = page.filter;
  const args: Record<string, unknown> = { cityId, limit: 100 };

  switch (filter.type) {
    case 'category':
      args.category = filter.category;
      break;
    case 'age':
      args.minAge = filter.minAge;
      args.maxAge = filter.maxAge;
      break;
    case 'price':
      args.maxPriceCents = filter.maxPriceCents;
      break;
    case 'free':
      args.isFree = true;
      break;
    case 'time':
      args.timeOfDay = filter.timeOfDay;
      break;
    case 'startsWithinDays':
      args.startsWithinDays = filter.days;
      break;
    case 'extendedCare':
      args.extendedCare = true;
      break;
  }

  return await fetchQuery(api.sessions.seoQueries.getSessionsForSeoPage, args as any);
}

export default async function SeoLandingPage({ params }: Props) {
  const { citySlug, pageSlug } = await params;
  const page = getSeoPageBySlug(pageSlug);
  if (!page) notFound();

  let city: { _id: string; name: string } | null = null;
  try {
    city = await fetchQuery(api.cities.queries.getCityBySlug, { slug: citySlug }) as any;
  } catch {
    // City not found
  }

  if (!city) notFound();

  const cityName = city.name;
  const vars = { city: cityName, year: CURRENT_YEAR };
  const result = await fetchSeoSessions(city._id, page);

  const title = interpolate(page.title, vars);
  const intro = interpolate(page.intro, vars);

  // Build JSON-LD structured data
  const baseUrl = 'https://pdxcamps.com';
  const pageUrl = `${baseUrl}/${citySlug}/${pageSlug}`;

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    description: interpolate(page.description, vars),
    url: pageUrl,
    numberOfItems: result.totalCount,
    itemListElement: result.sessions.slice(0, 50).map((session, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Event',
        name: session.campName,
        description: session.campDescription,
        startDate: session.startDate,
        endDate: session.endDate,
        location: {
          '@type': 'Place',
          name: session.locationName,
          address: {
            '@type': 'PostalAddress',
            addressLocality: session.locationCity ?? cityName,
            addressRegion: session.locationState ?? '',
          },
        },
        organizer: {
          '@type': 'Organization',
          name: session.organizationName,
        },
        offers: {
          '@type': 'Offer',
          price: (session.price / 100).toFixed(2),
          priceCurrency: session.currency,
          availability:
            session.enrolledCount < session.capacity
              ? 'https://schema.org/InStock'
              : 'https://schema.org/SoldOut',
          url: session.externalRegistrationUrl ?? `${baseUrl}/session/${session._id}`,
        },
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
      },
    })),
  };

  // Collect related pages for internal linking
  const allSlugs = getAllSeoSlugs();
  const relatedPages = allSlugs
    .filter((s) => s !== pageSlug)
    .slice(0, 8)
    .map((slug) => {
      const p = getSeoPageBySlug(slug)!;
      return {
        slug,
        title: interpolate(p.title, vars).replace(` | Summer ${CURRENT_YEAR}`, ''),
        href: `/${citySlug}/${slug}`,
      };
    });

  return (
    <>
      <JsonLd data={itemListJsonLd} />
      <SeoPageClient
        citySlug={citySlug}
        cityName={cityName}
        pageSlug={pageSlug}
        title={title}
        intro={intro}
        sessions={result.sessions}
        totalCount={result.totalCount}
        stats={result.stats}
        relatedPages={relatedPages}
        discoverHref={`/discover/${citySlug}`}
        filterLabel={getFilterLabel(page)}
      />
    </>
  );
}

function getFilterLabel(page: SeoPageConfig): string {
  switch (page.filter.type) {
    case 'category':
      return page.filter.category;
    case 'age':
      return page.filter.label;
    case 'price':
      return page.filter.label;
    case 'time':
      return page.filter.label;
    case 'free':
      return 'Free';
    case 'startsWithinDays':
      return page.filter.label;
    case 'extendedCare':
      return page.filter.label;
  }
}
