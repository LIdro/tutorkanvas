'use client'
// ─────────────────────────────────────────────
// TutorKanvas — SetupWizard
// Multi-step first-run experience.
// ─────────────────────────────────────────────

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ExternalLink, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  saveProviderConfig, saveParentPin, saveDeepgramKey,
  saveDeepgramVoice, markSetupComplete, validateApiKey,
} from '@/lib/security'
import { PROVIDERS, getDefaultModel } from '@/lib/providers'
import type { ProviderID } from '@/types'
import { useLearnerProfile } from '@/hooks/useLearnerProfile'

const DEEPGRAM_VOICES = [
  { id: 'aura-asteria-en', name: 'Asteria — Warm & friendly (recommended)' },
  { id: 'aura-luna-en',    name: 'Luna — Soft & calm' },
  { id: 'aura-zeus-en',    name: 'Zeus — Clear & authoritative' },
  { id: 'aura-athena-en',  name: 'Athena — British & precise' },
]

const STEP_LABELS = ['Welcome', 'PIN', 'AI Setup', 'Voice', 'Profiles', 'Tour']
const TOTAL_STEPS = STEP_LABELS.length

export default function SetupWizard() {
  const router = useRouter()
  const { addProfile } = useLearnerProfile()

  const [step, setStep] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showKey, setShowKey] = useState(false)

  // PIN
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinError, setPinError] = useState('')

  // Provider
  const [providerId, setProviderId] = useState<ProviderID>('openrouter')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(getDefaultModel('openrouter'))
  const [customModel, setCustomModel] = useState('')
  const [keyError, setKeyError] = useState('')

  // Deepgram
  const [dgKey, setDgKey] = useState('')
  const [dgVoice, setDgVoice] = useState('aura-asteria-en')

  // Profiles
  const [childName, setChildName] = useState('')
  const [childAge, setChildAge] = useState('')
  const [childGrade, setChildGrade] = useState('')
  const [addedProfiles, setAddedProfiles] = useState<string[]>([])

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  async function handlePinStep() {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setPinError('PIN must be exactly 4 digits.')
      return
    }
    if (pin !== pinConfirm) {
      setPinError('PINs do not match.')
      return
    }
    await saveParentPin(pin)
    setPinError('')
    next()
  }

  function handleProviderStep() {
    const key = apiKey.trim()
    if (!validateApiKey(providerId, key)) {
      setKeyError('That key doesn\'t look right. Please check it and try again.')
      return
    }
    const finalModel = customModel.trim() || model
    saveProviderConfig({ id: providerId, name: providerMeta.name, apiKey: key, model: finalModel })
    setKeyError('')
    next()
  }

  function handleVoiceStep() {
    if (dgKey.trim()) {
      saveDeepgramKey(dgKey.trim())
      saveDeepgramVoice(dgVoice)
    }
    next()
  }

  async function handleAddProfile() {
    if (!childName.trim()) return
    await addProfile(childName.trim(), childAge ? parseInt(childAge) : undefined, childGrade || undefined)
    setAddedProfiles((p) => [...p, childName.trim()])
    setChildName(''); setChildAge(''); setChildGrade('')
  }

  async function handleFinish() {
    markSetupComplete()
    router.push('/canvas')
  }

  const providerMeta = PROVIDERS.find((p) => p.id === providerId)!

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-transparent dark:border-gray-700/50">

        {/* Progress bar */}
        <div className="flex gap-1 p-4 pb-0">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <div className={cn(
                'h-2 rounded-full transition-all',
                i < step ? 'bg-purple-500' : i === step ? 'bg-purple-300' : 'bg-gray-100 dark:bg-gray-700'
              )} />
              <span className="text-[10px] text-gray-400 hidden sm:block">{label}</span>
            </div>
          ))}
        </div>

        <div className="p-8">

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center space-y-4">
              <div className="text-7xl">🤖</div>
              <h1 className="text-3xl font-bold text-purple-700 dark:text-purple-400">Hi, I'm Max!</h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">Your personal maths tutor. I'm here to make maths fun and easy to understand.</p>
              <p className="text-gray-500 dark:text-gray-500">Let's get you set up in about 2 minutes.</p>
              <button onClick={next} className="w-full btn-primary mt-4">
                Let's go! <ChevronRight size={18} className="inline ml-1" />
              </button>
            </div>
          )}

          {/* Step 1: Parent PIN */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">🔐 Parent PIN</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Set a 4-digit PIN to protect your API keys and settings. Children won't need this to use the app.</p>
              <div className="space-y-3">
                <input type="password" inputMode="numeric" maxLength={4} placeholder="4-digit PIN" value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="input-field" />
                <input type="password" inputMode="numeric" maxLength={4} placeholder="Confirm PIN" value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                  className="input-field" />
                {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={back} className="btn-secondary flex-1"><ChevronLeft size={18} className="inline mr-1" />Back</button>
                <button onClick={handlePinStep} className="btn-primary flex-1">Next <ChevronRight size={18} className="inline ml-1" /></button>
              </div>
            </div>
          )}

          {/* Step 2: AI Setup */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">🤖 Choose Your AI</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">This is the only required key. We recommend OpenRouter — it has a free tier.</p>

              {/* Provider grid */}
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.filter((p) => !p.advanced || showAdvanced).map((p) => (
                  <button key={p.id} onClick={() => { setProviderId(p.id as ProviderID); setModel(getDefaultModel(p.id as ProviderID)); setApiKey('') }}
                    className={cn('p-3 rounded-xl border-2 text-left transition-all',
                      providerId === p.id
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40'
                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-700'
                    )}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm dark:text-gray-200">{p.name}</span>
                      {p.recommended && <span className="text-[10px] bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full font-bold">FREE</span>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.description}</p>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-purple-500 underline">
                {showAdvanced ? 'Hide advanced options' : 'Show advanced options (Ollama)'}
              </button>

              {/* Key input */}
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

              {/* Model selector */}
              <select value={model} onChange={(e) => setModel(e.target.value)} className="input-field">
                {providerMeta.models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.recommended ? ' ★' : ''}</option>
                ))}
                <option value="custom">Custom model…</option>
              </select>
              {model === 'custom' && (
                <input type="text" placeholder="Enter model ID" value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)} className="input-field" />
              )}

              <div className="flex gap-3 mt-2">
                <button onClick={back} className="btn-secondary flex-1"><ChevronLeft size={18} className="inline mr-1" />Back</button>
                <button onClick={handleProviderStep} disabled={!apiKey.trim()} className="btn-primary flex-1">
                  Next <ChevronRight size={18} className="inline ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Voice (optional) */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">🎤 Voice (Optional)</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Add a Deepgram key for high-quality AI voice. Without it, the app uses your browser's built-in voice — which works fine!</p>
              <div className="relative">
                <input type={showKey ? 'text' : 'password'} placeholder="Deepgram API key (optional)"
                  value={dgKey} onChange={(e) => setDgKey(e.target.value)} className="input-field pr-10" />
                <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {dgKey && (
                <select value={dgVoice} onChange={(e) => setDgVoice(e.target.value)} className="input-field">
                  {DEEPGRAM_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              )}
              <a href="https://console.deepgram.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-purple-500 hover:underline">
                Get a free Deepgram key <ExternalLink size={12} />
              </a>
              <div className="flex gap-3 mt-2">
                <button onClick={back} className="btn-secondary flex-1"><ChevronLeft size={18} className="inline mr-1" />Back</button>
                <button onClick={handleVoiceStep} className="btn-primary flex-1">Next <ChevronRight size={18} className="inline ml-1" /></button>
              </div>
            </div>
          )}

          {/* Step 4: Child profiles (optional) */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">👧 Child Profiles (Optional)</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Add profiles so Max can adapt to each child. You can add more later in Settings.</p>
              <div className="space-y-2">
                <input type="text" placeholder="Child's name" value={childName} onChange={(e) => setChildName(e.target.value)} className="input-field" />
                <div className="flex gap-2">
                  <input type="number" placeholder="Age" min={4} max={18} value={childAge} onChange={(e) => setChildAge(e.target.value)} className="input-field w-24" />
                  <input type="text" placeholder="Grade / Year (optional)" value={childGrade} onChange={(e) => setChildGrade(e.target.value)} className="input-field flex-1" />
                </div>
                <button onClick={handleAddProfile} disabled={!childName.trim()} className="btn-secondary w-full">
                  Add Profile
                </button>
              </div>
              {addedProfiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {addedProfiles.map((name) => (
                    <span key={name} className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-sm font-medium">
                      <Check size={12} /> {name}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-3 mt-2">
                <button onClick={back} className="btn-secondary flex-1"><ChevronLeft size={18} className="inline mr-1" />Back</button>
                <button onClick={next} className="btn-primary flex-1">Next <ChevronRight size={18} className="inline ml-1" /></button>
              </div>
            </div>
          )}

          {/* Step 5: Tour / finish */}
          {step === 5 && (
            <div className="text-center space-y-4">
              <div className="text-7xl">🎉</div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">You're all set!</h2>
              <div className="text-left space-y-3 bg-purple-50 dark:bg-purple-950/40 rounded-2xl p-4 border border-purple-100 dark:border-purple-800/30">
                <p className="font-semibold text-purple-700 dark:text-purple-400 text-sm">Quick tips:</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">📸 <strong>Snap</strong> — take a photo of classwork for Max to analyse</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">🎤 <strong>Hold mic</strong> — talk to Max directly</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">🤖 <strong>Ask</strong> — type any maths question</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">⚙️ <strong>Settings</strong> — PIN required (parent only)</p>
              </div>
              <button onClick={handleFinish} className="btn-primary w-full text-lg py-4">
                Open TutorKanvas 🚀
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
