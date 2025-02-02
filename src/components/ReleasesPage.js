// pages/releases.js
import React from 'react';

export async function getStaticProps() {
  const res = await fetch('https://api.github.com/repos/nabondance/trailhead-banner/releases');
  const releases = await res.json();
  console.log('Fetched releases:', releases); // Debugging line

  return {
    props: {
      releases,
    },
    revalidate: 3600, // Revalidate at most once per hour
  };
}

const ReleasesPage = ({ releases }) => (
  <div>
    <h1>Latest Releases</h1>
    <ul>
      {releases && releases.length > 0 ? (
        releases.map((release) => (
          <li key={release.id}>
            <a href={release.html_url} target='_blank' rel='noopener noreferrer'>
              {release.name || release.tag_name}
            </a>
            <p>Published on: {new Date(release.published_at).toLocaleDateString()}</p>
          </li>
        ))
      ) : (
        <p>No releases found.</p>
      )}
    </ul>
  </div>
);

export default ReleasesPage;
