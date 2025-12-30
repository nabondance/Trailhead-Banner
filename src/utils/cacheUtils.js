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

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
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

export const getLocal = async (name, type, resolution = 'normal') => {
  const baseDir = path.join(process.cwd(), 'src/assets/logos');
  let imageDir;

  if (type === 'Rank') {
    imageDir = path.join(baseDir, 'Rank');
  } else if (type === 'Agentblazer') {
    imageDir = path.join(baseDir, 'Agentblazer');
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
