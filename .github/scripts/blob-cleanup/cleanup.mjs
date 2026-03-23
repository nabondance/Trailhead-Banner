import { list, del } from '@vercel/blob';

const retentionDays = parseInt(process.env.RETENTION_DAYS, 10);
if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
  console.error(`ERROR: RETENTION_DAYS is missing or invalid: "${process.env.RETENTION_DAYS}"`);
  process.exit(1);
}

const prefix = process.env.BLOB_PREFIX;
if (!prefix) {
  console.error('ERROR: BLOB_PREFIX is not set');
  process.exit(1);
}

const dryRun = process.env.DRY_RUN === 'true';
const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

console.log(`Retention: ${retentionDays} days (cutoff: ${cutoff.toISOString()})`);
console.log(`Prefix: ${prefix}`);
if (dryRun) console.log('DRY RUN — no blobs will be deleted');

// Paginate through all blobs under the prefix
const toDelete = [];
let cursor;

try {
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      const age = Math.floor((Date.now() - new Date(blob.uploadedAt)) / (1000 * 60 * 60 * 24));
      if (new Date(blob.uploadedAt) < cutoff) {
        console.log(`  EXPIRED (${age}d): ${blob.pathname}`);
        toDelete.push(blob.url);
      } else {
        console.log(`  KEEP    (${age}d): ${blob.pathname}`);
      }
    }
    cursor = page.cursor;
  } while (cursor);
} catch (err) {
  console.error(`ERROR: Failed to list blobs: ${err.message}`);
  process.exit(1);
}

console.log(`\nFound ${toDelete.length} blob(s) to delete.`);

if (toDelete.length === 0 || dryRun) {
  console.log(dryRun ? 'Dry run complete.' : 'Nothing to delete.');
  process.exit(0);
}

try {
  await del(toDelete);
  console.log(`Deleted ${toDelete.length} blob(s).`);
} catch (err) {
  console.error(`ERROR: Failed to delete blobs: ${err.message}`);
  console.error(`Attempted to delete: ${toDelete.join(', ')}`);
  process.exit(1);
}
