import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'PDX Camps - Summer Camp Planner';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
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
          background: 'linear-gradient(135deg, #2563eb 0%, #0d9488 100%)',
          color: 'white',
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: 24,
          }}
        >
          Give your kids an amazing summer.
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 400,
            opacity: 0.9,
            lineHeight: 1.4,
            marginBottom: 60,
          }}
        >
          Find camps near you, coordinate with friends, plan your whole summer.
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            opacity: 0.75,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          pdxcamps.com — Free for Portland families
        </div>
      </div>
    ),
    { ...size },
  );
}
