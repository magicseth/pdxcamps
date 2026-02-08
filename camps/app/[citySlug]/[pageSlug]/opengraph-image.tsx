import { ImageResponse } from 'next/og';
import { getSeoPageBySlug, interpolate } from '@/lib/seoPages';

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
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 80px',
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          color: 'white',
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: 24,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 400,
            opacity: 0.9,
            lineHeight: 1.4,
            marginBottom: 60,
            maxWidth: '80%',
          }}
        >
          {description}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            opacity: 0.7,
            display: 'flex',
          }}
        >
          pdxcamps.com
        </div>
      </div>
    ),
    { ...size },
  );
}
