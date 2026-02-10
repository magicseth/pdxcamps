import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { getMarketFromHostname } from '@/lib/markets';
import { OgLayout } from '../../_og/OgLayout';

export const runtime = 'edge';
export const alt = 'Shared Summer Plan';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const headersList = await headers();
  const hostname = headersList.get('host') || 'localhost';
  const market = getMarketFromHostname(hostname);
  const domain = market.domains[0];

  let plan: Awaited<ReturnType<typeof fetchQuery<typeof api.share.queries.getSharedPlan>>> | null = null;
  try {
    plan = await fetchQuery(api.share.queries.getSharedPlan, { shareToken: token });
  } catch {
    // Fall through to fallback
  }

  if (!plan) {
    return new ImageResponse(
      (
        <OgLayout
          title="Summer Camp Plan"
          subtitle="See how this family is planning their summer"
          domain={domain}
        />
      ),
      { ...size },
    );
  }

  const { childName, familyName, year, weeks, stats } = plan;

  // Brand colors
  const mountain = '#344658';
  const mountainDark = '#232f3a';
  const sun = '#e5a33b';
  const sunLight = '#f0b960';
  const sky = '#8ba4b4';
  const snow = '#ffffff';

  // Build a row of colored blocks representing weeks
  const weekBlocks = weeks.map((w, i) => {
    let color = mountain; // dark for gap
    if (w.coveredDays >= 5) {
      color = '#4ade80'; // green for full
    } else if (w.coveredDays > 0) {
      color = sunLight; // golden for partial
    }
    return (
      <div
        key={i}
        style={{
          width: 60,
          height: 40,
          borderRadius: 6,
          backgroundColor: color,
          margin: '0 4px',
          display: 'flex',
        }}
      />
    );
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: `linear-gradient(180deg, ${mountainDark} 0%, ${mountain} 100%)`,
          color: snow,
          position: 'relative',
        }}
      >
        {/* Golden accent bar */}
        <div
          style={{
            width: '100%',
            height: 6,
            background: `linear-gradient(90deg, ${sun} 0%, ${sunLight} 50%, ${sun} 100%)`,
            display: 'flex',
          }}
        />

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '40px 70px 36px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 52, fontWeight: 700, marginBottom: 8, display: 'flex' }}>
              {childName}&apos;s Summer {year}
            </div>
            <div style={{ fontSize: 26, color: sky, fontWeight: 400, display: 'flex' }}>
              Shared by the {familyName} family
            </div>
          </div>

          {/* Stats */}
          <div
            style={{
              fontSize: 28,
              fontWeight: 500,
              color: sunLight,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {stats.coveredWeeks} weeks planned &middot; {stats.gapWeeks} open weeks
          </div>

          {/* Week blocks */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {weekBlocks}
          </div>

          {/* Footer */}
          <div
            style={{
              fontSize: 20,
              color: sky,
              fontWeight: 400,
              display: 'flex',
            }}
          >
            Plan your summer too at {domain}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
