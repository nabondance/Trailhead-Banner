import SnowGlobePage from '../../components/SnowGlobePage';
import RewindWaitingPage from '../../components/RewindWaitingPage';
import JsonLd from '../../components/JsonLd';
import { breadcrumbJsonLd } from '../../utils/seoUtils';
import { getGenerationCount } from '../../utils/bannerCountUtils';
import { SERVER_ENV } from '../../utils/envUtils';

// The 2026 Rewind is the snow globe
const REWIND_YEAR = 2026;
const TITLE = 'Trailhead Rewind 2026 – Your Year in a Snow Globe';
const DESCRIPTION =
  'Shake a 3D snow globe filled with your 2026 Trailhead achievements, then share it as an image or video.';

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: 'https://thb.nabondance.me/rewind' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://thb.nabondance.me/rewind',
    siteName: 'Trailhead Banner',
    type: 'website',
    images: [
      {
        url: '/og-image-rewind.png',
        width: 1200,
        height: 630,
        alt: 'Trailhead Rewind – your Trailhead year in review',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image-rewind.png'],
  },
};

export default async function Rewind() {
  const currentMonth = new Date().getMonth(); // 0 = January, 11 = December
  // always open outside production (local dev, Vercel previews) for testing;
  // production opens December–January
  const isRewindActive = SERVER_ENV !== 'production' || currentMonth === 11 || currentMonth === 0;

  return (
    <>
      <JsonLd data={breadcrumbJsonLd('Trailhead Rewind', '/rewind')} />
      {isRewindActive ? (
        <SnowGlobePage fallbackCount={await getGenerationCount('rewinds', REWIND_YEAR)} />
      ) : (
        <RewindWaitingPage />
      )}
    </>
  );
}
