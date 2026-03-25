import HowToPage from '../../components/HowToPage';

export const metadata = {
  title: 'How To Use Trailhead Banner',
  description: 'Step-by-step guide to generating and applying your custom Trailhead LinkedIn banner in minutes.',
  alternates: { canonical: 'https://thb.nabondance.me/how-to' },
  openGraph: {
    title: 'How To Use Trailhead Banner',
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
    title: 'How To Use Trailhead Banner',
    description: 'Step-by-step guide to generating and applying your custom Trailhead LinkedIn banner in minutes.',
    images: ['/og-image.png'],
  },
};

export default function HowTo() {
  return <HowToPage />;
}
