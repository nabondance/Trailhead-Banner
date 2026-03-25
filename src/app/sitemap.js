export default async function sitemap() {
  const baseUrl = 'https://thb.nabondance.me';

  const routes = [
    { path: '', priority: 1.0, changeFrequency: 'daily' },
    { path: '/examples', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/how-to', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/background-library', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/rewind', priority: 0.6, changeFrequency: 'weekly' },
    { path: '/releases', priority: 0.6, changeFrequency: 'weekly' },
    { path: '/legal', priority: 0.5, changeFrequency: 'yearly' },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
