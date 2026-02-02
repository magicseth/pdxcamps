import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Friends',
  description: 'Connect with other families and share camp plans',
};

export default function FriendsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
