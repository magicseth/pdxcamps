import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { MARKETS } from '@/lib/markets';
import { JsonLd } from '@/components/shared/JsonLd';
import { SeoPageClient } from '../../[pageSlug]/SeoPageClient';

type Props = {
  params: Promise<{ citySlug: string; neighborhoodSlug: string }>;
};

const CURRENT_YEAR = new Date().getFullYear().toString();

export async function generateStaticParams() {
  const params: Array<{ citySlug: string; neighborhoodSlug: string }> = [];

  for (const market of MARKETS.filter((m) => m.slug !== 'mix')) {
    try {
      const city = await fetchQuery(api.cities.queries.getCityBySlug, { slug: market.slug });
      if (!city) continue;
      const neighborhoods = await fetchQuery(api.cities.queries.listNeighborhoods, { cityId: city._id as any });
      for (const n of neighborhoods) {
        params.push({ citySlug: market.slug, neighborhoodSlug: (n as any).slug });
      }
    } catch {
      // skip city
    }
  }

  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug, neighborhoodSlug } = await params;

  let cityName = citySlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const neighborhoodName = neighborhoodSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  try {
    const city = await fetchQuery(api.cities.queries.getCityBySlug, { slug: citySlug });
    if (city) cityName = city.name;
  } catch { /* use formatted */ }

  const title = `Summer Camps in ${neighborhoodName}, ${cityName} | ${CURRENT_YEAR}`;
  const description = `Find summer camps in the ${neighborhoodName} area of ${cityName}. Browse local programs, prices, dates, and ages for ${CURRENT_YEAR}.`;

  return {
    title,
    description,
    openGraph: { title, description },
    alternates: { canonical: `https://pdxcamps.com/${citySlug}/neighborhoods/${neighborhoodSlug}` },
  };
}

export default async function NeighborhoodPage({ params }: Props) {
  const { citySlug, neighborhoodSlug } = await params;

  let city: { _id: string; name: string } | null = null;
  try {
    city = await fetchQuery(api.cities.queries.getCityBySlug, { slug: citySlug }) as any;
  } catch { /* not found */ }
  if (!city) notFound();

  // Find the neighborhood
  const neighborhoods = await fetchQuery(api.cities.queries.listNeighborhoods, { cityId: city._id as any });
  const neighborhood = (neighborhoods as any[]).find((n) => n.slug === neighborhoodSlug);
  if (!neighborhood) notFound();

  // Fetch sessions for this neighborhood
  const result = await fetchQuery(api.sessions.seoQueries.getSessionsForNeighborhood, {
    cityId: city._id as any,
    neighborhoodId: neighborhood._id,
    limit: 100,
  });

  const title = `Summer Camps in ${neighborhood.name}, ${city.name} | ${CURRENT_YEAR}`;
  const intro = `Looking for camps near ${neighborhood.name}? Here are all the summer camp programs we've found at locations in the ${neighborhood.name} area of ${city.name}. Prices, dates, and ages are listed so you can compare options close to home.`;

  // JSON-LD
  const pageUrl = `https://pdxcamps.com/${citySlug}/neighborhoods/${neighborhoodSlug}`;
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    url: pageUrl,
    numberOfItems: result.totalCount,
    itemListElement: result.sessions.slice(0, 50).map((session: any, index: number) => ({
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
            addressLocality: session.locationCity ?? city!.name,
          },
        },
        organizer: { '@type': 'Organization', name: session.organizationName },
        offers: {
          '@type': 'Offer',
          price: (session.price / 100).toFixed(2),
          priceCurrency: session.currency,
          availability: session.enrolledCount < session.capacity ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
        },
      },
    })),
  };

  // Related neighborhood pages
  const relatedPages = (neighborhoods as any[])
    .filter((n) => n.slug !== neighborhoodSlug)
    .slice(0, 8)
    .map((n) => ({
      slug: n.slug,
      title: `Camps in ${n.name}`,
      href: `/${citySlug}/neighborhoods/${n.slug}`,
    }));

  return (
    <>
      <JsonLd data={itemListJsonLd} />
      <SeoPageClient
        citySlug={citySlug}
        cityName={city.name}
        pageSlug={`neighborhoods/${neighborhoodSlug}`}
        title={title}
        intro={intro}
        sessions={result.sessions as any}
        totalCount={result.totalCount}
        stats={result.stats}
        relatedPages={relatedPages}
        discoverHref={`/discover/${citySlug}`}
        filterLabel={neighborhood.name}
      />
    </>
  );
}
