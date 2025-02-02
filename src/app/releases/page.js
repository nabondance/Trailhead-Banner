import { extractDisplayContent } from '../../utils/releasesUtils';

export default async function ReleasesPage() {
  const res = await fetch('https://api.github.com/repos/nabondance/trailhead-banner/releases', {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    next: { revalidate: 3600 }, // Cache API response for 1 hour
  });

  const releases = await res.json();

  return (
    <div className='releases-container'>
      <h1>Latest Releases</h1>
      <ul className='releases-list'>
        {releases.length > 0 ? (
          releases.map((release) => (
            <li key={release.id}>
              <a href={release.html_url} target='_blank' rel='noopener noreferrer'>
                {release.name || release.tag_name}
              </a>
              <p>Published on: {new Date(release.published_at).toLocaleDateString()}</p>
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
