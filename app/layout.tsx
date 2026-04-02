import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import ClientAuthSync from '@/components/auth/ClientAuthSync'
import "./globals.css";

// Server-side bypass flag — evaluated once at startup, never shipped to the
// client bundle.  When true, ClerkProvider is omitted entirely so that no
// Clerk network requests are made during local development.
const DEV_BYPASS =
  process.env.NODE_ENV !== 'production' &&
  process.env.DEV_AUTH_BYPASS === 'true'

const ENABLE_SW = process.env.NODE_ENV === 'production'

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "TutorKanvas — AI Maths Tutor for Kids",
  description: "An open-source, privacy-first AI maths canvas for children. Bring your own API key.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TutorKanvas",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#9333ea",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} h-full antialiased`}
    >
      <head>
        {/* PWA: register service worker */}
        {!ENABLE_SW && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    registrations.forEach(function(registration) {
                      registration.unregister().catch(function() {});
                    });
                  }).catch(function() {});
                }
                if ('caches' in window) {
                  caches.keys().then(function(keys) {
                    keys
                      .filter(function(key) { return key.indexOf('tutorkanvas-') === 0; })
                      .forEach(function(key) { caches.delete(key).catch(function() {}); });
                  }).catch(function() {});
                }
              `,
            }}
          />
        )}
        {ENABLE_SW && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function() {});
                  });
                }
              `,
            }}
          />
        )}
      </head>
      <body className="min-h-full flex flex-col font-nunito bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
        {DEV_BYPASS ? (
          <>
            <ClientAuthSync />
            {children}
          </>
        ) : (
          <ClerkProvider>
            <ClientAuthSync />
            {children}
          </ClerkProvider>
        )}
      </body>
    </html>
  );
}
