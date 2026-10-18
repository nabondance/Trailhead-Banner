import libraryBackgrounds from '../data/banners.json';

// Vertical crop focus per library background file (0 = top, 0.5 = center, 1 = bottom)
const FOCUS_Y_BY_FILENAME = new Map(libraryBackgrounds.map((b) => [b.src.split('/').pop(), b.focusY]));

/**
 * Get the vertical crop focus of a library background, used by the 'cover' fit.
 * @param {string} urlOrFilename - Library background URL, path or filename
 * @returns {number} focusY between 0 and 1 (0.5 when not set)
 */
export function getLibraryFocusY(urlOrFilename) {
  const filename = urlOrFilename?.split('/').pop();
  return FOCUS_Y_BY_FILENAME.get(filename) ?? 0.5;
}
