import { Metadata } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { JsonLd } from '@/components/shared/JsonLd';

type Props = {
  params: Promise<{ citySlug: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug } = await params;

  // Try to get city name from database
  let cityName = citySlug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  try {
    const city = await fetchQuery(api.cities.queries.getCityBySlug, { slug: citySlug });
    if (city) {
      cityName = city.name;
    }
  } catch {
    // Use formatted slug as fallback
  }

  return {
    title: `Discover ${cityName} Camps`,
    description: `Browse summer camps in ${cityName} by date, age, price, and location. Filter by organization, check availability, and save your favorites.`,
    openGraph: {
      title: `Discover Summer Camps in ${cityName}`,
      description: `Find the perfect summer camp for your kids in ${cityName}. Browse by week, filter by age and price, and plan your entire summer.`,
    },
  };
}

export default async function CityDiscoverLayout({ params, children }: Props) {
  const { citySlug } = await params;
  const baseUrl = 'https://pdxcamps.com';

  let jsonLd: Record<string, unknown> | null = null;
  try {
    const city = await fetchQuery(api.cities.queries.getCityBySlug, { slug: citySlug });
    if (city) {
      const result = await fetchQuery(api.sessions.seoQueries.getSessionsForSeoPage, {
        cityId: city._id,
        limit: 30,
      });

      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `Summer Camps in ${city.name}`,
        description: `Browse and compare ${result.totalCount} summer camp sessions in ${city.name}`,
        url: `${baseUrl}/discover/${citySlug}`,
        numberOfItems: result.totalCount,
        itemListElement: result.sessions.slice(0, 30).map(
          (session: {
            _id: string;
            campName: string;
            startDate: string;
            endDate: string;
            price: number;
            currency: string;
            organizationName: string;
            locationName: string;
            locationCity?: string;
            locationState?: string;
            enrolledCount: number;
            capacity: number;
            externalRegistrationUrl?: string;
          }, index: number) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'Event',
              name: session.campName,
              startDate: session.startDate,
              endDate: session.endDate,
              location: {
                '@type': 'Place',
                name: session.locationName,
                address: {
                  '@type': 'PostalAddress',
                  addressLocality: session.locationCity ?? city.name,
                  addressRegion: session.locationState ?? city.state,
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
          }),
        ),
      };
    }
  } catch {
    // No structured data if query fails
  }

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      {children}
    </>
  );
}
