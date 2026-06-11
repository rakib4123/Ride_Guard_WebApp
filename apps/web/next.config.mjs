/** @type {import('next').NextConfig} */
const nextConfig = {
  // React-Leaflet v4 can throw "Map container is already initialized" when
  // StrictMode double-invokes effects in dev; disabling it keeps maps stable.
  reactStrictMode: false,
  transpilePackages: ['@rideguard/shared'],
};
export default nextConfig;
