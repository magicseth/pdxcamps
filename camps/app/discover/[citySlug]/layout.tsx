import { Metadata } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

type Props = {
  params: Promise<{ citySlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug } = await params;

  // Try to get city name from database
  let cityName = citySlug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  try {
    const city = await fetchQuery(api.cities.queries.getCityBySlug, { slug: citySlug });
    if (city) {
      cityName = city.name;
    }
  } catch {
    // Use formatted slug as fallback
  }

  return {
    title: `Discover ${cityName} Camps`,
    description: `Browse summer camps in ${cityName} by date, age, price, and location. Filter by organization, check availability, and save your favorites.`,
    openGraph: {
      title: `Discover Summer Camps in ${cityName}`,
      description: `Find the perfect summer camp for your kids in ${cityName}. Browse by week, filter by age and price, and plan your entire summer.`,
    },
  };
}

export default function CityDiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
