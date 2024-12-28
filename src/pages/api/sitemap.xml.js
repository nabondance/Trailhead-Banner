import { getServerSideSitemap } from 'next-sitemap';

export const getServerSideProps = async (ctx) => {
  const fields = [
    {
      loc: 'https://yourdomain.com/', // Absolute url
      lastmod: new Date().toISOString(),
    },
    // Add more URLs here
  ];

  return getServerSideSitemap(ctx, fields);
};

export default function Sitemap() {}
