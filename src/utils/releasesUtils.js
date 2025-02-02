function extractDisplayContent(text) {
  const match = text.match(/<!-- display-start -->([\s\S]*?)<!-- display-end -->/);
  return match ? match[1].trim() : 'Nothing to highlight, see details on GitHub.';
}

function filterReleases(releases, filter) {
  return releases
    .filter((release) => !release.draft && !release.prerelease && release.published_at)
    .map((release) => ({
      version: release.tag_name,
      name: release.name,
      publishedAt: release.published_at,
      url: release.html_url,
      body: release.body,
    }));
}

export { extractDisplayContent, filterReleases };
