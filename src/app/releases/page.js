import { extractDisplayContent, filterReleases } from '../../utils/releasesUtils';

export const metadata = {
  title: 'Releases – Trailhead Banner',
  description: 'See what is new in Trailhead Banner: changelog, feature updates, and release history.',
  alternates: { canonical: 'https://thb.nabondance.me/releases' },
  openGraph: {
    title: 'Releases – Trailhead Banner',
    description: 'See what is new in Trailhead Banner: changelog, feature updates, and release history.',
    url: 'https://thb.nabondance.me/releases',
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
    title: 'Releases – Trailhead Banner',
    description: 'See what is new in Trailhead Banner: changelog, feature updates, and release history.',
    images: ['/og-image.png'],
  },
};

export default async function ReleasesPage() {
  try {
    const res = await fetch('https://api.github.com/repos/nabondance/trailhead-banner/releases', {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
      next: { revalidate: 3600 }, // Cache API response for 1 hour
    });

    const releasesData = await res.json();
    if (!Array.isArray(releasesData)) {
      throw new Error('API response is not an array');
    }

    const releases = filterReleases(releasesData);

    return (
      <div className='releases-container'>
        <h1>Trailhead Banner Releases</h1>
        <ul className='releases-list'>
          {releases.length > 0 ? (
            releases.map((release, index) => (
              <li key={`${release.id}-${index}`}>
                <a href={release.url} target='_blank' rel='noopener noreferrer'>
                  {release.name || release.tag_name}
                  {index === 0 && <span className='release-tag'>Latest</span>}
                </a>
                <p>Published on: {new Date(release.publishedAt).toLocaleDateString()}</p>
                {release.body && (
                  <div className='release-tags'>
                    {' '}
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{extractDisplayContent(release.body)}</pre>
                  </div>
                )}
              </li>
            ))
          ) : (
            <p>No releases found.</p>
          )}
        </ul>
      </div>
    );
  } catch (error) {
    console.error('Error fetching releases:', error);
    return <p>Error fetching releases. Please try again later.</p>;
  }
}
