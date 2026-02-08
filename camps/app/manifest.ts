import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PDX Camps - Summer Camp Planner',
    short_name: 'PDX Camps',
    description:
      'Discover and organize summer camps for your kids. Browse programs, compare schedules, coordinate with friends, and plan your entire summer in one place.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#059669',
    categories: ['education', 'lifestyle', 'kids'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/portland/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/portland/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
