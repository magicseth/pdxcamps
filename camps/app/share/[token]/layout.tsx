import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Summer Camp Plan',
  description:
    'Check out this family\'s summer camp plan! See which camps they picked week-by-week and start planning your own summer.',
  openGraph: {
    title: 'Summer Camp Plan',
    description:
      'Check out this family\'s summer camp plan! See which camps they picked week-by-week and start planning your own summer.',
  },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
