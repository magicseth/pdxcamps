import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/onboarding/', '/settings', '/calendar', '/saved', '/friends', '/planner/', '/sign-in', '/sign-up'],
      },
    ],
    sitemap: 'https://pdxcamps.com/sitemap.xml',
  };
}
