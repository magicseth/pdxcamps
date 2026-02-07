import { cookies } from 'next/headers';
import FamilySetupClient from './FamilySetupClient';

export default async function FamilySetupPage() {
  // Read the referral code from the cookie on the server
  const cookieStore = await cookies();
  const referralCode = cookieStore.get('referral_code')?.value || null;

  return <FamilySetupClient referralCode={referralCode} />;
}
