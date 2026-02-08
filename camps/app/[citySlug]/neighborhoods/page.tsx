import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { MARKETS } from '@/lib/markets';
import Link from 'next/link';

type Props = {
  params: Promise<{ citySlug: string }>;
};

const CURRENT_YEAR = new Date().getFullYear().toString();

export async function generateStaticParams() {
  return MARKETS.filter((m) => m.slug !== 'mix').map((m) => ({ citySlug: m.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug } = await params;
  let cityName = citySlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  try {
    const city = await fetchQuery(api.cities.queries.getCityBySlug, { slug: citySlug });
    if (city) cityName = city.name;
  } catch { /* use formatted slug */ }

  const title = `Summer Camps by Neighborhood in ${cityName} | ${CURRENT_YEAR}`;
  const description = `Find summer camps near you in ${cityName}. Browse camps by neighborhood to find programs close to home.`;

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function NeighborhoodsPage({ params }: Props) {
  const { citySlug } = await params;

  let city: { _id: string; name: string } | null = null;
  try {
    city = await fetchQuery(api.cities.queries.getCityBySlug, { slug: citySlug }) as any;
  } catch { /* not found */ }

  if (!city) notFound();

  const neighborhoods = await fetchQuery(api.cities.queries.listNeighborhoods, { cityId: city._id as any });

  if (!neighborhoods || neighborhoods.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">Neighborhoods in {city.name}</h1>
        <p className="text-gray-600">No neighborhoods have been configured for {city.name} yet.</p>
        <Link href={`/discover/${citySlug}`} className="text-blue-600 hover:underline mt-4 inline-block">
          Browse all camps in {city.name}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Summer Camps by Neighborhood in {city.name}</h1>
      <p className="text-gray-600 mb-8">
        Find camps close to home. Browse summer camp programs organized by {city.name} neighborhood.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {neighborhoods.map((n: any) => (
          <Link
            key={n._id}
            href={`/${citySlug}/neighborhoods/${n.slug}`}
            className="block rounded-lg border border-gray-200 p-4 hover:border-blue-400 hover:shadow-sm transition-colors"
          >
            <h2 className="font-semibold text-lg">{n.name}</h2>
            <p className="text-sm text-gray-500 mt-1">View camps in {n.name}</p>
          </Link>
        ))}
      </div>

      <div className="mt-12 border-t pt-8">
        <h2 className="text-lg font-semibold mb-3">More ways to find camps</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${citySlug}/stem-camps`} className="text-sm text-blue-600 hover:underline">STEM Camps</Link>
          <Link href={`/${citySlug}/art-camps`} className="text-sm text-blue-600 hover:underline">Art Camps</Link>
          <Link href={`/${citySlug}/sports-camps`} className="text-sm text-blue-600 hover:underline">Sports Camps</Link>
          <Link href={`/${citySlug}/free-summer-camps`} className="text-sm text-blue-600 hover:underline">Free Camps</Link>
          <Link href={`/${citySlug}/affordable-summer-camps`} className="text-sm text-blue-600 hover:underline">Affordable Camps</Link>
          <Link href={`/discover/${citySlug}`} className="text-sm text-blue-600 hover:underline">All Camps</Link>
        </div>
      </div>
    </main>
  );
}
