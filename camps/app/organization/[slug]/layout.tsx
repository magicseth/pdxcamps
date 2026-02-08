import { Metadata } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  let orgName = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  try {
    const org = await fetchQuery(api.organizations.queries.getOrganizationBySlug, { slug });
    if (org) {
      orgName = org.name;
    }
  } catch {
    // Use formatted slug as fallback
  }

  return {
    title: orgName,
    description: `Browse summer camp programs from ${orgName}. See available sessions, dates, pricing, and age ranges.`,
    openGraph: {
      title: `${orgName} Summer Camps`,
      description: `Find and compare summer camp sessions from ${orgName}. View schedules, pricing, availability, and more.`,
    },
  };
}

export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
