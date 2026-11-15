/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/examples', destination: '/gallery#banners', permanent: true },
      { source: '/background-library', destination: '/gallery#backgrounds', permanent: true },
    ];
  },
};

export default nextConfig;
