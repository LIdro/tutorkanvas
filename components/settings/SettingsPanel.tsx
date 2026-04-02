'use client'
// ─────────────────────────────────────────────
// TutorKanvas — SettingsPanel
// PIN-gated slide-out settings drawer.
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { X, Eye, EyeOff, ExternalLink, Trash2, Plus, Check, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  verifyParentPin, hasPinSet, getProviderConfig, saveProviderConfig,
  clearProviderConfig, getDeepgramKey, saveDeepgramKey,
  getDeepgramVoice, saveDeepgramVoice, validateApiKey, maskKey,
  clearAllAppData, getVoiceEnabled, saveVoiceEnabled,
} from '@/lib/security'
import { getFeatureFlags, canUseAI } from '@/lib/feature-flags'
import { PROVIDERS, getDefaultModel } from '@/lib/providers'
import { useLearnerProfile } from '@/hooks/useLearnerProfile'
import type { ProviderID } from '@/types'

const DEEPGRAM_VOICES = [
  { id: 'aura-asteria-en', name: 'Asteria — Warm & friendly' },
  { id: 'aura-luna-en',    name: 'Luna — Soft & calm' },
  { id: 'aura-zeus-en',    name: 'Zeus — Clear' },
  { id: 'aura-athena-en',  name: 'Athena — British' },
]

type Section = 'ai' | 'voice' | 'profiles' | 'data'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsPanel({ open, onClose }: Props) {
  const { userId } = useAuth()
  const { profiles, addProfile, removeProfile } = useLearnerProfile()

  // PIN gate
  const [pinUnlocked, setPinUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [section, setSection] = useState<Section>('ai')

  // AI provider
  const [providerId, setProviderId] = useState<ProviderID>('openrouter')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState('')
  const [keyError, setKeyError] = useState('')
  const [keySaved, setKeySaved] = useState(false)

  // Voice
  const [dgKey, setDgKey] = useState('')
  const [dgVoice, setDgVoice] = useState('aura-asteria-en')
  const [voiceEnabled, setVoiceEnabledLocal] = useState(true)

  // New profile
  const [newName, setNewName] = useState('')
  const [newAge, setNewAge] = useState('')

  // Confirm clear
  const [confirmClear, setConfirmClear] = useState(false)

  // Feature flags (refresh when panel opens)
  const [flags, setFlags] = useState(getFeatureFlags())

  useEffect(() => {
    if (!open) return
    setFlags(getFeatureFlags())
    const cfg = getProviderConfig()
    if (cfg) {
      setProviderId(cfg.id as ProviderID)
      setModel(cfg.model)
    }
    const existingDgKey = getDeepgramKey()
    if (existingDgKey) setDgKey(existingDgKey)
    setDgVoice(getDeepgramVoice() ?? 'aura-asteria-en')
    setVoiceEnabledLocal(getVoiceEnabled())
  }, [open])

  // Reset unlock state when panel closes
  useEffect(() => {
    if (!open) {
      setPinUnlocked(false)
      setPinInput('')
      setPinError('')
      setApiKey('')
      setDgKey('')
      setKeySaved(false)
      setConfirmClear(false)
    }
  }, [open])

  async function handleUnlock() {
    const ok = await verifyParentPin(pinInput)
    if (!ok) {
      setPinError('Incorrect PIN. Try again.')
      setPinInput('')
      return
    }
    setPinUnlocked(true)
    setPinError('')
  }

  function handleSaveAI() {
    if (!validateApiKey(providerId, apiKey)) {
      setKeyError('That key doesn\'t look right. Please check it.')
      return
    }
    const finalModel = model || getDefaultModel(providerId)
    saveProviderConfig({ id: providerId, name: providerMeta.name, apiKey, model: finalModel })
    setKeyError('')
    setApiKey('')
    setKeySaved(true)
    setFlags(getFeatureFlags())
    setTimeout(() => setKeySaved(false), 2000)
  }

  function handleClearAI() {
    clearProviderConfig()
    setApiKey('')
    setFlags(getFeatureFlags())
  }

  function handleSaveVoice() {
    if (dgKey.trim()) {
      saveDeepgramKey(dgKey.trim())
      saveDeepgramVoice(dgVoice)
    }
    saveVoiceEnabled(voiceEnabled)
    setFlags(getFeatureFlags())
  }

  async function handleAddProfile() {
    if (!newName.trim()) return
    await addProfile(newName.trim(), newAge ? parseInt(newAge) : undefined)
    setNewName('')
    setNewAge('')
  }

  function handleClearAll() {
    clearAllAppData()
    setConfirmClear(false)
    onClose()
    window.location.href = '/setup'
  }

  const currentCfg = getProviderConfig()
  const providerMeta = PROVIDERS.find((p) => p.id === providerId)!

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn('fixed inset-0 bg-black/40 dark:bg-black/60 z-40 transition-opacity', open ? 'opacity-100' : 'opacity-0 pointer-events-none')}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className={cn(
        'fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col transition-transform duration-300 border-l border-transparent dark:border-gray-700',
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">⚙️ Settings</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"><X size={20} /></button>
        </div>

        {/* PIN gate */}
        {!pinUnlocked ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-4 w-full max-w-xs">
              <div className="text-5xl">🔐</div>
              <p className="text-gray-600 dark:text-gray-400">Enter your parent PIN to access settings.</p>
              {!hasPinSet() && (
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
                  <ShieldAlert size={16} className="text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">No PIN set yet. Visit <a href="/setup" className="underline">/setup</a> to configure.</p>
                </div>
              )}
              <input
                type="password" inputMode="numeric" maxLength={4}
                placeholder="4-digit PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                className="input-field text-center text-2xl tracking-[0.5em]"
              />
              {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
              <button onClick={handleUnlock} disabled={pinInput.length !== 4} className="btn-primary w-full">Unlock</button>
            </div>
          </div>
        ) : (
          <>
            {/* Nav tabs */}
            <nav className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
              {(['ai', 'voice', 'profiles', 'data'] as Section[]).map((s) => (
                <button key={s} onClick={() => setSection(s)}
                  className={cn('px-4 py-3 text-sm font-medium capitalize whitespace-nowrap border-b-2 transition-colors',
                    section === s
                      ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  )}>
                  {s === 'ai' ? '🤖 AI' : s === 'voice' ? '🎤 Voice' : s === 'profiles' ? '👧 Profiles' : '🗑️ Data'}
                </button>
              ))}
            </nav>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* AI Section */}
              {section === 'ai' && (
                <div className="space-y-4">
                  <div className={cn('flex items-center gap-2 p-3 rounded-xl text-sm',
                    canUseAI(flags) ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400')}>
                    {canUseAI(flags) ? '✅ AI is enabled' : '⚠️ No AI provider configured'}
                    {currentCfg && <span className="ml-auto font-mono text-xs">{maskKey(currentCfg.apiKey)}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {PROVIDERS.filter((p) => !p.advanced).map((p) => (
                      <button key={p.id} onClick={() => { setProviderId(p.id as ProviderID); setModel(getDefaultModel(p.id as ProviderID)) }}
                        className={cn('p-2.5 rounded-xl border-2 text-left text-xs transition-all',
                          providerId === p.id
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40'
                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-700'
                        )}>
                        <span className="font-semibold block dark:text-gray-200">{p.name}</span>
                        {p.recommended && <span className="text-[10px] bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 px-1 rounded">FREE tier</span>}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      placeholder={providerMeta.keyPlaceholder}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="input-field pr-10"
                    />
                    <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {keyError && <p className="text-red-500 text-sm">{keyError}</p>}
                  <a href={providerMeta.keyHelpUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-purple-500 hover:underline">
                    Get a {providerMeta.name} key <ExternalLink size={12} />
                  </a>

                  <select value={model} onChange={(e) => setModel(e.target.value)} className="input-field">
                    {providerMeta.models.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <button onClick={handleSaveAI} disabled={!apiKey.trim()} className="btn-primary flex-1">
                      {keySaved ? <><Check size={14} className="inline mr-1" />Saved!</> : 'Save Key'}
                    </button>
                    {currentCfg && (
                      <button onClick={handleClearAI} className="btn-danger px-4">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Voice Section */}
              {section === 'voice' && (
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => { saveVoiceEnabled(!voiceEnabled); setVoiceEnabledLocal(!voiceEnabled) }}
                      className={cn('w-11 h-6 rounded-full transition-colors relative', voiceEnabled ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-700')}>
                      <div className={cn('w-4 h-4 bg-white rounded-full absolute top-1 transition-transform', voiceEnabled ? 'translate-x-6' : 'translate-x-1')} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Voice enabled</span>
                  </label>

                  <p className="text-gray-500 dark:text-gray-400 text-sm">Deepgram key is optional — the app uses your browser's voice if not provided.</p>
                  <div className="relative">
                    <input type={showKey ? 'text' : 'password'} placeholder="Deepgram API key (optional)"
                      value={dgKey} onChange={(e) => setDgKey(e.target.value)} className="input-field pr-10" />
                    <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {dgKey && (
                    <select value={dgVoice} onChange={(e) => setDgVoice(e.target.value)} className="input-field">
                      {DEEPGRAM_VOICES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  )}
                  <button onClick={handleSaveVoice} className="btn-primary w-full">Save Voice Settings</button>
                </div>
              )}

              {/* Profiles Section */}
              {section === 'profiles' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {profiles.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-purple-50 dark:bg-purple-950/40 rounded-xl px-4 py-3 border border-purple-100 dark:border-purple-800/30">
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-100">{p.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {p.age ? `Age ${p.age}` : ''}
                            {p.grade ? ` · Grade ${p.grade}` : ''}
                            {` · ${p.sessionCount} sessions`}
                            {p.totalStars > 0 ? ` · ⭐ ${p.totalStars}` : ''}
                          </p>
                        </div>
                        <button onClick={() => removeProfile(p.id)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {profiles.length === 0 && (
                      <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">No profiles yet.</p>
                    )}
                  </div>

                  {profiles.length < 5 && (
                    <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Add profile</p>
                      <input type="text" placeholder="Child's name" value={newName}
                        onChange={(e) => setNewName(e.target.value)} className="input-field" />
                      <input type="number" placeholder="Age (optional)" min={4} max={18} value={newAge}
                        onChange={(e) => setNewAge(e.target.value)} className="input-field" />
                      <button onClick={handleAddProfile} disabled={!newName.trim()} className="btn-secondary w-full">
                        <Plus size={14} className="inline mr-1" />Add
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Data Section */}
              {section === 'data' && (
                <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950/40 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-400 space-y-1 border border-blue-100 dark:border-blue-800/30">
                  <p className="font-semibold">🔒 Your privacy</p>
                    <p>Keys stay in this browser and are scoped to the signed-in Clerk user.</p>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <p>• Signed in as <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{userId ?? 'unknown'}</code></p>
                    <p>• API keys → <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">localStorage</code></p>
                    <p>• Sessions & profiles → <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">IndexedDB</code></p>
                    <p>• Cross-device sync still needs a real database</p>
                    <p>• No analytics or telemetry</p>
                    <p>• MIT licensed — inspect the source any time</p>
                  </div>

                  {!confirmClear ? (
                    <button onClick={() => setConfirmClear(true)} className="btn-danger w-full">
                      <Trash2 size={16} className="inline mr-2" />Clear All Data & Reset
                    </button>
                  ) : (
                    <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3">
                      <p className="text-red-700 dark:text-red-400 font-medium text-sm">⚠️ This will delete all API keys, profiles, and sessions. This cannot be undone.</p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmClear(false)} className="btn-secondary flex-1">Cancel</button>
                        <button onClick={handleClearAll} className="btn-danger flex-1">Yes, clear everything</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </>
        )}
      </aside>
    </>
  )
}
