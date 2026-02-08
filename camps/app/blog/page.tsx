import { Metadata } from 'next';
import Link from 'next/link';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

export const metadata: Metadata = {
  title: 'Blog | PDX Camps',
  description:
    'Guides, tips, and weekly updates on summer camps in Portland. Real data, real recommendations from a local parent.',
  openGraph: {
    title: 'Blog | PDX Camps',
    description:
      'Guides, tips, and weekly updates on summer camps in Portland.',
    url: 'https://pdxcamps.com/blog',
    type: 'website',
  },
  alternates: {
    canonical: 'https://pdxcamps.com/blog',
  },
};

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

export default async function BlogIndexPage() {
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
    posts = await fetchQuery(api.blog.queries.listPublished, {});
  } catch {
    // No posts yet
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            &larr; Back to PDX Camps
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            PDX Camps Blog
          </h1>
          <p className="mt-2 text-gray-600">
            Real data, real recommendations. Written by a local Portland parent.
          </p>
        </div>
      </header>

      {/* Posts grid */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {posts.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={post._id}
                href={`/blog/${post.slug}`}
                className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {post.heroImageUrl && (
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    <img
                      src={post.heroImageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {CATEGORY_LABELS[post.category] || post.category}
                    </span>
                    {post.publishedAt && (
                      <span className="text-xs text-gray-400">
                        {formatDate(post.publishedAt)}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                    {post.excerpt}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer CTA */}
      <section className="bg-blue-50 border-t border-blue-100">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Ready to plan your summer?
          </h2>
          <p className="mt-2 text-gray-600">
            Browse hundreds of camps, compare schedules, and plan your kids&apos; entire summer in one place.
          </p>
          <Link
            href="/discover/portland"
            className="mt-4 inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse All Camps
          </Link>
        </div>
      </section>
    </div>
  );
}
