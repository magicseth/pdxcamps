import { cookies } from 'next/headers';
import FamilySetupClient from './FamilySetupClient';

export default async function FamilySetupPage() {
  // Read the referral code from the cookie on the server
  const cookieStore = await cookies();
  const referralCode = cookieStore.get('referral_code')?.value || null;
  const inviteToken = cookieStore.get('invite_token')?.value || null;
  const partnerCode = cookieStore.get('partner_code')?.value || null;
  const shareToken = cookieStore.get('share_token')?.value || null;
  const shareType = cookieStore.get('share_type')?.value || null;

  return (
    <FamilySetupClient
      referralCode={referralCode}
      inviteToken={inviteToken}
      partnerCode={partnerCode}
      shareToken={shareToken}
      shareType={shareType as 'child' | 'family' | null}
    />
  );
}
