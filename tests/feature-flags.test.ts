// ─────────────────────────────────────────────
// Tests: lib/feature-flags.ts
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getFeatureFlags, canUseAI, canUseVoiceInput, canUseVoiceOutput } from '@/lib/feature-flags'

// Mock security module
vi.mock('@/lib/security', () => ({
  getProviderConfig: vi.fn(),
  getDeepgramKey:    vi.fn(),
}))

import { getProviderConfig, getDeepgramKey } from '@/lib/security'

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no keys
  ;(getProviderConfig as ReturnType<typeof vi.fn>).mockReturnValue(null)
  ;(getDeepgramKey    as ReturnType<typeof vi.fn>).mockReturnValue(null)
})

describe('getFeatureFlags — no keys', () => {
  it('all AI flags are false', () => {
    const flags = getFeatureFlags()
    expect(flags.aiTutor).toBe(false)
    expect(flags.visionAnalysis).toBe(false)
    expect(flags.aiCanvasWrite).toBe(false)
    expect(flags.aiGames).toBe(false)
  })

  it('deepgram flags are false', () => {
    const flags = getFeatureFlags()
    expect(flags.voiceInputDeepgram).toBe(false)
    expect(flags.voiceOutputDeepgram).toBe(false)
  })
})

describe('getFeatureFlags — with LLM key', () => {
  it('enables AI flags when a provider config is present', () => {
    ;(getProviderConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'openai', name: 'OpenAI', apiKey: 'sk-test', model: 'gpt-4o',
    })
    const flags = getFeatureFlags()
    expect(flags.aiTutor).toBe(true)
    expect(flags.visionAnalysis).toBe(true)
  })
})

describe('getFeatureFlags — with Deepgram key', () => {
  it('enables deepgram voice flags', () => {
    ;(getDeepgramKey as ReturnType<typeof vi.fn>).mockReturnValue('dg-key')
    const flags = getFeatureFlags()
    expect(flags.voiceInputDeepgram).toBe(true)
    expect(flags.voiceOutputDeepgram).toBe(true)
  })
})

describe('canUseAI helper', () => {
  it('returns true when aiTutor flag is set', () => {
    expect(canUseAI({ aiTutor: true } as any)).toBe(true)
  })

  it('returns false when aiTutor flag is false', () => {
    expect(canUseAI({ aiTutor: false } as any)).toBe(false)
  })
})

describe('canUseVoiceInput helper', () => {
  it('returns true if browser voice is supported', () => {
    expect(canUseVoiceInput({ voiceInputBrowser: true, voiceInputDeepgram: false } as any)).toBe(true)
  })

  it('returns true if deepgram voice is available', () => {
    expect(canUseVoiceInput({ voiceInputBrowser: false, voiceInputDeepgram: true } as any)).toBe(true)
  })

  it('returns false if neither is available', () => {
    expect(canUseVoiceInput({ voiceInputBrowser: false, voiceInputDeepgram: false } as any)).toBe(false)
  })
})

describe('canUseVoiceOutput helper', () => {
  it('returns true if browser synthesis is available', () => {
    expect(canUseVoiceOutput({ voiceOutputBrowser: true, voiceOutputDeepgram: false } as any)).toBe(true)
  })
})
