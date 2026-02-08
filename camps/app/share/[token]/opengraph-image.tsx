import { ImageResponse } from 'next/og';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

export const runtime = 'edge';
export const alt = 'Shared Summer Plan - PDX Camps';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function FallbackImage() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 80px',
        background: 'linear-gradient(135deg, #2563eb 0%, #0d9488 100%)',
        color: 'white',
      }}
    >
      <div style={{ fontSize: 52, fontWeight: 700, marginBottom: 20 }}>
        Summer Camp Plan
      </div>
      <div style={{ fontSize: 26, opacity: 0.85 }}>
        Shared via pdxcamps.com
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let plan: Awaited<ReturnType<typeof fetchQuery<typeof api.share.queries.getSharedPlan>>> | null = null;
  try {
    plan = await fetchQuery(api.share.queries.getSharedPlan, { shareToken: token });
  } catch {
    // Fall through to fallback
  }

  if (!plan) {
    return new ImageResponse(<FallbackImage />, { ...size });
  }

  const { childName, familyName, year, weeks, stats } = plan;

  // Build a row of colored blocks representing weeks
  const weekBlocks = weeks.map((w, i) => {
    let color = '#6b7280'; // gray for gap
    if (w.coveredDays >= 5) {
      color = '#22c55e'; // green for full
    } else if (w.coveredDays > 0) {
      color = '#f97316'; // orange for partial
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
          padding: '50px 70px',
          background: 'linear-gradient(180deg, #e0f2fe 0%, #ffffff 40%)',
          color: '#1e293b',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 52, fontWeight: 700, marginBottom: 8 }}>
            {childName}&apos;s Summer {year}
          </div>
          <div style={{ fontSize: 26, color: '#64748b', fontWeight: 400 }}>
            Shared by the {familyName} family
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 500,
            color: '#334155',
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
            color: '#94a3b8',
            fontWeight: 400,
            display: 'flex',
          }}
        >
          Plan your summer too at pdxcamps.com
        </div>
      </div>
    ),
    { ...size },
  );
}
