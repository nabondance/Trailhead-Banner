const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const validateImageFile = (file) => {
  if (!file.type.startsWith('image/')) {
    return { valid: false, message: 'Please upload an image file' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: 'Image file is too large. Maximum size is 5MB' };
  }

  return { valid: true };
};

export const validateImageUrl = async (url) => {
  if (!url) {
    return { valid: true };
  }

  try {
    const response = await fetch(url, { method: 'HEAD', mode: 'no-cors', redirect: 'follow' });
    if (response.ok || response.type === 'opaque') {
      return { valid: true };
    }
    return { valid: false, message: 'Invalid image URL' };
  } catch (error) {
    console.error('Error validating image URL:', error);
    return { valid: false, message: 'Failed to fetch the image URL' };
  }
};
