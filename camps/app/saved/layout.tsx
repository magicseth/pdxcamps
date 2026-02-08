import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Saved Camps',
  description: 'Manage your saved camps, track registration status, and plan your summer.',
};

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
