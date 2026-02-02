import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Camps',
  description: 'View and manage your registered summer camps',
};

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
