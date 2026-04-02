// ─────────────────────────────────────────────
// TutorKanvas — Security & Key Storage Layer
// Keys stored in localStorage under tk_ prefix.
// Keys NEVER sent to TutorKanvas servers — direct browser → provider only.
// ─────────────────────────────────────────────

import type { ProviderID, AppSettings, ProviderConfig } from '@/types'
import { hashPin } from './utils'
import { getStorageUserId } from './storage-user'

// ── Storage Keys ─────────────────────────────

const KEYS = {
  providerConfig:    'tk_provider_config',
  deepgramKey:       'tk_deepgram_key',
  deepgramVoice:     'tk_deepgram_voice',
  parentPinHash:     'tk_parent_pin_hash',
  activeProfileId:   'tk_active_profile_id',
  voiceEnabled:      'tk_voice_enabled',
  narrationRate:     'tk_narration_rate',
  explanationPause:  'tk_explanation_pause',
  hasCompletedSetup: 'tk_setup_complete',
} as const

const LEGACY_KEYS = { ...KEYS }

// ── Guard: only run in browser ────────────────

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function getScopedKey(key: string): string {
  const userId = getStorageUserId()
  return userId ? `${key}:${userId}` : key
}

function getStoredValue(key: string): string | null {
  if (!isBrowser()) return null

  const scopedKey = getScopedKey(key)
  const scopedValue = localStorage.getItem(scopedKey)
  if (scopedValue !== null) return scopedValue

  const legacyValue = localStorage.getItem(key)
  if (legacyValue !== null && getStorageUserId()) {
    localStorage.setItem(scopedKey, legacyValue)
  }
  return legacyValue
}

function setStoredValue(key: string, value: string): void {
  if (!isBrowser()) return
  localStorage.setItem(getScopedKey(key), value)
}

function removeStoredValue(key: string): void {
  if (!isBrowser()) return
  localStorage.removeItem(getScopedKey(key))
}

// ── Provider Config ───────────────────────────

export function saveProviderConfig(config: ProviderConfig): void {
  if (!isBrowser()) return
  // Validate that key field is present but never log it
  if (!config.apiKey) return
  setStoredValue(KEYS.providerConfig, JSON.stringify(config))
}

export function getProviderConfig(): ProviderConfig | null {
  if (!isBrowser()) return null
  try {
    const raw = getStoredValue(KEYS.providerConfig)
    return raw ? (JSON.parse(raw) as ProviderConfig) : null
  } catch {
    return null
  }
}

export function clearProviderConfig(): void {
  if (!isBrowser()) return
  removeStoredValue(KEYS.providerConfig)
}

// ── Deepgram Key ──────────────────────────────

export function saveDeepgramKey(key: string): void {
  if (!isBrowser() || !key) return
  setStoredValue(KEYS.deepgramKey, key)
}

export function getDeepgramKey(): string | null {
  if (!isBrowser()) return null
  return getStoredValue(KEYS.deepgramKey)
}

export function clearDeepgramKey(): void {
  if (!isBrowser()) return
  removeStoredValue(KEYS.deepgramKey)
}

// ── Deepgram Voice ────────────────────────────

export function saveDeepgramVoice(voice: string): void {
  if (!isBrowser()) return
  setStoredValue(KEYS.deepgramVoice, voice)
}

export function getDeepgramVoice(): string {
  if (!isBrowser()) return 'aura-asteria-en'
  return getStoredValue(KEYS.deepgramVoice) ?? 'aura-asteria-en'
}

// ── Parent PIN ────────────────────────────────

export async function saveParentPin(pin: string): Promise<void> {
  if (!isBrowser() || !pin) return
  const hashed = await hashPin(pin)
  setStoredValue(KEYS.parentPinHash, hashed)
}

export function getParentPinHash(): string | null {
  if (!isBrowser()) return null
  return getStoredValue(KEYS.parentPinHash)
}

export async function verifyParentPin(pin: string): Promise<boolean> {
  const stored = getParentPinHash()
  if (!stored) return false
  const hashed = await hashPin(pin)
  return hashed === stored
}

export function hasPinSet(): boolean {
  return !!getParentPinHash()
}

// ── Active Profile ────────────────────────────

export function saveActiveProfileId(id: string): void {
  if (!isBrowser()) return
  setStoredValue(KEYS.activeProfileId, id)
}

export function getActiveProfileId(): string | null {
  if (!isBrowser()) return null
  return getStoredValue(KEYS.activeProfileId)
}

// ── Voice Toggle ──────────────────────────────

export function saveVoiceEnabled(enabled: boolean): void {
  if (!isBrowser()) return
  setStoredValue(KEYS.voiceEnabled, String(enabled))
}

export function getVoiceEnabled(): boolean {
  if (!isBrowser()) return true
  return getStoredValue(KEYS.voiceEnabled) !== 'false'
}

export function saveNarrationRate(rate: number): void {
  if (!isBrowser()) return
  const clamped = Math.min(1.2, Math.max(0.6, rate))
  setStoredValue(KEYS.narrationRate, String(clamped))
}

export function getNarrationRate(): number {
  if (!isBrowser()) return 0.9
  const raw = Number(getStoredValue(KEYS.narrationRate) ?? '0.9')
  if (Number.isNaN(raw)) return 0.9
  return Math.min(1.2, Math.max(0.6, raw))
}

export function saveExplanationStepPauseMs(ms: number): void {
  if (!isBrowser()) return
  const clamped = Math.min(4000, Math.max(300, Math.round(ms)))
  setStoredValue(KEYS.explanationPause, String(clamped))
}

export function getExplanationStepPauseMs(): number {
  if (!isBrowser()) return 1200
  const raw = Number(getStoredValue(KEYS.explanationPause) ?? '1200')
  if (Number.isNaN(raw)) return 1200
  return Math.min(4000, Math.max(300, Math.round(raw)))
}

// ── Setup Completion ──────────────────────────

export function markSetupComplete(): void {
  if (!isBrowser()) return
  setStoredValue(KEYS.hasCompletedSetup, 'true')
}

export function hasCompletedSetup(): boolean {
  if (!isBrowser()) return false
  return getStoredValue(KEYS.hasCompletedSetup) === 'true'
}

/** Alias used by canvas page guard */
export const isSetupComplete = hasCompletedSetup

// ── Full App Settings Snapshot ────────────────

export function getAppSettings(): AppSettings {
  return {
    providerConfig:    getProviderConfig(),
    deepgramKey:       getDeepgramKey(),
    deepgramVoice:     getDeepgramVoice(),
    parentPinHash:     getParentPinHash(),
    activeProfileId:   getActiveProfileId(),
    voiceEnabled:      getVoiceEnabled(),
    narrationRate:     getNarrationRate(),
    explanationStepPauseMs: getExplanationStepPauseMs(),
    hasCompletedSetup: hasCompletedSetup(),
  }
}

// ── Nuclear: Clear Everything ─────────────────

export function clearAllAppData(): void {
  if (!isBrowser()) return
  Object.values(KEYS).forEach((key) => {
    localStorage.removeItem(key)
    localStorage.removeItem(getScopedKey(key))
  })
}

export function hasMinimumSetup(): boolean {
  return hasPinSet() && !!getProviderConfig()?.apiKey
}

export function migrateLegacySettingsToCurrentUser(): void {
  if (!isBrowser()) return
  if (!getStorageUserId()) return

  Object.values(LEGACY_KEYS).forEach((key) => {
    const scopedKey = getScopedKey(key)
    const scopedValue = localStorage.getItem(scopedKey)
    const legacyValue = localStorage.getItem(key)

    if (scopedValue === null && legacyValue !== null) {
      localStorage.setItem(scopedKey, legacyValue)
    }
  })
}

// ── Key Validation Helpers ────────────────────

export const KEY_PATTERNS: Record<ProviderID, RegExp> = {
  openrouter: /^sk-or-v1-[a-zA-Z0-9]{64,}$/,
  openai:     /^sk-[a-zA-Z0-9]{32,}$/,
  anthropic:  /^sk-ant-[a-zA-Z0-9\-]{32,}$/,
  google:     /^AIza[a-zA-Z0-9\-_]{35}$/,
  ollama:     /^.+$/,             // any non-empty string (local URL)
}

export function validateApiKey(providerId: ProviderID, key: string): boolean {
  if (!key || key.trim() === '') return false
  // Ollama uses a URL, not a key pattern
  if (providerId === 'ollama') return key.startsWith('http')
  return KEY_PATTERNS[providerId]?.test(key.trim()) ?? true
}

export function maskKey(key: string): string {
  if (!key || key.length < 8) return '••••••••'
  return key.slice(0, 6) + '••••••••' + key.slice(-4)
}
