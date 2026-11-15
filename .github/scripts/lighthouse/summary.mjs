import { appendFileSync } from 'fs';
import { describeRuns, renderScores } from './scores.mjs';

// Writes the Lighthouse scores to the job summary of the Lighthouse workflow run.

const manifestPath = process.env.MANIFEST_PATH;
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

if (!summaryPath) {
  console.error('ERROR: GITHUB_STEP_SUMMARY is not set');
  process.exit(1);
}

let markdown;
try {
  const scores = renderScores(manifestPath);
  markdown = scores
    ? `### Lighthouse\n\n${describeRuns(scores.runsPerPage)}\n\n${scores.table}\n`
    : '### Lighthouse\n\nNo Lighthouse results.\n';
} catch (err) {
  markdown = `### Lighthouse\n\nCould not read the Lighthouse results: ${err.message}\n`;
}

appendFileSync(summaryPath, markdown);
console.log(markdown);
