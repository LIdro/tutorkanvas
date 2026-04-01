# Changelog

All notable changes to TutorKanvas will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.1.0] — Unreleased

### Added
- Initial project scaffold with Next.js (App Router), TypeScript, Tailwind CSS v4
- Infinite canvas powered by tldraw with auto-save (debounced, IndexedDB)
- Multi-provider LLM abstraction: OpenRouter, OpenAI, Anthropic, Google AI, Ollama
- BYOK (Bring Your Own Key) — all keys stored in browser localStorage, never sent to server
- Parent PIN gate (SHA-256 via Web Crypto, stored as hash)
- Setup Wizard — 6-step first-run experience
- Settings Panel — PIN-gated slide-out drawer with provider, voice, profile, and data management
- Child learner profiles (up to 5) with adaptive difficulty by age
- Session management — create, save, auto-name, enforce 50-session limit
- AI chat with streaming SSE (`/api/chat`)
- Vision analysis — snap or upload classwork image (`/api/vision`)
- Voice input via Deepgram Nova-3 (primary) or Web Speech API (fallback)
- Voice output via Deepgram Aura TTS (primary) or speechSynthesis (fallback)
- Push-to-talk mic button with visual recording indicator
- Three game types: Fill-in-the-blank, Multiple Choice, Timed Speed Maths
- AIResponseCard with typing animation and in-card game launch
- ProfilePicker — "Who's learning today?" session-start modal
- Feature flags system — graceful degradation when optional keys absent
- Canvas PNG export
- Landing page with feature overview
- Security headers & CSP in `next.config.ts`
- MIT licence

### Notes
- This is a prototype/alpha release — not yet production-hardened
- Minimum recommended: OpenRouter free key (google/gemini-2.0-flash-exp:free)
