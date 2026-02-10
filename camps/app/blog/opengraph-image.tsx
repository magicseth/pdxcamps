import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';
import { getMarketFromHostname } from '@/lib/markets';
import { OgLayout } from '../_og/OgLayout';

export const runtime = 'edge';
export const alt = 'Summer Camp Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const headersList = await headers();
  const hostname = headersList.get('host') || 'localhost';
  const market = getMarketFromHostname(hostname);
  const domain = market.domains[0];

  return new ImageResponse(
    (
      <OgLayout
        title="Summer Camp Blog"
        subtitle={`Tips, guides & camp picks for ${market.name} families`}
        badge="Blog"
        domain={domain}
      />
    ),
    { ...size },
  );
}
