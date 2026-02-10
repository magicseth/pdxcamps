/**
 * Shared OG image layout for consistent branded link previews.
 * This is a plain JSX function (not a React component) for use with next/og ImageResponse.
 */

const BRAND = {
  mountain: '#344658',
  mountainDark: '#232f3a',
  sun: '#e5a33b',
  sunLight: '#f0b960',
  sky: '#8ba4b4',
  snow: '#ffffff',
} as const;

// Inline tent+sun SVG icon as JSX for ImageResponse (no <img> allowed)
function TentIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Sun */}
      <circle cx="48" cy="16" r="8" fill={BRAND.sun} />
      {/* Sun rays */}
      <line x1="48" y1="4" x2="48" y2="0" stroke={BRAND.sun} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="48" y1="28" x2="48" y2="32" stroke={BRAND.sun} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="36" y1="16" x2="32" y2="16" stroke={BRAND.sun} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="60" y1="16" x2="64" y2="16" stroke={BRAND.sun} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="39.5" y1="7.5" x2="37" y2="5" stroke={BRAND.sun} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="56.5" y1="24.5" x2="59" y2="27" stroke={BRAND.sun} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="56.5" y1="7.5" x2="59" y2="5" stroke={BRAND.sun} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="39.5" y1="24.5" x2="37" y2="27" stroke={BRAND.sun} strokeWidth="2.5" strokeLinecap="round" />
      {/* Tent */}
      <path d="M6 56 L24 20 L42 56 Z" fill={BRAND.mountain} stroke={BRAND.sky} strokeWidth="2" />
      <path d="M18 56 L24 40 L30 56 Z" fill={BRAND.mountainDark} />
    </svg>
  );
}

interface OgLayoutProps {
  title: string;
  subtitle?: string;
  badge?: string;
  domain?: string;
}

export function OgLayout({ title, subtitle, badge, domain = 'pdxcamps.com' }: OgLayoutProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: `linear-gradient(180deg, ${BRAND.mountainDark} 0%, ${BRAND.mountain} 100%)`,
        color: BRAND.snow,
        position: 'relative',
      }}
    >
      {/* Golden sun accent bar */}
      <div
        style={{
          width: '100%',
          height: 6,
          background: `linear-gradient(90deg, ${BRAND.sun} 0%, ${BRAND.sunLight} 50%, ${BRAND.sun} 100%)`,
          display: 'flex',
        }}
      />

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '50px 80px 40px',
        }}
      >
        {/* Badge */}
        {badge && (
          <div
            style={{
              display: 'flex',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                backgroundColor: BRAND.sunLight,
                color: BRAND.mountainDark,
                padding: '6px 16px',
                borderRadius: 6,
                display: 'flex',
              }}
            >
              {badge}
            </div>
          </div>
        )}

        {/* Title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: subtitle ? 20 : 0,
            maxWidth: '90%',
            display: 'flex',
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              fontSize: 26,
              fontWeight: 400,
              color: BRAND.sky,
              lineHeight: 1.4,
              maxWidth: '85%',
              display: 'flex',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 80px 36px',
          gap: 14,
        }}
      >
        <TentIcon size={32} />
        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: BRAND.sky,
            display: 'flex',
          }}
        >
          {domain}
        </div>
      </div>
    </div>
  );
}
