import { notFound, permanentRedirect } from 'next/navigation';
import SnowGlobePage from '../../../../components/SnowGlobePage';
import SupabaseUtils from '../../../../utils/supabaseUtils';
import { REWIND_YEAR, isRewindOpen } from '../../../../utils/rewindPeriod';

// same characters the form keeps from a typed username
const USERNAME_PATTERN = /^[a-z0-9._-]{1,64}$/;

async function linkUsername(params) {
  const { username } = await params;
  try {
    return decodeURIComponent(username);
  } catch {
    return username;
  }
}

export async function generateMetadata({ params }) {
  const username = (await linkUsername(params)).toLowerCase();
  const url = `https://thb.nabondance.me/rewind/${REWIND_YEAR}/${encodeURIComponent(username)}`;
  const title = `${username}'s ${REWIND_YEAR} Trailhead Rewind`;
  const description = `${username}'s ${REWIND_YEAR} Trailhead achievements in a 3D snow globe. Shake it, then make your own.`;
  return {
    title,
    description,
    // personal pages stay out of search results
    robots: { index: false, follow: true },
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
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
      title,
      description,
      images: ['/og-image-rewind.png'],
    },
  };
}

export default async function PersonalRewind({ params }) {
  const raw = await linkUsername(params);
  const username = raw.toLowerCase();
  if (!USERNAME_PATTERN.test(username)) notFound();
  if (username !== raw) permanentRedirect(`/rewind/${REWIND_YEAR}/${username}`);

  const { globe, failed } = await SupabaseUtils.getSavedSnowglobe(username, REWIND_YEAR);
  return <SnowGlobePage linkUsername={username} savedGlobe={globe} loadFailed={failed} open={isRewindOpen()} />;
}
