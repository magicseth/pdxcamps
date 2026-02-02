'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect to home - planner is now the default view
export default function PlannerPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse motion-reduce:animate-none text-slate-500">Redirecting...</div>
    </div>
  );
}
