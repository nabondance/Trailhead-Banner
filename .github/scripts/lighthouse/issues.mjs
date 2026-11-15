import { existsSync, lstatSync, readFileSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { CATEGORIES, pagePath } from './scores.mjs';

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
const MAX_ITEMS_PER_AUDIT = 3;
const MAX_ISSUES_BYTES = 256 * 1024;
const MAX_AUDITS = 60;
const MAX_MARKDOWN_CHARS = 30000;
const AUDIT_ID = /^[a-z0-9-]{1,80}$/;

const categoryLabels = new Map(CATEGORIES.map((c) => [c.key, c.label]));

// First line of an axe explanation that says what is wrong, e.g. "Element has insufficient color contrast of 2.76 (…)"
function explanationOf(node) {
  if (typeof node?.explanation !== 'string') return undefined;
  return node.explanation
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !/^Fix (any|all) of the following:?$/i.test(line))
    ?.replace(/\.?\s*Expected contrast ratio.*$/i, '');
}

function itemOf(item) {
  const target = [item?.node?.selector, item?.url, item?.source?.url, item?.sourceLocation?.url].find(
    (v) => typeof v === 'string' && v
  );
  const note = explanationOf(item?.node) ?? [item?.message, item?.description].find((v) => typeof v === 'string');
  return target || note ? { target, note } : null;
}

/**
 * Builds the failing-audit summary from the reports written by `lhci upload --target=filesystem`.
 * @param {string} reportsDir - .lighthouseci/reports
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
        for (const ref of lhr.categories?.[key]?.auditRefs ?? []) {
          const audit = lhr.audits?.[ref.id];
          if (!(ref.weight > 0) || typeof audit?.score !== 'number' || audit.score >= PASS_SCORE) continue;
          const items = (audit.details?.items ?? []).map(itemOf).filter(Boolean);
          audits.push({
            category: key,
            id: ref.id,
            title: audit.title,
            displayValue: audit.displayValue,
            items: items.slice(0, MAX_ITEMS_PER_AUDIT),
            more: Math.max(0, items.length - MAX_ITEMS_PER_AUDIT),
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

// Plain text: no links (markdown or auto-linked), HTML, mentions or table breaks
function text(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .replace(/`/g, "'")
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\[\]|*_]/g, '\\$&')
    .replace(/@(?=\w)/g, '@\u200b')
    .replace(/\b(https?):\/\//gi, '$1:/\u200b/')
    .replace(/\bwww\./gi, 'www\u200b.');
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
 * @param {string} [label] - summary line text, after the count
 */
export function renderIssues(issuesPath, label = '') {
  if (!issuesPath || !existsSync(issuesPath) || !lstatSync(issuesPath).isFile()) return '';
  if (lstatSync(issuesPath).size > MAX_ISSUES_BYTES) return '';
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
    const path = typeof page?.path === 'string' && /^\/[a-z0-9\-/]*$/i.test(page.path) ? page.path : null;
    if (!path || !Array.isArray(page.audits)) continue;
    for (const audit of page.audits) {
      if (!categoryLabels.has(audit?.category) || !AUDIT_ID.test(audit?.id ?? '')) continue;
      const key = `${audit.category}:${audit.id}`;
      if (!byAudit.has(key)) {
        if (byAudit.size >= MAX_AUDITS) continue;
        byAudit.set(key, { ...audit, pages: [], items: new Map(), more: 0 });
      }
      const entry = byAudit.get(key);
      entry.pages.push({ path, displayValue: audit.displayValue });
      for (const item of Array.isArray(audit.items) ? audit.items : []) {
        const id = `${item?.target ?? ''}|${item?.note ?? ''}`;
        if (!entry.items.has(id)) entry.items.set(id, item);
      }
      entry.more = Math.max(entry.more, Number.isInteger(audit.more) && audit.more > 0 ? audit.more : 0);
    }
  }
  if (byAudit.size === 0) return '';

  const lines = [];
  for (const { key, label } of CATEGORIES) {
    const audits = [...byAudit.values()].filter((a) => a.category === key);
    if (audits.length === 0) continue;
    lines.push(`**${label}**`, '');
    for (const audit of audits) {
      const pages = audit.pages
        .map((p) => (p.displayValue ? `${code(p.path, 60)} (${text(p.displayValue, 40)})` : code(p.path, 60)))
        .join(', ');
      lines.push(`- ${text(audit.title, 160)} · ${code(audit.id, 80)} · ${pages}`);
      const items = [...audit.items.values()];
      for (const item of items.slice(0, MAX_ITEMS_PER_AUDIT)) {
        const target = code(item?.target, 120);
        const note = text(item?.note, 160);
        lines.push(`  - ${[target, note].filter(Boolean).join(': ')}`);
      }
      const hidden = Math.max(0, items.length - MAX_ITEMS_PER_AUDIT) + audit.more;
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
