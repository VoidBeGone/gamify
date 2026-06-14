import type { NextConfig } from "next";

// The LevelUp API runs on port 4000 by default (apps/api/.env -> PORT=4000).
// Override with API_PROXY_TARGET if you run it elsewhere.
const API_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_TARGET}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
