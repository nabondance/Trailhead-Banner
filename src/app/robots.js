const noIndexPaths = [];

export default function robots() {
  if (process.env.VERCEL_ENV !== 'production') {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '*',
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/api/', // Next.js API routes
      },
      {
        userAgent: '*',
        disallow: '/_next/', // Next.js build output
      },
      {
        userAgent: '*',
        disallow: '/public/', // static files like css, images, fonts. This one's up to you!
      },
      ...noIndexPaths.map((path) => ({
        userAgent: '*',
        disallow: path,
      })),
    ],
    sitemap: 'https://thb.nabondance.me/sitemap.xml',
  };
}
