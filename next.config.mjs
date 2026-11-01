/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // the snow globe launched as the 2026 Trailhead Rewind
      { source: '/snowglobe', destination: '/rewind', permanent: true },
    ];
  },
};

export default nextConfig;
