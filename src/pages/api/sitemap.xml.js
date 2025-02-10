import { getServerSideSitemap } from 'next-sitemap';

export const getServerSideProps = async (ctx) => {
  try {
    console.log('Generating sitemap...');
    const startTime = Date.now();

    const fields = [
      {
        loc: 'https://thb.nabondance.me/',
        lastmod: new Date().toISOString(),
      },
    ];

    console.log('Sitemap fields:', fields);
    const result = getServerSideSitemap(ctx, fields);

    const endTime = Date.now();
    console.log(`Sitemap generated in ${endTime - startTime}ms`);

    return result;
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
