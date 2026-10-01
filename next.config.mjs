/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Browsers and search engines also fetch /favicon.ico directly; serve
      // the generated app icon (src/app/icon.tsx) there instead of a 404.
      { source: "/favicon.ico", destination: "/icon" },
    ];
  },
};

export default nextConfig;
