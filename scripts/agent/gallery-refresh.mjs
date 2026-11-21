// Regenerate the gallery example banners from src/data/examples.json.
// Usage: node scripts/agent/gallery-refresh.mjs [id ...]   (no ids = all examples)
// Requires: server running on localhost:3000 (bash scripts/agent/dev-start.sh)

import { readFileSync, writeFileSync } from 'fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const BASE_URL = process.env.THB_URL || 'http://localhost:3000';
const WEBP_QUALITY = 85;
const repoRoot = new URL('../../', import.meta.url);
const { defaultOptions, examples } = JSON.parse(readFileSync(new URL('src/data/examples.json', repoRoot)));

const requestedIds = process.argv.slice(2);
const unknownIds = requestedIds.filter((id) => !examples.some((e) => e.id === id));
if (unknownIds.length) {
  console.error(`Unknown example id(s): ${unknownIds.join(', ')}`);
  console.error(`Known ids: ${examples.map((e) => e.id).join(', ')}`);
  process.exit(1);
}
const selected = requestedIds.length ? examples.filter((e) => requestedIds.includes(e.id)) : examples;

async function toWebp(dataUrl) {
  const image = await loadImage(Buffer.from(dataUrl.replace(/^data:image\/[^;]+;base64,/, ''), 'base64'));
  const canvas = createCanvas(image.width, image.height);
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvas.encode('webp', WEBP_QUALITY);
}

let failures = 0;
for (const example of selected) {
  process.stdout.write(`${example.id} (${example.username})... `);
  try {
    const res = await fetch(`${BASE_URL}/api/banner/standard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...defaultOptions, ...example.options, username: example.username }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await res.json();
    if (!res.ok || !data.imageUrl?.startsWith('data:image/')) {
      throw new Error(data.error || `HTTP ${res.status}, no image`);
    }
    const webp = await toWebp(data.imageUrl);
    writeFileSync(new URL(`public/assets/examples/${example.id}.webp`, repoRoot), webp);
    console.log(`OK (${Math.round(webp.length / 1024)} KB)`);
    for (const warning of data.warnings || []) console.log(`  warning: ${warning}`);
  } catch (err) {
    failures++;
    console.log(`FAILED: ${err.message}`);
  }
}

console.log(`Gallery refresh: ${selected.length - failures}/${selected.length} OK`);
if (failures) process.exitCode = 1;
