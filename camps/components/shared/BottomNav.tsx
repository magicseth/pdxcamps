'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMarket } from '../../hooks/useMarket';
import { CalendarIcon, SearchIcon, ClipboardListIcon, FriendsIcon } from './icons';

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
        <NavLink href="/" active={isActive('/')} icon={<CalendarIcon className="w-5 h-5" />} label="Planner" />
        <NavLink href={`/discover/${effectiveCitySlug}`} active={isActive('/discover')} icon={<SearchIcon />} label="Discover" />
        <NavLink href="/calendar" active={isActive('/calendar')} icon={<ClipboardListIcon />} label="My Camps" />
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

