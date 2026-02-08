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

    const title = post.metaTitle || `${post.title} | PDX Camps Blog`;
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
        authors: ['PDX Camps'],
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

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;

  let post: any = null;
  try {
    post = await fetchQuery(api.blog.queries.getBySlug, { slug });
  } catch {
    notFound();
  }

  if (!post) notFound();

  // Fetch related posts
  let relatedPosts: Array<{
    _id: string;
    title: string;
    slug: string;
    excerpt: string;
    category: string;
    publishedAt?: number;
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
      name: 'PDX Camps',
      url: 'https://pdxcamps.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'PDX Camps',
      url: 'https://pdxcamps.com',
    },
    mainEntityOfPage: `https://pdxcamps.com/blog/${slug}`,
    ...(post.heroImageUrl
      ? { image: post.heroImageUrl }
      : {}),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 text-sm mb-4">
            <Link
              href="/blog"
              className="text-blue-600 hover:text-blue-800"
            >
              &larr; Blog
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800"
            >
              PDX Camps
            </Link>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              {CATEGORY_LABELS[post.category] || post.category}
            </span>
            {post.publishedAt && (
              <span className="text-sm text-gray-500">
                {formatDate(post.publishedAt)}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
            {post.title}
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            {post.excerpt}
          </p>
        </div>
      </header>

      {/* Hero image */}
      {post.heroImageUrl && (
        <div className="max-w-3xl mx-auto px-4 mt-6">
          <img
            src={post.heroImageUrl}
            alt={post.title}
            className="w-full rounded-lg shadow-sm"
          />
        </div>
      )}

      {/* Content */}
      <article className="max-w-3xl mx-auto px-4 py-8">
        <BlogPostContent content={post.content} />
      </article>

      {/* CTA */}
      <section className="bg-blue-50 border-t border-b border-blue-100">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Ready to start planning?
          </h2>
          <p className="mt-2 text-gray-600 max-w-xl mx-auto">
            Browse hundreds of summer camps, compare schedules, and plan your kids&apos; entire summer in one place. Free to get started.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/discover/portland"
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse All Camps
            </Link>
            <Link
              href="/"
              className="px-6 py-3 bg-white text-blue-600 font-medium rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
            >
              Start Planning
            </Link>
          </div>
        </div>
      </section>

      {/* Related posts */}
      {relatedPosts.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 py-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            More from the blog
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {relatedPosts.map((rp) => (
              <Link
                key={rp._id}
                href={`/blog/${rp.slug}`}
                className="group bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <span className="text-xs font-medium text-blue-600">
                  {CATEGORY_LABELS[rp.category] || rp.category}
                </span>
                <h3 className="mt-1 text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {rp.title}
                </h3>
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                  {rp.excerpt}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
