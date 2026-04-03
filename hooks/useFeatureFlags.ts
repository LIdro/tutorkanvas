'use client'
// ─────────────────────────────────────────────
// TutorKanvas — useFeatureFlags Hook
// Reactive wrapper around the feature flags lib.
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { getFeatureFlags, canUseVoiceInput, canUseVoiceOutput, canUseAI } from '@/lib/feature-flags'
import type { FeatureFlags } from '@/types'

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>({
    aiTutor: false,
    visionAnalysis: false,
    voiceInputBrowser: false,
    voiceOutputBrowser: false,
    voiceInputDeepgram: false,
    voiceOutputDeepgram: false,
    aiCanvasWrite: false,
    aiGames: false,
    serverKeyMode: false,
  })

  const refresh = useCallback(() => {
    setFlags(getFeatureFlags())
  }, [])

  useEffect(() => {
    refresh()
    // Re-evaluate when localStorage changes (e.g. user saves key in settings)
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [refresh])

  return {
    flags,
    refresh,
    canUseAI: canUseAI(flags),
    canUseVoiceInput: canUseVoiceInput(flags),
    canUseVoiceOutput: canUseVoiceOutput(flags),
  }
}
