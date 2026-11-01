/** @type {import('next').NextConfig} */
const nextConfig = {
  // dev server only: also accept requests through Tailscale (phone testing
  // over `tailscale serve`); Next blocks other origins in development
  allowedDevOrigins: ['*.ts.net'],
  async redirects() {
    return [
      // the snow globe launched as the 2026 Trailhead Rewind
      { source: '/snowglobe', destination: '/rewind', permanent: true },
    ];
  },
};

export default nextConfig;
