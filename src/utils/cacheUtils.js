import axios from 'axios';
import { downloadImage, uploadImage } from './blobUtils';
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

export const getImage = async (imageUrl, folder = 'images') => {
  let fileName = imageUrl.split('/').pop();
  if (folder === 'certifications' || folder === 'certifications_cropped') {
    fileName = getCertificationFileName(imageUrl);
  }
  let imageDownloaded = null;
  let cacheHit = false;
  try {
    imageDownloaded = await downloadImage(fileName, folder);
    cacheHit = true;
    return { buffer: imageDownloaded, cacheHit };
  } catch (error) {
    console.error(`Image not found in blob storage, downloading from URL: ${imageUrl}`);
  }

  // For cropped certifications folder, don't download from URL - it should only contain pre-cropped images
  if (folder === 'certifications_cropped') {
    throw new Error('Cropped version not found in cache');
  }

  // Validate URL protocol (only allow http/https)
  try {
    const parsedUrl = new URL(imageUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Invalid protocol: ${parsedUrl.protocol}`);
    }

    // Check for localhost and private IP ranges to prevent SSRF
    const hostname = parsedUrl.hostname.toLowerCase();
    const privateRanges = [
      'localhost',
      '127.',
      '10.',
      '172.16.',
      '172.17.',
      '172.18.',
      '172.19.',
      '172.20.',
      '172.21.',
      '172.22.',
      '172.23.',
      '172.24.',
      '172.25.',
      '172.26.',
      '172.27.',
      '172.28.',
      '172.29.',
      '172.30.',
      '172.31.',
      '192.168.',
      '169.254.', // Link-local
      '::1', // IPv6 localhost (URL.hostname returns without brackets)
      'fe80:', // IPv6 link-local
    ];

    if (privateRanges.some((range) => hostname.startsWith(range))) {
      throw new Error(`Private/internal address blocked: ${hostname}`);
    }
  } catch (error) {
    console.error(`URL validation failed for ${imageUrl}:`, error);
    throw new Error(`Invalid or blocked URL: ${error.message}`);
  }

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    const imageBuffer = Buffer.from(response.data, 'binary');
    // Upload the image to the blob
    await uploadImage(imageBuffer, fileName, folder);
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
