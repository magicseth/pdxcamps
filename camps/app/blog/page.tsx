import { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function estimateReadTime(excerpt: string): string {
  // Blog posts average ~1000 words, excerpt length correlates
  return '5 min read';
}

const CATEGORY_LABELS: Record<string, string> = {
  guide: 'Guide',
  stem: 'STEM',
  budget: 'Budget',
  outdoor: 'Outdoor',
  arts: 'Arts & Creative',
  'age-guide': 'By Age',
  tips: 'Tips',
  'weekly-update': 'Weekly Update',
};

const CATEGORY_COLORS: Record<string, string> = {
  guide: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  stem: 'bg-blue-50 text-blue-700 border-blue-200',
  budget: 'bg-green-50 text-green-700 border-green-200',
  outdoor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  arts: 'bg-purple-50 text-purple-700 border-purple-200',
  'age-guide': 'bg-amber-50 text-amber-700 border-amber-200',
  tips: 'bg-orange-50 text-orange-700 border-orange-200',
  'weekly-update': 'bg-rose-50 text-rose-700 border-rose-200',
};

async function resolveCity() {
  const headersList = await headers();
  const hostname = headersList.get('host') || 'localhost';
  const domain = hostname.split(':')[0].toLowerCase().replace(/^www\./, '');

  let cityId: string | undefined;
  let citySlug = 'portland';
  let cityName: string | undefined;
  let cityDomain = 'pdxcamps.com';

  try {
    const city = await fetchQuery(api.cities.queries.getCityByDomain, { domain });
    if (city) {
      cityId = city._id;
      citySlug = city.slug;
      cityName = city.name;
      cityDomain = city.domain || domain;
    }
  } catch {
    // Fall back to defaults
  }

  return { cityId, citySlug, cityName, cityDomain };
}

export async function generateMetadata(): Promise<Metadata> {
  const { cityName, cityDomain } = await resolveCity();
  const title = cityName
    ? `${cityName} Summer Camp Blog | Guides, Tips & Weekly Updates`
    : 'Summer Camp Blog | Guides, Tips & Weekly Updates';

  return {
    title,
    description:
      'Expert guides on summer camps — from STEM to arts, budget picks to age-specific recommendations. Real data from hundreds of programs.',
    openGraph: {
      title,
      description:
        'Expert guides on summer camps with real data and local recommendations.',
      url: `https://${cityDomain}/blog`,
      type: 'website',
    },
    alternates: {
      canonical: `https://${cityDomain}/blog`,
    },
  };
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: activeCategory } = await searchParams;
  const { cityId, citySlug, cityName } = await resolveCity();

  let posts: Array<{
    _id: string;
    title: string;
    slug: string;
    excerpt: string;
    heroImageUrl?: string;
    category: string;
    tags?: string[];
    publishedAt?: number;
  }> = [];

  try {
    posts = await fetchQuery(api.blog.queries.listPublished, {
      ...(cityId ? { cityId: cityId as any } : {}),
      ...(activeCategory ? { category: activeCategory } : {}),
    });
  } catch {
    // No posts yet
  }

  // Separate featured (first) post from the rest
  const featuredPost = posts[0];
  const remainingPosts = posts.slice(1);

  // Get unique categories from posts for filter tabs
  const categories = [...new Set(posts.map((p) => p.category))];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Hero Header */}
      <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-white mb-4 inline-flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Home
          </Link>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-2">
            {cityName ? `${cityName} Camp Blog` : 'Summer Camp Blog'}
          </h1>
          <p className="mt-3 text-lg text-slate-300 max-w-2xl">
            Data-driven guides, expert tips, and weekly updates to help you plan the perfect summer for your kids.
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* Category filter tabs */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <Link
              href="/blog"
              className={`px-4 py-2 text-sm rounded-lg border font-medium transition-colors ${
                !activeCategory
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              All
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat}
                href={`/blog?category=${cat}`}
                className={`px-4 py-2 text-sm rounded-lg border font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                {CATEGORY_LABELS[cat] || cat}
              </Link>
            ))}
          </div>
        )}

        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📝</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              No posts yet{cityName ? ` for ${cityName}` : ''}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">Check back soon — new guides are published weekly.</p>
          </div>
        ) : (
          <>
            {/* Featured Post (hero) */}
            {featuredPost && !activeCategory && (
              <Link
                href={`/blog/${featuredPost.slug}`}
                className="group block mb-10 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-200 dark:border-slate-700"
              >
                <div className="grid md:grid-cols-2 gap-0">
                  {/* Image side */}
                  <div className="aspect-video md:aspect-auto bg-gradient-to-br from-primary/20 to-accent/20 overflow-hidden">
                    {featuredPost.heroImageUrl ? (
                      <img
                        src={featuredPost.heroImageUrl}
                        alt={featuredPost.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full min-h-[240px] flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
                        <span className="text-6xl opacity-30">📖</span>
                      </div>
                    )}
                  </div>
                  {/* Content side */}
                  <div className="p-6 sm:p-8 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${CATEGORY_COLORS[featuredPost.category] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                        {CATEGORY_LABELS[featuredPost.category] || featuredPost.category}
                      </span>
                      {featuredPost.publishedAt && (
                        <span className="text-xs text-slate-400">{formatDate(featuredPost.publishedAt)}</span>
                      )}
                      <span className="text-xs text-slate-400">{estimateReadTime(featuredPost.excerpt)}</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors leading-tight">
                      {featuredPost.title}
                    </h2>
                    <p className="mt-3 text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                      {featuredPost.excerpt}
                    </p>
                    <span className="mt-4 text-primary font-medium text-sm group-hover:underline inline-flex items-center gap-1">
                      Read article
                      <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {/* Posts grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(activeCategory ? posts : remainingPosts).map((post) => (
                <Link
                  key={post._id}
                  href={`/blog/${post.slug}`}
                  className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                >
                  {/* Card image */}
                  <div className="aspect-[16/9] overflow-hidden">
                    {post.heroImageUrl ? (
                      <img
                        src={post.heroImageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
                        <span className="text-3xl opacity-20">📖</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${CATEGORY_COLORS[post.category] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                        {CATEGORY_LABELS[post.category] || post.category}
                      </span>
                      {post.publishedAt && (
                        <span className="text-xs text-slate-400">
                          {formatDate(post.publishedAt)}
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Email capture + CTA */}
      <section className="bg-gradient-to-br from-primary/5 to-accent/5 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Ready to plan your summer?
              </h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Browse hundreds of camps, compare schedules, and plan your kids&apos; entire summer in one place.
              </p>
              <div className="mt-5 flex gap-3">
                <Link
                  href={`/discover/${citySlug}`}
                  className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors"
                >
                  Browse Camps
                </Link>
                <Link
                  href="/"
                  className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Start Planning
                </Link>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                Get weekly camp updates
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                New sessions, price drops, and spots opening up — delivered to your inbox.
              </p>
              <form className="flex gap-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
                >
                  Sign Up
                </button>
              </form>
              <p className="text-xs text-slate-400 mt-2">No spam, unsubscribe anytime.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
