import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Started',
  description: 'Set up your family profile to start planning summer camps',
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
