import { downloadImage, uploadImage } from './blobUtils.js';
import { safeFetchBuffer } from './urlSafety.js';
import { validateImageBuffer, MAX_PHOTO_DIMENSION, MAX_PHOTO_PIXELS } from './imageSafety.js';
import { getStampFileName } from './stampUtils.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Generate a filename for certification images based on URL parameters
 * @param {string} imageUrl - The certification image URL
 * @returns {string} Generated filename in format: id_oid_lastMod.png
 */
export const getCertificationFileName = (imageUrl) => {
  const url = new URL(imageUrl);
  const id = url.searchParams.get('id');
  const oid = url.searchParams.get('oid');
  const lastMod = url.searchParams.get('lastMod');
  return `${id}_${oid}_${lastMod}.png`;
};

// Downloaded images (Trailhead assets, custom background URLs) — generous
// limits, as photos used as backgrounds can be large
const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;

export const getImage = async (imageUrl, folder = 'images', options = {}) => {
  const { signal, timeoutMs = 10000, awaitCacheWrite = true } = options;
  let fileName = imageUrl.split('/').pop();
  if (folder === 'certifications' || folder === 'certifications_cropped') {
    fileName = getCertificationFileName(imageUrl);
  }
  if (folder === 'stamps' || folder === 'stamps_keyed') {
    fileName = getStampFileName(imageUrl);
  }
  if (folder === 'background') {
    // User-supplied URLs: key by the full URL, or two sites' "banner.jpg"
    // would share one cache entry and users would see each other's images
    fileName = crypto.createHash('sha256').update(imageUrl).digest('hex').slice(0, 32);
  }
  let imageDownloaded = null;
  let cacheHit = false;
  try {
    imageDownloaded = await downloadImage(fileName, folder, { signal });
    cacheHit = true;
    return { buffer: imageDownloaded, cacheHit };
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error(`Image not found in blob storage, downloading from URL: ${imageUrl}`);
  }

  // Processed-image folders only contain pre-processed files - never download from URL into them
  if (folder === 'certifications_cropped') {
    throw new Error('Cropped version not found in cache');
  }
  if (folder === 'stamps_keyed') {
    throw new Error('Keyed version not found in cache');
  }

  try {
    // SSRF-safe: private/reserved addresses are refused at connect time and
    // on every redirect hop (see urlSafety.js)
    const imageBuffer = await safeFetchBuffer(imageUrl, {
      timeoutMs,
      signal,
      maxBytes: MAX_DOWNLOAD_BYTES,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    // Never store something that is not an image in the public Blob cache
    const validation = validateImageBuffer(imageBuffer, {
      maxDimension: MAX_PHOTO_DIMENSION,
      maxPixels: MAX_PHOTO_PIXELS,
    });
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    // Caching is best-effort: a failed write must not discard the downloaded image
    const cacheWrite = uploadImage(imageBuffer, fileName, folder).catch((error) =>
      console.error(`Failed to cache image ${imageUrl}:`, error.message)
    );
    if (awaitCacheWrite) {
      await cacheWrite;
    }
    cacheHit = false;
    return { buffer: imageBuffer, cacheHit };
  } catch (error) {
    console.error(`Error downloading or uploading image ${imageUrl}:`, error);
    throw new Error('Failed to get image');
  }
};

export const getLocal = async (name, type, resolution = 'normal', additionalFilter) => {
  const baseDir = path.join(process.cwd(), 'src/assets/logos');
  let imageDir;

  if (type === 'Rank') {
    imageDir = path.join(baseDir, 'Rank');
  } else if (type === 'Agentblazer') {
    if (additionalFilter) {
      imageDir = path.join(baseDir, 'Agentblazer', additionalFilter);
    } else {
      imageDir = path.join(baseDir, 'Agentblazer');
    }
  } else if (type === 'Product') {
    imageDir = path.join(baseDir, 'Product');
  } else {
    throw new Error(`Invalid type: ${type}. Must be 'Rank', 'Agentblazer', or 'Product'`);
  }

  if (resolution === 'high') {
    imageDir = path.join(imageDir, 'high-res');
  }

  const imagePath = path.join(imageDir, name);

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer;
  } catch (error) {
    console.error(`Error reading local image ${imagePath}:`, error);
    throw new Error(`Failed to read local image: ${name}`);
  }
};
