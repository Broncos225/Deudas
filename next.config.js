/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This is a new security feature in Next.js 15.
  // We need to allow requests from the preview server to the dev server.
  // https://nextjs.org/docs/app/api-reference/next-config-js/allowedDevOrigins
  allowedDevOrigins: ["https://*.cloudworkstations.dev"],
};

module.exports = nextConfig;
