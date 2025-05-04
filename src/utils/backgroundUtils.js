import { validateImageFile } from './imageValidation';

export const handleFileChange = async (file, setBackgroundImageUrlError, setOptions, setUploadedFile) => {
  if (file) {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setBackgroundImageUrlError(validation.message);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setOptions((prevOptions) => ({
        ...prevOptions,
        backgroundImageUrl: reader.result,
        customBackgroundImageUrl: '', // Clear custom URL when uploading
      }));
      setUploadedFile(file);
      setBackgroundImageUrlError('');
    };
    reader.readAsDataURL(file);
  }
};

export const handleBackgroundKindChange = (kind, setOptions) => {
  setOptions((prevOptions) => ({
    ...prevOptions,
    backgroundKind: kind,
  }));
};

export const handleBackgroundColorChange = (color, setOptions) => {
  setOptions((prevOptions) => ({
    ...prevOptions,
    backgroundColor: color,
  }));
};

export const handleCustomUrlChange = (url, setOptions, setBackgroundImageUrlError) => {
  setOptions((prevOptions) => ({
    ...prevOptions,
    customBackgroundImageUrl: url,
  }));
  if (!url) {
    setBackgroundImageUrlError('');
  }
};

export const handlePredefinedImageChange = (src, setOptions) => {
  const baseUrl = window.location.origin;
  const newUrl = `${baseUrl}${src}`;
  setOptions((prevOptions) => ({
    ...prevOptions,
    backgroundLibraryUrl: newUrl,
  }));
};

export const getBackgroundPreviewSrc = (options) => {
  if (options.backgroundKind === 'library') {
    return options.backgroundLibraryUrl;
  } else if (options.backgroundKind === 'customUrl') {
    return options.customBackgroundImageUrl;
  } else if (options.backgroundKind === 'upload') {
    return options.backgroundImageUrl;
  }
  return null;
};
