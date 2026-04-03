// ─────────────────────────────────────────────
// TutorKanvas — Feature Flags
// Derived entirely from stored keys + browser capabilities.
// No server calls — purely synchronous client-side logic.
// ─────────────────────────────────────────────

import type { FeatureFlags } from '@/types'
import { getProviderConfig, getDeepgramKey } from './security'

function browserSupportsSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
}

function browserSupportsSpeechSynthesis(): boolean {
  if (typeof window === 'undefined') return false
  return 'speechSynthesis' in window
}

export function getFeatureFlags(): FeatureFlags {
  const hasLLMKey = !!getProviderConfig()?.apiKey
  const hasDeepgramKey = !!getDeepgramKey()
  const serverKeyMode =
    process.env.NEXT_PUBLIC_SERVER_KEY_MODE === 'true'

  // In server-key mode the key lives in .env — treat as always present
  const llmAvailable = hasLLMKey || serverKeyMode

  return {
    aiTutor:             llmAvailable,
    visionAnalysis:      llmAvailable,
    voiceInputBrowser:   browserSupportsSpeechRecognition(),
    voiceOutputBrowser:  browserSupportsSpeechSynthesis(),
    voiceInputDeepgram:  hasDeepgramKey,
    voiceOutputDeepgram: hasDeepgramKey,
    aiCanvasWrite:       llmAvailable,
    aiGames:             llmAvailable,
    serverKeyMode,
    excalidrawCanvas:    process.env.NEXT_PUBLIC_CANVAS_ENGINE === 'excalidraw',
  }
}

// Derived helpers ─────────────────────────────

export function canUseVoiceInput(flags: FeatureFlags): boolean {
  return flags.voiceInputDeepgram || flags.voiceInputBrowser
}

export function canUseVoiceOutput(flags: FeatureFlags): boolean {
  return flags.voiceOutputDeepgram || flags.voiceOutputBrowser
}

export function canUseAI(flags: FeatureFlags): boolean {
  return flags.aiTutor
}

// Human-readable reason why a feature is unavailable
export function featureUnavailableReason(feature: keyof FeatureFlags): string {
  const reasons: Record<string, string> = {
    aiTutor:            'Add an AI provider key in Settings to enable the AI tutor.',
    visionAnalysis:     'Add an AI provider key in Settings to analyse images.',
    voiceInputBrowser:  'Your browser does not support voice input. Try Chrome or Safari.',
    voiceOutputBrowser: 'Your browser does not support voice output. Try Chrome or Safari.',
    voiceInputDeepgram: 'Add a Deepgram key in Settings for high-quality voice input.',
    voiceOutputDeepgram:'Add a Deepgram key in Settings for high-quality AI voice.',
    aiCanvasWrite:      'Add an AI provider key in Settings to enable AI canvas writing.',
    aiGames:            'Add an AI provider key in Settings to enable AI games.',
    serverKeyMode:      '',
    excalidrawCanvas:   '',
  }
  return reasons[feature] ?? 'This feature is not available.'
}
