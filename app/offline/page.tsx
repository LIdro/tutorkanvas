'use client'
// ─────────────────────────────────────────────
// TutorKanvas — Offline fallback page
// Shown by the service worker when the network
// is unavailable and the page isn't cached.
// ─────────────────────────────────────────────

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center bg-white dark:bg-gray-950">
      <div className="text-7xl">📵</div>
      <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">
        You&apos;re offline
      </h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm">
        TutorKanvas needs an internet connection to chat with the AI tutor.
        Your canvas and sessions are saved locally — reconnect to continue.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="btn-primary"
      >
        Try again
      </button>
    </main>
  )
}
