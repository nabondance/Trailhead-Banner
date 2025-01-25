import { put, head } from '@vercel/blob';

const STORE_ID = process.env.BLOB_READ_WRITE_TOKEN?.match(/^vercel_blob_rw_([a-z0-9]+)_[a-z0-9]+$/i)?.[1].toLowerCase();
export const BLOB_BASE_URL = `https://${STORE_ID}.public.blob.vercel-storage.com`;

export const uploadImage = async (fileBuffer, fileName, folder = 'images') => {
  try {
    const filePath = `${folder}/${fileName}`;
    const blob = await put(filePath, fileBuffer, {
      access: 'public',
      addRandomSuffix: false,
    });
    return blob.url;
  } catch (error) {
    console.error('Error uploading file to Vercel Blob:', error);
    throw new Error('Failed to upload file');
  }
};

export const downloadImage = async (fileName, folder = 'images') => {
  try {
    const filePath = `${BLOB_BASE_URL}/${folder}/${fileName}`;
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error('Failed to download image:', response.statusText);
    }
    const imageBuffer = await response?.arrayBuffer();
    return imageBuffer;
  } catch (error) {
    console.error(`Error downloading ${fileName} from Vercel Blob:`, error);
    throw new Error('Failed to download file');
  }
};
