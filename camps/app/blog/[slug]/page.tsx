import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { BlogPostContent } from './BlogPostContent';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const post = await fetchQuery(api.blog.queries.getBySlug, { slug });
    if (!post) return {};

    const title = post.metaTitle || `${post.title} | Camp Guide Blog`;
    const description = post.metaDescription || post.excerpt;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://pdxcamps.com/blog/${slug}`,
        type: 'article',
        publishedTime: post.publishedAt
          ? new Date(post.publishedAt).toISOString()
          : undefined,
        authors: ['Camp Guide'],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
      alternates: {
        canonical: `https://pdxcamps.com/blog/${slug}`,
      },
    };
  } catch {
    return {};
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function estimateReadTime(content: string): string {
  const words = content.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
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

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;

  let post: any = null;
  try {
    post = await fetchQuery(api.blog.queries.getBySlug, { slug });
  } catch {
    notFound();
  }

  if (!post) notFound();

  let relatedPosts: Array<{
    _id: string;
    title: string;
    slug: string;
    excerpt: string;
    category: string;
    publishedAt?: number;
    heroImageUrl?: string;
  }> = [];
  try {
    relatedPosts = await fetchQuery(api.blog.queries.getRelated, {
      slug,
      category: post.category,
      limit: 3,
    });
  } catch {
    // Ignore
  }

  let citySlug = 'portland';
  let cityName = 'Portland';
  let brandName = 'Camp Guide';
  if (post.cityId) {
    try {
      const city = await fetchQuery(api.cities.queries.getCityById, { cityId: post.cityId });
      if (city) {
        citySlug = city.slug;
        cityName = city.name;
        brandName = city.brandName || 'Camp Guide';
      }
    } catch {
      // Use defaults
    }
  }

  const readTime = estimateReadTime(post.content || '');

  // Build JSON-LD
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt
      ? new Date(post.publishedAt).toISOString()
      : undefined,
    dateModified: new Date(post.updatedAt).toISOString(),
    author: {
      '@type': 'Organization',
      name: brandName,
    },
    publisher: {
      '@type': 'Organization',
      name: brandName,
    },
    mainEntityOfPage: `https://pdxcamps.com/blog/${slug}`,
    ...(post.heroImageUrl ? { image: post.heroImageUrl } : {}),
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      {/* Article Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
          {/* Navigation */}
          <nav className="flex items-center gap-2 text-sm mb-6">
            <Link href="/" className="text-slate-400 hover:text-primary transition-colors">
              Home
            </Link>
            <span className="text-slate-300">/</span>
            <Link href="/blog" className="text-slate-400 hover:text-primary transition-colors">
              Blog
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{post.title}</span>
          </nav>

          {/* Meta row */}
          <div className="flex items-center flex-wrap gap-3 mb-4">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${CATEGORY_COLORS[post.category] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
              {CATEGORY_LABELS[post.category] || post.category}
            </span>
            {post.publishedAt && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {formatDate(post.publishedAt)}
              </span>
            )}
            <span className="text-sm text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {readTime}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
            {post.title}
          </h1>

          {/* Excerpt */}
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
            {post.excerpt}
          </p>
        </div>
      </header>

      {/* Hero image */}
      {post.heroImageUrl && (
        <div className="max-w-3xl mx-auto px-4 -mb-4">
          <div className="relative -mt-1 rounded-xl overflow-hidden shadow-lg">
            <img
              src={post.heroImageUrl}
              alt={post.title}
              className="w-full aspect-[2/1] object-cover"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <article className="max-w-3xl mx-auto px-4 py-10 sm:py-12">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-10">
          <BlogPostContent content={post.content} />
        </div>
      </article>

      {/* Inline CTA */}
      <section className="max-w-3xl mx-auto px-4 pb-8">
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl p-6 sm:p-8 border border-primary/20">
          <div className="grid sm:grid-cols-2 gap-6 items-center">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Find camps in {cityName}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Browse hundreds of programs, compare prices, and plan your summer — all free.
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-2">
              <Link
                href={`/discover/${citySlug}`}
                className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors text-center"
              >
                Browse {cityName} Camps
              </Link>
              <Link
                href="/"
                className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors text-center"
              >
                Open Summer Planner
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Related posts */}
      {relatedPosts.length > 0 && (
        <section className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="max-w-3xl mx-auto px-4 py-10 sm:py-12">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
              Keep reading
            </h2>
            <div className="grid gap-5 sm:grid-cols-3">
              {relatedPosts.map((rp) => (
                <Link
                  key={rp._id}
                  href={`/blog/${rp.slug}`}
                  className="group rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md hover:border-slate-300 transition-all duration-200"
                >
                  <div className="aspect-[16/9] overflow-hidden">
                    {rp.heroImageUrl ? (
                      <img
                        src={rp.heroImageUrl}
                        alt={rp.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
                        <span className="text-2xl opacity-20">📖</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${CATEGORY_COLORS[rp.category] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                      {CATEGORY_LABELS[rp.category] || rp.category}
                    </span>
                    <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {rp.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
