export default async function sitemap() {
  const baseUrl = 'https://thb.nabondance.me';

  // Define your static routes
  const routes = [
    '', // home page
    '/about',
    '/background-library',
    '/examples',
    '/how-to',
    '/legal',
    '/releases',
  ];

  // Create sitemap entries for static routes
  const staticRoutesSitemap = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.8,
  }));

  // combine all the sitemap entries into a single array
  return [...staticRoutesSitemap];
}
