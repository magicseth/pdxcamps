import { Metadata } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { buildOrganizationJsonLd } from '@/lib/structuredData';
import { JsonLd } from '@/components/shared/JsonLd';

type Props = {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
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

  const baseUrl = 'https://pdxcamps.com';

  return {
    title: orgName,
    description: `Browse summer camp programs from ${orgName}. See available sessions, dates, pricing, and age ranges.`,
    openGraph: {
      title: `${orgName} Summer Camps`,
      description: `Find and compare summer camp sessions from ${orgName}. View schedules, pricing, availability, and more.`,
      url: `${baseUrl}/organization/${slug}`,
    },
  };
}

export default async function OrganizationLayout({ params, children }: Props) {
  const { slug } = await params;
  const baseUrl = 'https://pdxcamps.com';

  let jsonLd = null;
  try {
    const org = await fetchQuery(api.organizations.queries.getOrganizationBySlug, { slug });
    if (org) {
      jsonLd = buildOrganizationJsonLd(
        {
          name: org.name,
          url: org.website ?? undefined,
          logoUrl: org.logoUrl ?? undefined,
          description: org.description ?? undefined,
          slug,
        },
        baseUrl,
      );
    }
  } catch {
    // No structured data if query fails
  }

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      {children}
    </>
  );
}
