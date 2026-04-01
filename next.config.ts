import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Security headers ──────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
          // CSP: allow connections to all LLM provider APIs + Deepgram
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // tldraw needs eval
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' blob: data:",
              "media-src 'self' blob:",
              "connect-src 'self' https://openrouter.ai https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.deepgram.com http://localhost:11434",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // ── Standalone output (for Docker / self-hosted) ──────────────────────
  // output: "standalone",

  // ── Image optimisation ────────────────────────────────────────────────
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
