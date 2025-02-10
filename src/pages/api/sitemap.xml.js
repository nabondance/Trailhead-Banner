import { getServerSideSitemap } from 'next-sitemap';

export const getServerSideProps = async (ctx) => {
  try {
    console.log('Generating sitemap...');
    const fields = [
      {
        loc: 'https://thb.nabondance.me/',
        lastmod: new Date().toISOString(),
      },
    ];

    console.log('Sitemap fields:', fields);
    return getServerSideSitemap(ctx, fields);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return {
      notFound: true,
    };
  }
};

export default function Sitemap() {
  return null; // Ensure the function returns null
}
