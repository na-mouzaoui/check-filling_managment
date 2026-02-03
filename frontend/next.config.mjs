/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'export',  // <-- IMPORTANT pour export statique
  productionBrowserSourceMaps: false,
  turbopack: {}, // Silences Turbopack warning
}

export default nextConfig
