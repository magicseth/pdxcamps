'use client';

import Link from 'next/link';

interface BlogCityFilterProps {
  cities: Array<{ slug: string; name: string }>;
  activeSlug?: string;
}

export function BlogCityFilter({ cities, activeSlug }: BlogCityFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/blog"
        className={`px-3 py-1.5 text-sm rounded-full border font-medium transition-colors ${
          !activeSlug
            ? 'bg-white text-slate-900 border-white'
            : 'bg-transparent text-slate-300 border-slate-600 hover:border-slate-400 hover:text-white'
        }`}
      >
        All Cities
      </Link>
      {cities.map((city) => (
        <Link
          key={city.slug}
          href={`/blog?city=${city.slug}`}
          className={`px-3 py-1.5 text-sm rounded-full border font-medium transition-colors ${
            activeSlug === city.slug
              ? 'bg-white text-slate-900 border-white'
              : 'bg-transparent text-slate-300 border-slate-600 hover:border-slate-400 hover:text-white'
          }`}
        >
          {city.name}
        </Link>
      ))}
    </div>
  );
}
