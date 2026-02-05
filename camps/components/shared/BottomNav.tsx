'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMarket } from '../../hooks/useMarket';

interface BottomNavProps {
  citySlug?: string;
}

export function BottomNav({ citySlug }: BottomNavProps) {
  const pathname = usePathname();
  const market = useMarket();

  // Use explicit prop or detect from hostname (e.g., boscamps.com -> boston)
  const effectiveCitySlug = citySlug ?? market.slug;

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-2 z-20"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-around">
        <NavLink href="/" active={isActive('/')} icon={<CalendarIcon />} label="Planner" />
        <NavLink href={`/discover/${effectiveCitySlug}`} active={isActive('/discover')} icon={<SearchIcon />} label="Discover" />
        <NavLink href="/calendar" active={isActive('/calendar')} icon={<ListIcon />} label="My Camps" />
        <NavLink href="/friends" active={isActive('/friends')} icon={<FriendsIcon />} label="Friends" />
      </div>
    </nav>
  );
}

function NavLink({ href, active, icon, label }: { href: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
        active
          ? 'text-primary dark:text-primary-light'
          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
      }`}
    >
      {active && (
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary dark:bg-primary-light rounded-full" aria-hidden="true" />
      )}
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function FriendsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
