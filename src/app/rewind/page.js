import SnowGlobePage from '../../components/SnowGlobePage';
import RewindWaitingPage from '../../components/RewindWaitingPage';
import JsonLd from '../../components/JsonLd';
import { breadcrumbJsonLd } from '../../utils/seoUtils';
import { getGenerationCount } from '../../utils/bannerCountUtils';
import { REWIND_YEAR, isRewindOpen } from '../../utils/rewindPeriod';

// re-render hourly: the page opens and closes with the Rewind period, which a
// page built once at deploy time would miss
export const revalidate = 3600;

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
  return (
    <>
      <JsonLd data={breadcrumbJsonLd('Trailhead Rewind', '/rewind')} />
      {isRewindOpen() ? (
        <SnowGlobePage fallbackCount={await getGenerationCount('rewinds', REWIND_YEAR)} />
      ) : (
        <RewindWaitingPage />
      )}
    </>
  );
}
