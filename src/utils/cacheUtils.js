import axios from 'axios';
import { downloadImage, uploadImage } from './blobUtils';
import fs from 'fs';
import path from 'path';

export const getImage = async (imageUrl, folder = 'images') => {
  let fileName = imageUrl.split('/').pop();
  if (folder === 'certifications') {
    const url = new URL(imageUrl);
    // Extract the query parameters
    const id = url.searchParams.get('id');
    const oid = url.searchParams.get('oid');
    const lastMod = url.searchParams.get('lastMod');

    // Combine them to form a pseudo filename
    fileName = `${id}_${oid}_${lastMod}.png`;
  }
  let imageDownloaded = null;
  try {
    imageDownloaded = await downloadImage(fileName, folder);
    return imageDownloaded;
  } catch (error) {
    console.log(`Image not found in blob storage, downloading from URL: ${imageUrl}`);
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
    return imageBuffer;
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
