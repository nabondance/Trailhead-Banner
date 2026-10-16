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
    // A single group: some crawlers only read the first `User-Agent: *` group.
    // Never disallow /_next/ — crawlers need its JS/CSS to render pages.
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', ...noIndexPaths],
      },
    ],
    sitemap: 'https://thb.nabondance.me/sitemap.xml',
  };
}
