import { MetadataRoute } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../convex/_generated/api';
import { MARKETS } from '../lib/markets';
import { getAllSeoSlugs } from '../lib/seoPages';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://pdxcamps.com';
  const now = new Date();

  const citySlugs = MARKETS.filter((m) => m.slug !== 'mix').map((m) => m.slug);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/upgrade`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Discover pages for each city
  const discoverRoutes: MetadataRoute.Sitemap = citySlugs.map((citySlug) => ({
    url: `${baseUrl}/discover/${citySlug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.9,
  }));

  try {
    // Organization pages
    const organizations = await fetchQuery(api.organizations.queries.listAllOrganizations, {});
    const orgRoutes: MetadataRoute.Sitemap = organizations.map((org) => ({
      url: `${baseUrl}/organization/${org.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    // SEO landing pages for each city x page type
    const seoSlugs = getAllSeoSlugs();
    const seoRoutes: MetadataRoute.Sitemap = citySlugs.flatMap((citySlug) =>
      seoSlugs.map((pageSlug) => ({
        url: `${baseUrl}/${citySlug}/${pageSlug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
    );

    // Neighborhood pages for each city
    let neighborhoodRoutes: MetadataRoute.Sitemap = [];
    try {
      const cities = await fetchQuery(api.cities.queries.listActiveCities, {});
      const neighborhoodResults = await Promise.all(
        cities.map(async (city) => {
          try {
            const neighborhoods = await fetchQuery(api.cities.queries.listNeighborhoods, { cityId: city._id });
            return neighborhoods.map((n: any) => ({
              url: `${baseUrl}/${city.slug}/neighborhoods/${n.slug}`,
              lastModified: now,
              changeFrequency: 'weekly' as const,
              priority: 0.7,
            }));
          } catch {
            return [];
          }
        }),
      );
      neighborhoodRoutes = neighborhoodResults.flat();
    } catch {
      // Skip neighborhoods
    }

    // Neighborhood index pages
    const neighborhoodIndexRoutes: MetadataRoute.Sitemap = citySlugs.map((citySlug) => ({
      url: `${baseUrl}/${citySlug}/neighborhoods`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    // Blog posts
    let blogRoutes: MetadataRoute.Sitemap = [];
    try {
      const blogSlugs = await fetchQuery(api.blog.queries.getAllSlugs, {});
      blogRoutes = [
        {
          url: `${baseUrl}/blog`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        },
        ...blogSlugs.map((post) => ({
          url: `${baseUrl}/blog/${post.slug}`,
          lastModified: now,
          changeFrequency: 'monthly' as const,
          priority: 0.6,
        })),
      ];
    } catch {
      // No blog posts yet
    }

    return [
      ...staticRoutes,
      ...discoverRoutes,
      ...orgRoutes,
      ...seoRoutes,
      ...neighborhoodIndexRoutes,
      ...neighborhoodRoutes,
      ...blogRoutes,
    ];
  } catch {
    return [...staticRoutes, ...discoverRoutes];
  }
}
