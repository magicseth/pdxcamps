import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your family profile and preferences',
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
