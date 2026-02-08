import type { Metadata } from 'next';
import { PartnerLandingPage } from '../../components/landing/PartnerLandingPage';

export const metadata: Metadata = {
  title: 'Partner with Us | PDX Camps',
  description:
    'Earn money for your PTA or school by helping families plan summer camp. Join our revenue-share partnership program and earn 20% of every premium signup from your community.',
  openGraph: {
    title: 'Partner with PDX Camps — Earn for Your PTA',
    description:
      'Help families in your community plan summer camp and earn 20% of every premium signup. No cap, no catch.',
    type: 'website',
  },
};

export default function PartnersPage() {
  return <PartnerLandingPage />;
}
