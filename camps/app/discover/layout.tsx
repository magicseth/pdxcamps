import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Discover Camps',
  description: 'Browse and find summer camps in your area',
};

export default function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
