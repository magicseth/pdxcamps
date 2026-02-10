import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { getMarketFromHostname } from '@/lib/markets';
import { OgLayout } from '../../_og/OgLayout';

export const runtime = 'edge';
export const alt = 'Blog Post';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CATEGORY_LABELS: Record<string, string> = {
  guide: 'Guide',
  stem: 'STEM',
  budget: 'Budget',
  outdoor: 'Outdoor',
  arts: 'Arts & Creative',
  'age-guide': 'By Age',
  tips: 'Tips',
  'weekly-update': 'Weekly Update',
};

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const headersList = await headers();
  const hostname = headersList.get('host') || 'localhost';
  const market = getMarketFromHostname(hostname);
  const domain = market.domains[0];

  try {
    const post = await fetchQuery(api.blog.queries.getBySlug, { slug });
    if (post) {
      const badge = post.category ? CATEGORY_LABELS[post.category] || post.category : undefined;
      return new ImageResponse(
        (
          <OgLayout
            title={post.title}
            subtitle={post.excerpt}
            badge={badge}
            domain={domain}
          />
        ),
        { ...size },
      );
    }
  } catch {
    // Fall through to fallback
  }

  return new ImageResponse(
    (
      <OgLayout
        title="Summer Camp Blog"
        subtitle="Tips, guides & camp picks"
        badge="Blog"
        domain={domain}
      />
    ),
    { ...size },
  );
}
