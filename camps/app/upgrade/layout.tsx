import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Upgrade to Premium',
  description:
    'See every week, save unlimited camps, get deadline alerts, and export to your calendar. Plan your whole summer stress-free.',
};

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
