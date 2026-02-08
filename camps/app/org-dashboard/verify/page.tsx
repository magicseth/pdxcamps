'use client';

import { useEffect, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function VerifyClaimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const verify = useMutation(api.orgDashboard.mutations.verifyOrgClaim);

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No verification token provided');
      return;
    }

    verify({ token })
      .then(() => setStatus('success'))
      .catch((e) => {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Verification failed');
      });
  }, [token, verify]);

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      {status === 'verifying' && (
        <>
          <h1 className="text-2xl font-bold mb-4">Verifying...</h1>
          <p className="text-gray-600">Please wait while we verify your claim.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="text-5xl mb-4">&#10003;</div>
          <h1 className="text-2xl font-bold mb-4 text-green-700">Organization Verified!</h1>
          <p className="text-gray-600 mb-6">
            Your organization has been verified. You can now access your dashboard.
          </p>
          <Link
            href="/org-dashboard"
            className="inline-block rounded-lg bg-blue-600 px-8 py-3 text-white font-medium hover:bg-blue-700"
          >
            Go to Dashboard
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 className="text-2xl font-bold mb-4 text-red-700">Verification Failed</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/org-dashboard" className="text-blue-600 hover:underline">
            Back to dashboard
          </Link>
        </>
      )}
    </main>
  );
}
