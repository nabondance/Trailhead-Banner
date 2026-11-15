#!/usr/bin/env node
// Checks that the agent setup (.claude/, .agents/, .codex/, AGENTS.md) is
// internally consistent: every skill is reachable by Claude and Codex, every
// agent, script and file path it mentions exists. Prints problems only.
// Usage: node scripts/agent/harness-audit.mjs   (exit 1 when errors are found)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`ERROR ${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`WARN  ${file}: ${msg}`);

const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const list = (dir) => (exists(dir) ? fs.readdirSync(path.join(root, dir)) : []);

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].replace(/^['"]|['"]$/g, '');
  }
  return fields;
}

// --- Skills -----------------------------------------------------------------

const skills = new Map(); // name -> SKILL.md path (repo-relative)

for (const entry of list('.claude/skills')) {
  const rel = `.claude/skills/${entry}`;
  const abs = path.join(root, rel);
  let stat;
  try {
    stat = fs.statSync(abs); // follows symlinks
  } catch {
    err(rel, 'broken symlink');
    continue;
  }
  if (!stat.isDirectory()) {
    err(rel, 'not a directory (a symlink checked out as a file?)');
    continue;
  }
  if (!exists(`${rel}/SKILL.md`)) {
    err(rel, 'no SKILL.md');
    continue;
  }
  skills.set(entry, `${rel}/SKILL.md`);
}

for (const entry of list('.agents/skills')) {
  const rel = `.agents/skills/${entry}`;
  if (!exists(`${rel}/SKILL.md`)) {
    err(rel, 'no SKILL.md');
    continue;
  }
  const link = path.join(root, '.claude/skills', entry);
  let target = null;
  try {
    target = fs.realpathSync(link);
  } catch {}
  if (target !== fs.realpathSync(path.join(root, rel))) {
    err(rel, `Claude cannot see it: .claude/skills/${entry} must be a symlink to ../../${rel}`);
  }
}

const agentsMd = exists('AGENTS.md') ? read('AGENTS.md') : '';

for (const [name, file] of skills) {
  const fm = frontmatter(read(file));
  if (!fm) {
    err(file, 'no frontmatter');
    continue;
  }
  if (fm.name !== name) err(file, `frontmatter name "${fm.name}" does not match folder "${name}"`);
  if (!fm.description) err(file, 'no description');
  if (!new RegExp('`' + name + '[` \\[]').test(agentsMd)) warn(file, `skill "${name}" is not listed in AGENTS.md`);
}

// --- Agents -----------------------------------------------------------------

const agents = new Set();
for (const entry of list('.claude/agents').filter((f) => f.endsWith('.md'))) {
  const rel = `.claude/agents/${entry}`;
  const fm = frontmatter(read(rel));
  const name = entry.replace(/\.md$/, '');
  agents.add(name);
  if (!fm) {
    err(rel, 'no frontmatter');
    continue;
  }
  if (fm.name !== name) err(rel, `frontmatter name "${fm.name}" does not match file name`);
  if (!fm.description) err(rel, 'no description');
}

for (const entry of list('.codex/agents').filter((f) => f.endsWith('.toml'))) {
  const rel = `.codex/agents/${entry}`;
  const text = read(rel);
  const name = text.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
  if (!name) err(rel, 'no name');
  if (!/^developer_instructions\s*=/m.test(text)) err(rel, 'no developer_instructions (Codex rejects the file)');
  if (name && !agents.has(name)) warn(rel, `no matching .claude/agents/${name}.md`);
}

// --- References inside harness files ----------------------------------------

const harnessFiles = [
  'AGENTS.md',
  'CLAUDE.md',
  ...[...skills.values()],
  ...[...agents].map((a) => `.claude/agents/${a}.md`),
  ...list('.codex/agents').map((f) => `.codex/agents/${f}`),
].filter(exists);

const pathRoots = /^(src|scripts|docs|public|\.claude|\.agents|\.codex|\.github)\//;
// Paths that are created on first use, not committed
const createdLater = new Set(['docs/egm/']);
const gitIgnored = (p) => spawnSync('git', ['check-ignore', '-q', p], { cwd: root }).status === 0;

for (const file of harnessFiles) {
  const text = read(file);

  // Repo paths in backticks, e.g. `src/utils/drawUtils.js`
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    const p = m[1].replace(/[),.:;]+$/, '');
    if (!pathRoots.test(p) || /[*<>$]/.test(p) || createdLater.has(p)) continue;
    // "Create `src/...`" describes a file to add, not one that should exist
    if (/\b(create|add)\s*$/i.test(text.slice(Math.max(0, m.index - 12), m.index))) continue;
    if (!exists(p) && !gitIgnored(p)) err(file, `mentions \`${p}\`, which does not exist`);
  }

  // Relative markdown links
  for (const [, href] of text.matchAll(/\]\((\.{1,2}\/[^)#\s]+)\)/g)) {
    if (!fs.existsSync(path.resolve(path.dirname(path.join(root, file)), href))) {
      err(file, `link ${href} does not resolve`);
    }
  }

  // Named agents, e.g. "the `code-goldfish` agent"
  for (const [, name] of text.matchAll(/`([a-z0-9-]+)` agent/g)) {
    if (!agents.has(name)) err(file, `refers to agent \`${name}\`, which is not in .claude/agents/`);
  }
}

// --- Settings ---------------------------------------------------------------

if (exists('.claude/settings.json')) {
  let settings;
  try {
    settings = JSON.parse(read('.claude/settings.json'));
  } catch (e) {
    err('.claude/settings.json', `invalid JSON: ${e.message}`);
  }
  if (settings) {
    for (const groups of Object.values(settings.hooks ?? {})) {
      for (const group of groups) {
        for (const hook of group.hooks ?? []) {
          for (const [script] of (hook.command ?? '').matchAll(/scripts\/[\w./-]+/g)) {
            if (!exists(script)) err('.claude/settings.json', `hook script ${script} does not exist`);
          }
        }
      }
    }
    for (const plugin of Object.keys(settings.enabledPlugins ?? {})) {
      const market = plugin.split('@')[1];
      if (market && !settings.extraKnownMarketplaces?.[market]) {
        warn('.claude/settings.json', `plugin ${plugin}: marketplace "${market}" not in extraKnownMarketplaces`);
      }
    }
    const style = settings.outputStyle;
    if (style && !['default', 'Explanatory', 'Learning'].includes(style)) {
      const found = list('.claude/output-styles').some(
        (f) => frontmatter(read(`.claude/output-styles/${f}`))?.name === style
      );
      if (!found) err('.claude/settings.json', `outputStyle "${style}" has no file in .claude/output-styles/`);
    }
  }
}

// --- Plugin skills the wrappers load by path (local only) --------------------

const egmCache = path.join(os.homedir(), '.claude/plugins/cache/egm/egm');
if (fs.existsSync(egmCache)) {
  const newest = fs
    .readdirSync(egmCache)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .pop();
  for (const [name, file] of skills) {
    for (const [, egmSkill] of read(file).matchAll(/skills\/(egm-[a-z-]+)\/SKILL\.md/g)) {
      if (!fs.existsSync(path.join(egmCache, newest, 'skills', egmSkill, 'SKILL.md'))) {
        err(file, `EGM ${newest} has no skills/${egmSkill}/SKILL.md (plugin layout changed?)`);
      }
    }
  }
}

// --- Report -----------------------------------------------------------------

for (const line of [...errors, ...warnings]) console.log(line);
console.log(
  `Harness audit: ${errors.length} error(s), ${warnings.length} warning(s) — ${skills.size} skills, ${agents.size} agents`
);
process.exit(errors.length ? 1 : 0);
