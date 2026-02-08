import { ImageResponse } from 'next/og';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

export const runtime = 'edge';
export const alt = 'Discover Summer Camps - PDX Camps';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;

  // Try to get city name from database, fall back to formatted slug
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
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: 24,
          }}
        >
          Discover Summer Camps in {cityName}
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 400,
            opacity: 0.9,
            lineHeight: 1.5,
            marginBottom: 8,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span>100+ camps from trusted organizations</span>
          <span>Browse by week, age, price &amp; location</span>
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            opacity: 0.7,
            marginTop: 40,
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
