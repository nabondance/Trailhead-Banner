import ExamplesPage from '../../components/ExamplesPage';
import JsonLd from '../../components/JsonLd';
import { breadcrumbJsonLd } from '../../utils/seoUtils';

export const metadata = {
  title: 'Trailhead LinkedIn Banner Examples – Trailhead Banner',
  description:
    'Browse example LinkedIn banners generated from real Trailhead profiles — badges, certifications, MVP ribbon, and more.',
  alternates: { canonical: 'https://thb.nabondance.me/examples' },
  openGraph: {
    title: 'Trailhead LinkedIn Banner Examples – Trailhead Banner',
    description:
      'Browse example LinkedIn banners generated from real Trailhead profiles — badges, certifications, MVP ribbon, and more.',
    url: 'https://thb.nabondance.me/examples',
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
    title: 'Trailhead LinkedIn Banner Examples – Trailhead Banner',
    description:
      'Browse example LinkedIn banners generated from real Trailhead profiles — badges, certifications, MVP ribbon, and more.',
    images: ['/og-image.png'],
  },
};

export default function Examples() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd('Examples', '/examples')} />
      <ExamplesPage />
    </>
  );
}
