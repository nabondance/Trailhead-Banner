import { existsSync, lstatSync, readFileSync } from 'fs';

// Renders the Lighthouse CI manifest (written by `lhci upload --target=filesystem`)
// as a markdown table. Shared by the job summary and the PR comment.
//
// The manifest may come from pull request code, possibly from a fork: treat it as
// untrusted data. Only page paths and numeric scores are used.

const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_PAGES = 20;

export const CATEGORIES = [
  { key: 'performance', label: 'Performance' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'best-practices', label: 'Best practices' },
  { key: 'seo', label: 'SEO' },
  { key: 'agentic-browsing', label: 'Agentic browsing' },
];

// Keep only a plain local path, so the page column cannot carry markdown or links
export function pagePath(url) {
  const match = typeof url === 'string' && url.match(/^http:\/\/localhost:3000(\/[a-z0-9\-/]*)?$/i);
  return match ? match[1] || '/' : null;
}

// Lighthouse colors: green 90+, orange 50-89, red below 50. Null when a category can't be scored
function formatScore(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return '–';
  const score = Math.round(value * 100);
  const dot = score >= 90 ? '🟢' : score >= 50 ? '🟠' : '🔴';
  return `${dot} ${score}`;
}

/**
 * Reads the manifest and renders the scores of each page's representative run
 * (the run with the median performance score).
 * @param {string} manifestPath
 * @param {Array<{ key: string, label: string }>} [categories] - columns to show, all categories by default
 * @returns {{ table: string, runsPerPage: { min: number, max: number } } | null} null when there is nothing usable
 */
export function renderScores(manifestPath, categories = CATEGORIES) {
  if (!manifestPath || !existsSync(manifestPath) || !lstatSync(manifestPath).isFile()) return null;
  if (lstatSync(manifestPath).size > MAX_MANIFEST_BYTES) throw new Error('Lighthouse manifest is too large');

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const runs = (Array.isArray(manifest) ? manifest : [])
    .map((run) => ({
      path: pagePath(run?.url),
      representative: run?.isRepresentativeRun === true,
      summary: run?.summary,
    }))
    .filter((run) => run.path);

  const rows = runs.filter((run) => run.representative).slice(0, MAX_PAGES);
  if (rows.length === 0) return null;

  const runCounts = rows.map((row) => runs.filter((run) => run.path === row.path).length);
  const runsPerPage = { min: Math.min(...runCounts), max: Math.max(...runCounts) };
  const table = [
    `| Page | ${categories.map((c) => c.label).join(' | ')} |`,
    `|---|${categories.map(() => '---').join('|')}|`,
    ...rows.map(
      (row) => `| \`${row.path}\` | ${categories.map((c) => formatScore(row.summary?.[c.key])).join(' | ')} |`
    ),
  ].join('\n');

  return { table, runsPerPage };
}

/**
 * One-line description of how the scores were measured.
 * @param {{ min: number, max: number }} runsPerPage
 */
export function describeRuns({ min, max }) {
  const count = min === max ? `${max}` : `${min}–${max}`;
  const runs = `${count} run${max > 1 ? 's' : ''} per page`;
  return max > 1
    ? `Mobile, light theme, local production build · ${runs}, scores from the run with the median performance`
    : `Mobile, light theme, local production build · ${runs}`;
}
