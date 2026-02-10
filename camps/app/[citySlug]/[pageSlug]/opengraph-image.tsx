import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';
import { getSeoPageBySlug, interpolate } from '@/lib/seoPages';
import { getMarketFromHostname } from '@/lib/markets';
import { OgLayout } from '../../_og/OgLayout';

export const runtime = 'edge';
export const alt = 'Summer Camps';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ citySlug: string; pageSlug: string }>;
}) {
  const { citySlug, pageSlug } = await params;

  const headersList = await headers();
  const hostname = headersList.get('host') || 'localhost';
  const market = getMarketFromHostname(hostname);
  const domain = market.domains[0];

  const page = getSeoPageBySlug(pageSlug);
  const cityName = citySlug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const year = new Date().getFullYear().toString();

  const title = page
    ? interpolate(page.title, { city: cityName, year }).replace(` | Summer ${year}`, '')
    : `Summer Camps in ${cityName}`;

  const description = page
    ? interpolate(page.description, { city: cityName, year })
    : `Find summer camps in ${cityName} for ${year}.`;

  return new ImageResponse(
    (
      <OgLayout
        title={title}
        subtitle={description}
        domain={domain}
      />
    ),
    { ...size },
  );
}
