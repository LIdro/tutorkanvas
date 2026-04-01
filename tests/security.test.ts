// ─────────────────────────────────────────────
// Tests: lib/security.ts — key storage layer
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveProviderConfig, getProviderConfig, clearProviderConfig,
  saveDeepgramKey, getDeepgramKey,
  saveParentPin, verifyParentPin, hasPinSet,
  markSetupComplete, hasCompletedSetup, isSetupComplete,
  validateApiKey, maskKey, clearAllAppData,
  saveVoiceEnabled, getVoiceEnabled,
} from '@/lib/security'

// jsdom provides localStorage; reset between tests
beforeEach(() => {
  localStorage.clear()
})

// ── Provider config ───────────────────────────

describe('saveProviderConfig / getProviderConfig', () => {
  it('round-trips a provider config', () => {
    const cfg = { id: 'openai' as const, name: 'OpenAI', apiKey: 'sk-test1234567890abcdef1234567890abcdef', model: 'gpt-4o-mini' }
    saveProviderConfig(cfg)
    expect(getProviderConfig()).toEqual(cfg)
  })

  it('returns null when nothing is saved', () => {
    expect(getProviderConfig()).toBeNull()
  })

  it('does not save if apiKey is empty', () => {
    saveProviderConfig({ id: 'openai' as const, name: 'OpenAI', apiKey: '', model: 'gpt-4o' })
    expect(getProviderConfig()).toBeNull()
  })

  it('clearProviderConfig removes the stored value', () => {
    saveProviderConfig({ id: 'openai' as const, name: 'OpenAI', apiKey: 'sk-abc123abc123abc123abc123abc123abc1', model: 'gpt-4o' })
    clearProviderConfig()
    expect(getProviderConfig()).toBeNull()
  })
})

// ── Deepgram key ──────────────────────────────

describe('saveDeepgramKey / getDeepgramKey', () => {
  it('stores and retrieves a Deepgram key', () => {
    saveDeepgramKey('dg-test-key')
    expect(getDeepgramKey()).toBe('dg-test-key')
  })

  it('returns null when not set', () => {
    expect(getDeepgramKey()).toBeNull()
  })
})

// ── Parent PIN ────────────────────────────────

describe('saveParentPin / verifyParentPin', () => {
  it('verifies the correct PIN', async () => {
    await saveParentPin('1234')
    expect(await verifyParentPin('1234')).toBe(true)
  })

  it('rejects a wrong PIN', async () => {
    await saveParentPin('1234')
    expect(await verifyParentPin('0000')).toBe(false)
  })

  it('hasPinSet returns false before any PIN is set', () => {
    expect(hasPinSet()).toBe(false)
  })

  it('hasPinSet returns true after PIN is set', async () => {
    await saveParentPin('5678')
    expect(hasPinSet()).toBe(true)
  })
})

// ── Setup completion ──────────────────────────

describe('markSetupComplete / hasCompletedSetup / isSetupComplete', () => {
  it('returns false before marking complete', () => {
    expect(hasCompletedSetup()).toBe(false)
    expect(isSetupComplete()).toBe(false)
  })

  it('returns true after marking complete', () => {
    markSetupComplete()
    expect(hasCompletedSetup()).toBe(true)
    expect(isSetupComplete()).toBe(true)
  })
})

// ── Voice toggle ──────────────────────────────

describe('saveVoiceEnabled / getVoiceEnabled', () => {
  it('defaults to true', () => {
    expect(getVoiceEnabled()).toBe(true)
  })

  it('persists false', () => {
    saveVoiceEnabled(false)
    expect(getVoiceEnabled()).toBe(false)
  })

  it('persists true after being set false', () => {
    saveVoiceEnabled(false)
    saveVoiceEnabled(true)
    expect(getVoiceEnabled()).toBe(true)
  })
})

// ── clearAllAppData ───────────────────────────

describe('clearAllAppData', () => {
  it('clears everything', async () => {
    await saveParentPin('9999')
    saveDeepgramKey('some-key')
    markSetupComplete()
    clearAllAppData()
    expect(hasPinSet()).toBe(false)
    expect(getDeepgramKey()).toBeNull()
    expect(hasCompletedSetup()).toBe(false)
  })
})

// ── validateApiKey ────────────────────────────

describe('validateApiKey', () => {
  it('accepts a valid OpenAI key', () => {
    // OpenAI keys: sk- followed by 32+ alphanum chars
    expect(validateApiKey('openai', 'sk-' + 'a'.repeat(32))).toBe(true)
  })

  it('rejects an empty key for openai', () => {
    expect(validateApiKey('openai', '')).toBe(false)
  })

  it('accepts any http URL for ollama', () => {
    expect(validateApiKey('ollama', 'http://localhost:11434')).toBe(true)
  })

  it('rejects non-http string for ollama', () => {
    expect(validateApiKey('ollama', 'not-a-url')).toBe(false)
  })

  it('accepts a valid Anthropic key', () => {
    expect(validateApiKey('anthropic', 'sk-ant-api03-' + 'x'.repeat(32))).toBe(true)
  })
})

// ── maskKey ───────────────────────────────────

describe('maskKey', () => {
  it('masks the middle of a key', () => {
    const masked = maskKey('sk-test1234567890')
    expect(masked).toMatch(/^sk-tes/)
    expect(masked).toContain('••••••••')
    expect(masked).toMatch(/7890$/)
  })

  it('returns placeholder for short keys', () => {
    expect(maskKey('ab')).toBe('••••••••')
  })
})
