/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  reactStrictMode: true,
  // This is a new security feature in Next.js 15.
  // We need to allow requests from the preview server to the dev server.
  // https://nextjs.org/docs/app/api-reference/next-config-js/allowedDevOrigins
  experimental: {
    allowedDevOrigins: ["https://*.cloudworkstations.dev"],
  },
};

module.exports = withPWA(nextConfig);
