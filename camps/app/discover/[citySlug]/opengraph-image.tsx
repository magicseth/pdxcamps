import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { getMarketFromHostname } from '@/lib/markets';
import { OgLayout } from '../../_og/OgLayout';

export const runtime = 'edge';
export const alt = 'Discover Summer Camps';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;

  const headersList = await headers();
  const hostname = headersList.get('host') || 'localhost';
  const market = getMarketFromHostname(hostname);
  const domain = market.domains[0];

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

  return new ImageResponse(
    (
      <OgLayout
        title={`Discover Summer Camps in ${cityName}`}
        subtitle="Browse by week, age, price & location"
        badge="100+ camps"
        domain={domain}
      />
    ),
    { ...size },
  );
}
