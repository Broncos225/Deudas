/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const nextConfig = {
  // Aquí puedes añadir otras configuraciones de Next.js si las necesitas
};

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

export default pwaConfig(nextConfig);
