import type { NextConfig } from "next";

const scriptSrc = [
  "script-src 'self' 'unsafe-inline'",
  process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : '',
  "https://*.clerk.accounts.dev https://*.accounts.dev https://*.clerk.dev https://*.clerk.com",
].filter(Boolean).join(' ')

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
              scriptSrc,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' blob: data: https://img.clerk.com",
              "media-src 'self' blob:",
              "connect-src 'self' https://openrouter.ai https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.deepgram.com http://localhost:11434 https://*.clerk.accounts.dev https://*.accounts.dev https://*.clerk.dev https://*.clerk.com",
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
