import { appendFileSync, existsSync } from 'fs';
import { join } from 'path';
import { writeIssues } from './issues.mjs';
import { renderReport } from './report.mjs';

// Runs in the Lighthouse job: writes issues.json (failing audits) next to each
// theme's manifest, then the scores and failing audits to the job summary.

const resultsDir = process.env.RESULTS_DIR;
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

if (!resultsDir || !summaryPath) {
  console.error('ERROR: RESULTS_DIR and GITHUB_STEP_SUMMARY are required');
  process.exit(1);
}

for (const theme of ['light', 'dark']) {
  const dir = join(resultsDir, theme);
  if (!existsSync(join(dir, 'manifest.json'))) continue;
  try {
    writeIssues(dir);
  } catch (err) {
    console.error(`Could not extract the ${theme} theme failing audits: ${err.message}`);
  }
}

let markdown;
try {
  const report = renderReport(resultsDir);
  markdown = report
    ? `### Lighthouse\n\n${report.intro}\n\n${report.body}\n`
    : '### Lighthouse\n\nNo Lighthouse results.\n';
} catch (err) {
  markdown = `### Lighthouse\n\nCould not read the Lighthouse results: ${err.message}\n`;
}

appendFileSync(summaryPath, markdown);
console.log(markdown);
