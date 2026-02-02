import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Camp Session Details',
  description: 'View camp session details, schedules, and registration',
};

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
