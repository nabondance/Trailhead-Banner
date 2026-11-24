import { getImage } from '../../../utils/cacheUtils';

const ALLOWED_FOLDERS = new Set(['certifications', 'stamps', 'images']);

// Hosts that serve Trailhead achievement artwork (certs, stamps, rank logos)
const ALLOWED_HOST_SUFFIXES = [
  'salesforce.com',
  'trailhead.com',
  'force.com',
  'sfdcstatic.com',
  'documentforce.com',
  'cloudinary.com',
];

function isAllowedHost(hostname) {
  return ALLOWED_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

function detectContentType(buffer) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  return 'image/png';
}

/**
 * Same-origin proxy for achievement artwork so WebGL textures never taint the
 * canvas (a tainted canvas breaks toDataURL/toBlob and captureStream).
 * Reuses the Vercel Blob cache via cacheUtils.getImage.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, folder = 'images' } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url query parameter is required' });
  }

  if (!ALLOWED_FOLDERS.has(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (parsedUrl.protocol !== 'https:' || !isAllowedHost(parsedUrl.hostname.toLowerCase())) {
    return res.status(400).json({ error: 'URL host not allowed' });
  }

  try {
    const { buffer } = await getImage(url, folder);
    // blob-cache hits return an ArrayBuffer, fresh downloads a Node Buffer
    const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    res.setHeader('Content-Type', detectContentType(body));
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return res.status(200).send(body);
  } catch (error) {
    console.error(`[Snowglobe] Image proxy failed for ${url}:`, error.message);
    return res.status(502).json({ error: 'Failed to fetch image' });
  }
}
