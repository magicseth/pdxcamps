import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Discover Camps',
  description:
    'Browse summer camps by date, age, price, and location. Filter by organization, see availability, and save your favorites.',
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
