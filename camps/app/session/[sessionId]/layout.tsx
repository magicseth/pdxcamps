import { Metadata } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { buildEventJsonLd } from '@/lib/structuredData';
import { JsonLd } from '@/components/shared/JsonLd';

type Props = {
  params: Promise<{ sessionId: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId } = await params;
  const baseUrl = 'https://pdxcamps.com';

  try {
    const session = await fetchQuery(api.sessions.queries.getSession, {
      sessionId: sessionId as Id<'sessions'>,
    });
    if (!session || !session.camp) return { title: 'Camp Session Details' };

    const campName = session.camp.name;
    const orgName = session.organization?.name ?? '';
    const startDate = new Date(session.startDate + 'T00:00:00');
    const dateStr = startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return {
      title: `${campName} - ${dateStr}`,
      description: `${campName} by ${orgName}. Starts ${dateStr}. View schedule, pricing, ages, location, and register.`,
      openGraph: {
        title: `${campName} | Summer Camp Session`,
        description: `${campName} by ${orgName}. Starting ${dateStr}. View details and register.`,
        url: `${baseUrl}/session/${sessionId}`,
      },
    };
  } catch {
    return { title: 'Camp Session Details' };
  }
}

export default async function SessionDetailLayout({ params, children }: Props) {
  const { sessionId } = await params;
  const baseUrl = 'https://pdxcamps.com';

  let jsonLd = null;
  try {
    const session = await fetchQuery(api.sessions.queries.getSession, {
      sessionId: sessionId as Id<'sessions'>,
    });

    if (session && session.camp) {
      jsonLd = buildEventJsonLd({
        name: session.camp.name,
        description: session.camp.description ?? undefined,
        startDate: session.startDate,
        endDate: session.endDate,
        locationName: session.location?.name ?? 'Camp Location',
        locationCity: session.location?.address?.city,
        locationState: session.location?.address?.state,
        organizerName: session.organization?.name ?? '',
        price: session.price,
        currency: session.currency,
        isAvailable: session.enrolledCount < session.capacity,
        url: session.externalRegistrationUrl ?? `${baseUrl}/session/${sessionId}`,
        imageUrl: session.camp.resolvedImageUrl ?? undefined,
      });
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
