import { MetadataRoute } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../convex/_generated/api';
import { DEFAULT_MARKET, MARKETS } from '../lib/markets';
import { getAllSeoSlugs } from '../lib/seoPages';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://pdxcamps.com';

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/discover/${DEFAULT_MARKET.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/upgrade`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Dynamically add organization pages
  try {
    const organizations = await fetchQuery(api.organizations.queries.listAllOrganizations, {});
    const orgRoutes: MetadataRoute.Sitemap = organizations.map((org) => ({
      url: `${baseUrl}/organization/${org.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    // SEO landing pages for each city + page type
    const seoSlugs = getAllSeoSlugs();
    const citySlugs = MARKETS.filter((m) => m.slug !== 'mix').map((m) => m.slug);
    const seoRoutes: MetadataRoute.Sitemap = citySlugs.flatMap((citySlug) =>
      seoSlugs.map((pageSlug) => ({
        url: `${baseUrl}/${citySlug}/${pageSlug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
    );

    // Blog posts
    let blogRoutes: MetadataRoute.Sitemap = [];
    try {
      const blogSlugs = await fetchQuery(api.blog.queries.getAllSlugs, {});
      blogRoutes = [
        {
          url: `${baseUrl}/blog`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        },
        ...blogSlugs.map((post) => ({
          url: `${baseUrl}/blog/${post.slug}`,
          lastModified: new Date(),
          changeFrequency: 'monthly' as const,
          priority: 0.6,
        })),
      ];
    } catch {
      // No blog posts yet
    }

    return [...staticRoutes, ...orgRoutes, ...seoRoutes, ...blogRoutes];
  } catch {
    return staticRoutes;
  }
}
