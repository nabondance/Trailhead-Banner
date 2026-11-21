import { existsSync } from 'fs';
import { join } from 'path';
import { renderIssues } from './issues.mjs';
import { CATEGORIES, describeRuns, formatRunCount, renderScores } from './scores.mjs';

// Markdown for the job summary and the PR comment, from the lighthouse-results
// directory: light/ (every category, light theme) and dark/ (accessibility only,
// dark theme; colors are the only thing the theme changes). Untrusted input: see
// scores.mjs and issues.mjs.

const DARK_CATEGORIES = CATEGORIES.filter((c) => c.key === 'accessibility');
// Other accessibility failures are the same in both themes and already listed for light
const COLOR_AUDITS = ['color-contrast', 'link-in-text-block'];

function renderDark(darkDir) {
  try {
    const dark = renderScores(join(darkDir, 'manifest.json'), DARK_CATEGORIES);
    if (!dark) return [];
    const issues = renderIssues(join(darkDir, 'issues.json'), {
      label: ' in the dark theme (colors only)',
      auditIds: COLOR_AUDITS,
    });
    return [`**Dark theme** · accessibility only, ${formatRunCount(dark.runsPerPage)}`, dark.table, issues];
  } catch (err) {
    // The light results stay usable when the dark ones are broken
    console.error(`Could not read the dark theme results: ${err.message}`);
    return ['_Dark theme results could not be read._'];
  }
}

/**
 * @param {string} resultsDir
 * @returns {{ intro: string, body: string } | null} null when there are no light-theme scores
 */
export function renderReport(resultsDir) {
  if (!resultsDir) return null;
  // Artifacts from before the dark pass have the light results at the root
  const lightDir = existsSync(join(resultsDir, 'light')) ? join(resultsDir, 'light') : resultsDir;

  const light = renderScores(join(lightDir, 'manifest.json'));
  if (!light) return null;

  const parts = [light.table, renderIssues(join(lightDir, 'issues.json')), ...renderDark(join(resultsDir, 'dark'))];
  return { intro: describeRuns(light.runsPerPage), body: parts.filter(Boolean).join('\n\n') };
}
