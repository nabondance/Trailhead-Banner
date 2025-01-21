export const updateBannerCounter = async (username, bannerHash, protocol, host) => {
    const baseUrl =
        process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}` // Use Vercel's domain in production
        : `${protocol}://${host}`; // Fallback for local development

  const addBannerUrl = `${baseUrl}/api/add-banner`;
  const response = await fetch(addBannerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      th_username: username,
      thb_banner_hash: bannerHash,
      source_env: process.env.VERCEL_ENV ? process.env.VERCEL_ENV : 'development',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to save banner hash');
  }
};