import { getServerSideSitemap } from 'next-sitemap';

export const getServerSideProps = async (ctx) => {
  const fields = [
    {
      loc: 'https://trailhead-banner.vercel.app/',
      lastmod: new Date().toISOString(),
    },
    // Add more URLs here
  ];

  return getServerSideSitemap(ctx, fields);
};

export default function Sitemap() {
  return null; // Ensure the function returns null
}
