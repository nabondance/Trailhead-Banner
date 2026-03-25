import RewindPage from '../../components/RewindPage';
import RewindWaitingPage from '../../components/RewindWaitingPage';

export const metadata = {
  title: 'Trailhead Rewind – Year in Review Banner',
  description: 'Generate a year-in-review LinkedIn banner summarising your Trailhead achievements for the past year.',
  alternates: { canonical: 'https://thb.nabondance.me/rewind' },
  openGraph: {
    title: 'Trailhead Rewind – Year in Review Banner',
    description: 'Generate a year-in-review LinkedIn banner summarising your Trailhead achievements for the past year.',
    url: 'https://thb.nabondance.me/rewind',
    siteName: 'Trailhead Banner',
    type: 'website',
    images: [
      {
        url: '/og-image-rewind.png',
        width: 1200,
        height: 630,
        alt: 'Trailhead Rewind – Year in Review Banner for Salesforce Trailblazers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trailhead Rewind – Year in Review Banner',
    description: 'Generate a year-in-review LinkedIn banner summarising your Trailhead achievements for the past year.',
    images: ['/og-image-rewind.png'],
  },
};

export default function Rewind() {
  const currentMonth = new Date().getMonth(); // 0 = January, 11 = December
  const isRewindActive = currentMonth === 11 || currentMonth === 0;

  return isRewindActive ? <RewindPage /> : <RewindWaitingPage />;
}
