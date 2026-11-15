import { existsSync, lstatSync, readFileSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { CATEGORIES, PAGE_PATH, pagePath } from './scores.mjs';

// Failing Lighthouse audits, for the collapsible details under the score table.
//
// extractIssues() runs in the Lighthouse job: it reads the full reports of each
// page's representative run and keeps a small summary (issues.json), so the
// comment job doesn't need the multi-MB reports artifact.
//
// renderIssues() runs in the job summary and in the PR comment job. issues.json
// may come from pull request code, possibly from a fork: treat it as untrusted.
// Every string is length-capped and escaped, ids and paths are allow-listed.

const PASS_SCORE = 0.9; // Lighthouse shows audits below 0.9 as failing
const SHOWN_ITEMS_PER_AUDIT = 3;
const KEPT_ITEMS_PER_AUDIT = 10; // kept in issues.json, so items can be merged across pages
const MAX_ISSUES_BYTES = 256 * 1024;
const MAX_AUDITS = 60;
const MAX_MARKDOWN_CHARS = 30000;
const AUDIT_ID = /^[a-z0-9-]{1,80}$/;
// Performance opportunities and diagnostics have no weight but say what to fix
const DIAGNOSTIC_MODES = new Set(['binary', 'numeric', 'metricSavings']);
const LIMITS = { title: 200, displayValue: 80, target: 200, note: 300 };

const categoryLabels = new Map(CATEGORIES.map((c) => [c.key, c.label]));

const capped = (value, max) => (typeof value === 'string' && value ? value.slice(0, max) : undefined);

// First line of an axe explanation that says what is wrong, e.g. "Element has insufficient color contrast of 2.76 (…)"
function explanationOf(node) {
  if (typeof node?.explanation !== 'string') return undefined;
  return node.explanation
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !/^Fix (any|all) of the following:?$/i.test(line))
    ?.replace(/\.?\s*Expected contrast ratio.*$/i, '');
}

// Table rows, plus the rows of nested tables (insights use list details)
function detailItems(details) {
  if (!Array.isArray(details?.items)) return [];
  return details.items.flatMap((item) => (Array.isArray(item?.items) ? item.items : [item]));
}

function itemOf(item) {
  const target = [item?.node?.selector, item?.selector, item?.url, item?.source?.url, item?.sourceLocation?.url].find(
    (v) => typeof v === 'string' && v
  );
  const note = explanationOf(item?.node) ?? [item?.message, item?.description].find((v) => typeof v === 'string');
  if (!target && !note) return null;
  return { target: capped(target, LIMITS.target), note: capped(note, LIMITS.note) };
}

/**
 * Builds the failing-audit summary from the reports written by `lhci upload --target=filesystem`.
 * @param {string} reportsDir - directory holding manifest.json and the JSON reports
 * @returns {Array<{ path: string, audits: Array<object> }>}
 */
export function extractIssues(reportsDir) {
  const manifest = JSON.parse(readFileSync(join(reportsDir, 'manifest.json'), 'utf8'));
  return manifest
    .filter((run) => run?.isRepresentativeRun === true && pagePath(run.url) && typeof run.jsonPath === 'string')
    .map((run) => {
      const lhr = JSON.parse(readFileSync(join(reportsDir, basename(run.jsonPath)), 'utf8'));
      const audits = [];
      for (const { key } of CATEGORIES) {
        const category = lhr.categories?.[key];
        const categoryFails = typeof category?.score === 'number' && category.score < PASS_SCORE;
        for (const ref of category?.auditRefs ?? []) {
          const audit = lhr.audits?.[ref.id];
          if (typeof audit?.score !== 'number' || audit.score >= PASS_SCORE) continue;
          const diagnostic = key === 'performance' && categoryFails && DIAGNOSTIC_MODES.has(audit.scoreDisplayMode);
          if (!(ref.weight > 0) && !diagnostic) continue;
          const items = detailItems(audit.details).map(itemOf).filter(Boolean);
          audits.push({
            category: key,
            id: ref.id,
            title: capped(audit.title, LIMITS.title),
            displayValue: capped(audit.displayValue, LIMITS.displayValue),
            items: items.slice(0, KEPT_ITEMS_PER_AUDIT),
            more: Math.max(0, items.length - KEPT_ITEMS_PER_AUDIT),
          });
        }
      }
      return { path: pagePath(run.url), audits };
    });
}

/** Writes issues.json next to the manifest. */
export function writeIssues(reportsDir) {
  const issues = extractIssues(reportsDir);
  writeFileSync(join(reportsDir, 'issues.json'), JSON.stringify(issues));
  return issues;
}

// Plain text: no HTML, links (markdown or auto-linked), mentions, issue/PR/commit
// references or table breaks. `&` first, so entities like &#64; can't bypass the rest
function text(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // markdown links in Lighthouse descriptions: keep the text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .replace(/&/g, '&amp;')
    .replace(/`/g, "'")
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\[\]|*_]/g, '\\$&')
    .replace(/@(?=\w)/g, '@\u200b')
    .replace(/\b(https?):\/\//gi, '$1:/\u200b/')
    .replace(/\bwww\./gi, 'www\u200b.')
    .replace(/#(?=\d+\b)/g, '#\u200b')
    .replace(/\bGH-(?=\d)/gi, 'GH\u200b-')
    .replace(/\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)([0-9a-f]{4})([0-9a-f]{3,36})\b/gi, '$1\u200b$2');
}

// Inline code: content shows literally, only backticks and line breaks need removing
function code(value, max) {
  if (typeof value !== 'string' || !value.trim()) return '';
  return `\`${value.replace(/\s+/g, ' ').trim().slice(0, max).replace(/`/g, "'")}\``;
}

/**
 * Renders issues.json as a collapsible markdown section, one entry per failing audit
 * with the pages it fails on. Returns '' when there is nothing to show.
 * @param {string} issuesPath
 * @param {{ label?: string, auditIds?: string[] }} [options] - label: summary text after the count;
 *   auditIds: only show these audits
 */
export function renderIssues(issuesPath, { label = '', auditIds } = {}) {
  if (!issuesPath || !existsSync(issuesPath) || !lstatSync(issuesPath).isFile()) return '';
  if (lstatSync(issuesPath).size > MAX_ISSUES_BYTES) return '_Failing audits too large to show, see the full reports._';
  let issues;
  try {
    issues = JSON.parse(readFileSync(issuesPath, 'utf8'));
  } catch {
    return '';
  }
  if (!Array.isArray(issues)) return '';

  // Group by audit across pages: shared header or layout issues show once
  const byAudit = new Map();
  for (const page of issues.slice(0, 20)) {
    const path = typeof page?.path === 'string' && PAGE_PATH.test(page.path) ? page.path : null;
    if (!path || !Array.isArray(page.audits)) continue;
    for (const audit of page.audits) {
      if (!categoryLabels.has(audit?.category) || !AUDIT_ID.test(audit?.id ?? '')) continue;
      if (auditIds && !auditIds.includes(audit.id)) continue;
      const key = `${audit.category}:${audit.id}`;
      if (!byAudit.has(key)) {
        if (byAudit.size >= MAX_AUDITS) continue;
        byAudit.set(key, {
          category: audit.category,
          id: audit.id,
          title: audit.title,
          pages: [],
          items: new Map(),
          more: 0,
        });
      }
      const entry = byAudit.get(key);
      entry.pages.push({ path, displayValue: audit.displayValue });
      for (const item of Array.isArray(audit.items) ? audit.items.slice(0, KEPT_ITEMS_PER_AUDIT) : []) {
        const id = `${item?.target ?? ''}|${item?.note ?? ''}`;
        if (!entry.items.has(id)) entry.items.set(id, item);
      }
      // Items beyond what issues.json keeps can't be merged: count the largest overflow
      entry.more = Math.max(entry.more, Number.isInteger(audit.more) && audit.more > 0 ? audit.more : 0);
    }
  }
  if (byAudit.size === 0) return '';

  const lines = [];
  for (const { key, label: categoryLabel } of CATEGORIES) {
    const audits = [...byAudit.values()].filter((a) => a.category === key);
    if (audits.length === 0) continue;
    lines.push(`**${categoryLabel}**`, '');
    for (const audit of audits) {
      const pages = audit.pages
        .map((p) => (p.displayValue ? `${code(p.path, 60)} (${text(p.displayValue, 40)})` : code(p.path, 60)))
        .join(', ');
      lines.push(`- ${text(audit.title, 160)} · ${code(audit.id, 80)} · ${pages}`);
      const items = [...audit.items.values()];
      for (const item of items.slice(0, SHOWN_ITEMS_PER_AUDIT)) {
        const target = code(item?.target, 120);
        const note = text(item?.note, 160);
        if (target || note) lines.push(`  - ${[target, note].filter(Boolean).join(': ')}`);
      }
      const hidden = Math.max(0, items.length - SHOWN_ITEMS_PER_AUDIT) + audit.more;
      if (hidden > 0) lines.push(`  - …and ${hidden} more`);
    }
    lines.push('');
  }

  let body = lines.join('\n').trim();
  if (body.length > MAX_MARKDOWN_CHARS) {
    body = `${body.slice(0, MAX_MARKDOWN_CHARS).replace(/\n[^\n]*$/, '')}\n\n_Truncated, see the full reports._`;
  }
  const count = byAudit.size;
  return `<details>\n<summary>${count} failing audit${count > 1 ? 's' : ''}${label}</summary>\n\n${body}\n\n</details>`;
}
