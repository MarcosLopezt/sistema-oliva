import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raíz del workspace (hay otro lockfile en el HOME del usuario).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
