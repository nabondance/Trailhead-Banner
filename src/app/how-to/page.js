import HowToPage from '../../components/HowToPage';
import JsonLd from '../../components/JsonLd';
import { breadcrumbJsonLd } from '../../utils/seoUtils';

export const metadata = {
  title: 'How to Add Trailhead Badges to Your LinkedIn Banner',
  description: 'Step-by-step guide to generating and applying your custom Trailhead LinkedIn banner in minutes.',
  alternates: { canonical: 'https://thb.nabondance.me/how-to' },
  openGraph: {
    title: 'How to Add Trailhead Badges to Your LinkedIn Banner',
    description: 'Step-by-step guide to generating and applying your custom Trailhead LinkedIn banner in minutes.',
    url: 'https://thb.nabondance.me/how-to',
    siteName: 'Trailhead Banner',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Trailhead Banner – LinkedIn Banner for Salesforce Trailblazers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to Add Trailhead Badges to Your LinkedIn Banner',
    description: 'Step-by-step guide to generating and applying your custom Trailhead LinkedIn banner in minutes.',
    images: ['/og-image.png'],
  },
};

export default function HowTo() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd('How-To', '/how-to')} />
      <HowToPage />
    </>
  );
}
