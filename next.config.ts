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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.clerk.accounts.dev https://*.accounts.dev https://*.clerk.dev https://*.clerk.com", // tldraw needs eval
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com https://cdn.tldraw.com",
              "img-src 'self' blob: data: https://img.clerk.com https://cdn.tldraw.com",
              "media-src 'self' blob:",
              "connect-src 'self' https://openrouter.ai https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.deepgram.com http://localhost:11434 https://cdn.tldraw.com https://*.clerk.accounts.dev https://*.accounts.dev https://*.clerk.dev https://*.clerk.com",
              "frame-src 'self' https://*.clerk.accounts.dev https://*.accounts.dev https://*.clerk.dev https://*.clerk.com",
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
