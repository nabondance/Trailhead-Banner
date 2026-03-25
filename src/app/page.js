import MainPage from '../components/MainPage';

export const metadata = {
  title: 'Trailhead Banner – LinkedIn Banner for Trailblazers',
  description:
    'Instantly generate a professional LinkedIn banner showcasing your Salesforce Trailhead badges, certifications, and rank.',
  alternates: { canonical: 'https://thb.nabondance.me' },
  openGraph: {
    title: 'Trailhead Banner – LinkedIn Banner for Trailblazers',
    description:
      'Instantly generate a professional LinkedIn banner showcasing your Salesforce Trailhead badges, certifications, and rank.',
    url: 'https://thb.nabondance.me',
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
    title: 'Trailhead Banner – LinkedIn Banner for Trailblazers',
    description:
      'Instantly generate a professional LinkedIn banner showcasing your Salesforce Trailhead badges, certifications, and rank.',
    images: ['/og-image.png'],
  },
};

export default function Home() {
  return <MainPage />;
}
