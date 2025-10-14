import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Evita fallos de build en Vercel por falta de ESLint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
