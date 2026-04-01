// ─────────────────────────────────────────────
// TutorKanvas — Vitest global test setup
// ─────────────────────────────────────────────

import '@testing-library/jest-dom'

// Mock IndexedDB (not available in jsdom by default)
import 'fake-indexeddb/auto'

// Suppress noisy console.error/warn in tests unless DEBUG_TESTS is set
if (!process.env.DEBUG_TESTS) {
  globalThis.console.error = () => {}
  globalThis.console.warn  = () => {}
}
