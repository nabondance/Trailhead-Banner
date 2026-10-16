import MainPage from '../components/MainPage';
import HomeAbout from '../components/HomeAbout';
import JsonLd from '../components/JsonLd';
import { getBannerCount, formatBannerCount } from '../utils/bannerCountUtils';
import { SITE_URL } from '../utils/seoUtils';

const title = 'Trailhead Banner – LinkedIn Banner for Trailblazers';
const description =
  'Instantly generate a professional LinkedIn banner showcasing your Salesforce Trailhead badges, certifications, and rank.';

export async function generateMetadata() {
  const formattedCount = formatBannerCount(await getBannerCount());
  return {
    title,
    description: formattedCount ? `${description} ${formattedCount} banners generated.` : description,
    alternates: { canonical: SITE_URL },
    openGraph: {
      title,
      description,
      url: SITE_URL,
      siteName: 'Trailhead Banner',
      type: 'website',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'Trailhead Banner – LinkedIn Banner for Trailblazers',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png'],
    },
  };
}

export default async function Home() {
  const bannerCount = await getBannerCount();
  return (
    <>
      {bannerCount && (
        // Merges into the site-wide WebApplication node (same @id) defined in the root layout
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            '@id': `${SITE_URL}/#app`,
            interactionStatistic: {
              '@type': 'InteractionCounter',
              interactionType: 'https://schema.org/CreateAction',
              userInteractionCount: bannerCount,
              description: 'LinkedIn banners generated',
            },
          }}
        />
      )}
      <MainPage />
      <HomeAbout />
    </>
  );
}
