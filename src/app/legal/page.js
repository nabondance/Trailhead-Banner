import LegalPage from '../../components/LegalPage';

export const metadata = {
  title: 'Legal – Trailhead Banner',
  description: 'Terms of use, privacy policy, and legal information for the Trailhead Banner tool.',
  alternates: { canonical: 'https://thb.nabondance.me/legal' },
  openGraph: {
    title: 'Legal – Trailhead Banner',
    description: 'Terms of use, privacy policy, and legal information for the Trailhead Banner tool.',
    url: 'https://thb.nabondance.me/legal',
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
    title: 'Legal – Trailhead Banner',
    description: 'Terms of use, privacy policy, and legal information for the Trailhead Banner tool.',
    images: ['/og-image.png'],
  },
};

export default function Legal() {
  return <LegalPage />;
}
