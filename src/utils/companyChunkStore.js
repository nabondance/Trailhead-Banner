import crypto from 'crypto';
import zlib from 'zlib';
import RedisCacheUtils from './redisCacheUtils.js';

/**
 * Server-side store for company banner fetch chunks.
 *
 * /api/banner/company-fetch saves each chunk's Trailhead data here and returns
 * an opaque token; /api/banner/company loads the data back by token. The
 * client never sends user data to the render endpoint, so it cannot inject
 * image URLs or fake counts, and the render request stays a few KB whatever
 * the team size (Vercel caps request bodies at 4.5 MB).
 *
 * Chunks are gzipped (~10× smaller) and expire after CHUNK_TTL_SECONDS.
 * Without Redis (local dev) an in-memory map is used instead.
 */

const CHUNK_TTL_SECONDS = 1800;
const KEY_PREFIX = 'company-chunk:';
const TOKEN_PATTERN = /^[a-f0-9]{32}$/;
const memoryStore = new Map();

function encode(chunk) {
  return zlib.gzipSync(JSON.stringify(chunk)).toString('base64');
}

function decode(payload) {
  return JSON.parse(zlib.gunzipSync(Buffer.from(payload, 'base64')).toString('utf8'));
}

/**
 * @param {string} token
 * @returns {boolean} true when the token has the expected format
 */
export function isValidChunkToken(token) {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

/**
 * Store a fetched chunk and return its token.
 * @param {{resolved: Array, failed: Array}} chunk
 * @returns {Promise<string>} token
 */
export async function saveCompanyChunk(chunk) {
  const token = crypto.randomBytes(16).toString('hex');
  const payload = encode(chunk);
  const client = RedisCacheUtils.getClient();

  if (client) {
    await client.set(`${KEY_PREFIX}${token}`, payload, { ex: CHUNK_TTL_SECONDS });
  } else {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (entry.expiresAt < now) memoryStore.delete(key);
    }
    memoryStore.set(token, { payload, expiresAt: now + CHUNK_TTL_SECONDS * 1000 });
  }
  return token;
}

/**
 * Load chunks by token.
 * @param {string[]} tokens - Valid, unique tokens
 * @returns {Promise<{chunks: Array, missing: number}>} missing = tokens expired or unknown
 */
export async function loadCompanyChunks(tokens) {
  if (tokens.length === 0) return { chunks: [], missing: 0 };
  const client = RedisCacheUtils.getClient();

  let payloads;
  if (client) {
    payloads = await client.mget(...tokens.map((token) => `${KEY_PREFIX}${token}`));
  } else {
    const now = Date.now();
    payloads = tokens.map((token) => {
      const entry = memoryStore.get(token);
      return entry && entry.expiresAt >= now ? entry.payload : null;
    });
  }

  const chunks = [];
  let missing = 0;
  for (const payload of payloads) {
    if (typeof payload !== 'string') {
      missing++;
      continue;
    }
    chunks.push(decode(payload));
  }
  return { chunks, missing };
}
