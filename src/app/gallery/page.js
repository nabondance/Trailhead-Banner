import GalleryPage from '../../components/GalleryPage';
import JsonLd from '../../components/JsonLd';
import { breadcrumbJsonLd } from '../../utils/seoUtils';

const title = 'Banner Examples & Backgrounds – Trailhead Banner';
const description =
  'Example LinkedIn banners generated from real Trailhead profiles, and the library of Salesforce-themed backgrounds you can use for yours.';

export const metadata = {
  title,
  description,
  alternates: { canonical: 'https://thb.nabondance.me/gallery' },
  openGraph: {
    title,
    description,
    url: 'https://thb.nabondance.me/gallery',
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
    title,
    description,
    images: ['/og-image.png'],
  },
};

export default function Gallery() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd('Gallery', '/gallery')} />
      <GalleryPage />
    </>
  );
}
