import axios from 'axios';
import { downloadImage, uploadImage } from './blobUtils';

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
  console.log(`Getting image: ${fileName}`);
  let imageDownloaded = null;
  try {
    imageDownloaded = await downloadImage(fileName, folder);
    return imageDownloaded;
  } catch (error) {
    console.log(`Image not found in blob storage, downloading from URL: ${imageUrl}`);
  }

  try {
    // Download the image from the internet
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');
    // Upload the image to the blob
    await uploadImage(imageBuffer, fileName, folder);
    return imageBuffer;
  } catch (error) {
    console.error(`Error downloading or uploading image ${imageUrl}:`, error);
    throw new Error('Failed to get image');
  }
};
