import { extractDisplayContent, filterReleases } from '../../utils/releasesUtils';

export default async function ReleasesPage() {
  const res = await fetch('https://api.github.com/repos/nabondance/trailhead-banner/releases', {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    next: { revalidate: 1 }, // Cache API response for 1 hour
  });

  const releases = filterReleases(await res.json());

  return (
    <div className='releases-container'>
      <h1>Trailhead Banner Releases</h1>
      <ul className='releases-list'>
        {releases.length > 0 ? (
          releases.map((release, index) => (
            <li key={release.id}>
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
}
