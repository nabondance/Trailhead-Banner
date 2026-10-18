/**
 * Canvas size and background fit per banner type.
 * Shared by the server renderers and the client forms/previews (no server-only imports here).
 * fit: 'stretch' draws the background to the full canvas; 'cover' keeps its aspect ratio and crops the overflow.
 */
export const BANNER_SIZES = {
  standard: { width: 1584, height: 396, fit: 'stretch' }, // LinkedIn profile banner
  company: { width: 1128, height: 191, fit: 'cover' }, // LinkedIn company page header
};
