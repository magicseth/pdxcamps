'use client';

import { Authenticated, Unauthenticated, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import Link from 'next/link';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import type { User } from '@workos-inc/node';

export default function Home() {
  const { user, signOut } = useAuth();

  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        PDX Camps
        {user && <UserMenu user={user} onSignOut={signOut} />}
      </header>
      <main className="p-8 flex flex-col gap-8">
        <h1 className="text-4xl font-bold text-center">PDX Camps</h1>
        <p className="text-center text-lg text-slate-600 dark:text-slate-400">
          Discover and organize summer camps for your kids in Portland
        </p>
        <Authenticated>
          <AuthenticatedContent />
        </Authenticated>
        <Unauthenticated>
          <SignInForm />
        </Unauthenticated>
      </main>
    </>
  );
}

function SignInForm() {
  return (
    <div className="flex flex-col gap-8 w-96 mx-auto">
      <p className="text-center">Sign in to discover and track camps for your family</p>
      <div className="flex gap-4 justify-center">
        <a href="/sign-in">
          <button className="bg-foreground text-background px-6 py-2 rounded-md">Sign in</button>
        </a>
        <a href="/sign-up">
          <button className="border border-foreground px-6 py-2 rounded-md">Sign up</button>
        </a>
      </div>
    </div>
  );
}

function AuthenticatedContent() {
  const cities = useQuery(api.cities.queries.listActiveCities);
  const family = useQuery(api.families.queries.getCurrentFamily);

  if (cities === undefined) {
    return <div className="mx-auto">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      {family ? (
        <div className="bg-green-100 dark:bg-green-900 p-4 rounded-md">
          <p className="font-semibold">Welcome back, {family.displayName}!</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Ready to explore camps?
          </p>
        </div>
      ) : (
        <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-md">
          <p className="font-semibold">Complete your profile</p>
          <p className="text-sm">Set up your family to start discovering camps.</p>
          <Link href="/onboarding" className="text-blue-600 underline text-sm">
            Get started →
          </Link>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold mb-4">Available Cities</h2>
        {cities.length === 0 ? (
          <p className="text-slate-500">No cities available yet. Run the seed script to add Portland.</p>
        ) : (
          <div className="grid gap-4">
            {cities.map((city) => (
              <Link
                key={city._id}
                href={`/discover/${city.slug}`}
                className="block p-4 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <h3 className="font-semibold">{city.name}, {city.state}</h3>
                <p className="text-sm text-slate-500">Discover camps in {city.name}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <Link
          href="/calendar"
          className="flex-1 p-4 border rounded-md text-center hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <h3 className="font-semibold">My Calendar</h3>
          <p className="text-sm text-slate-500">View registered camps</p>
        </Link>
        <Link
          href="/friends"
          className="flex-1 p-4 border rounded-md text-center hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <h3 className="font-semibold">Friends</h3>
          <p className="text-sm text-slate-500">Connect with other families</p>
        </Link>
      </div>
    </div>
  );
}

function UserMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return (
    <div className="flex items-center gap-4">
      <Link href="/settings" className="text-sm hover:underline">
        Settings
      </Link>
      <span className="text-sm">{user.email}</span>
      <button onClick={onSignOut} className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600">
        Sign out
      </button>
    </div>
  );
}
