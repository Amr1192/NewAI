/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Prevent pdfjs-dist from trying to require the Node 'canvas' package
      canvas: false,
    };
    return config;
  },
}

export default nextConfig
