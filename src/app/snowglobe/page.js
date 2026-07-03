import SnowGlobePage from '../../components/SnowGlobePage';

export const metadata = {
  title: 'Trailhead Rewind 2026 — Snow Globe',
  description:
    'Shake a 3D snow globe filled with your 2026 Salesforce certifications and Trailhead stamps, then share it.',
  alternates: { canonical: 'https://thb.nabondance.me/snowglobe' },
  // POC: keep out of search engines until launch, then remove and add to sitemap.js + llms.txt
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Trailhead Rewind 2026 — Snow Globe',
    description:
      'Shake a 3D snow globe filled with your 2026 Salesforce certifications and Trailhead stamps, then share it.',
    url: 'https://thb.nabondance.me/snowglobe',
    siteName: 'Trailhead Banner',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Trailhead Rewind 2026 — Snow Globe',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trailhead Rewind 2026 — Snow Globe',
    description:
      'Shake a 3D snow globe filled with your 2026 Salesforce certifications and Trailhead stamps, then share it.',
    images: ['/og-image.png'],
  },
};

export default function SnowGlobe() {
  return <SnowGlobePage />;
}
