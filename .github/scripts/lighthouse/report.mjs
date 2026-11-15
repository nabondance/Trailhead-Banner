import { existsSync } from 'fs';
import { join } from 'path';
import { renderIssues } from './issues.mjs';
import { CATEGORIES, describeRuns, renderScores } from './scores.mjs';

// Markdown for the job summary and the PR comment, from the lighthouse-results
// directory: light/ (every category, light theme) and dark/ (accessibility only,
// dark theme; colors are the only thing the theme changes). Untrusted input: see
// scores.mjs and issues.mjs.

const DARK_CATEGORIES = CATEGORIES.filter((c) => c.key === 'accessibility');

/**
 * @param {string} resultsDir
 * @returns {{ intro: string, body: string } | null} null when there are no light-theme scores
 */
export function renderReport(resultsDir) {
  if (!resultsDir) return null;
  // Artifacts from before the dark pass have the light results at the root
  const lightDir = existsSync(join(resultsDir, 'light')) ? join(resultsDir, 'light') : resultsDir;
  const darkDir = join(resultsDir, 'dark');

  const light = renderScores(join(lightDir, 'manifest.json'));
  if (!light) return null;

  const parts = [light.table, renderIssues(join(lightDir, 'issues.json'))];
  const dark = renderScores(join(darkDir, 'manifest.json'), DARK_CATEGORIES);
  if (dark) {
    parts.push('**Dark theme** · accessibility only, 1 run per page', dark.table);
    parts.push(renderIssues(join(darkDir, 'issues.json'), ' in the dark theme'));
  }

  return { intro: describeRuns(light.runsPerPage), body: parts.filter(Boolean).join('\n\n') };
}
