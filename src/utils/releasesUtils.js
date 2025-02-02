function extractDisplayContent(text) {
  const match = text.match(/<!-- display-start -->([\s\S]*?)<!-- display-end -->/);
  return match ? match[1].trim() : 'Nothing to highlight, see details on GitHub.';
}

export { extractDisplayContent };
