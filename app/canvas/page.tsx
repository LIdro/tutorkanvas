'use client'
// ─────────────────────────────────────────────
// TutorKanvas — Main Canvas Page
// Wires together: CanvasWrapper, Toolbar, AIToolbar,
// ProfilePicker, SettingsPanel, AIResponseCard.
// ─────────────────────────────────────────────

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import CanvasWrapper, { type CanvasWrapperRef } from '@/components/canvas/CanvasWrapper'
import Toolbar from '@/components/toolbar/Toolbar'
import AIToolbar from '@/components/toolbar/AIToolbar'
import SettingsPanel from '@/components/settings/SettingsPanel'
import ProfilePicker from '@/components/ui/ProfilePicker'
import SessionPicker from '@/components/ui/SessionPicker'
import AIResponseCard from '@/components/ai/AIResponseCard'
import { useLearnerProfile } from '@/hooks/useLearnerProfile'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useVoice } from '@/hooks/useVoice'
import { getProviderConfig, isSetupComplete } from '@/lib/security'
import { getProvider } from '@/lib/providers'
import { parseAIResponse } from '@/lib/canvas-actions'
import { createSession, appendMessage, saveCanvasState } from '@/lib/session'
import { addStars } from '@/lib/learner-profile'
import type { AICanvasResponse, TKSession } from '@/types'

export default function CanvasPage() {
  const router = useRouter()
  const canvasRef = useRef<CanvasWrapperRef>(null)
  const { activeProfile, selectProfile } = useLearnerProfile()
  const flags = useFeatureFlags()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profilePickerOpen, setProfilePickerOpen] = useState(false)
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false)
  const [response, setResponse] = useState<AICanvasResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [session, setSession] = useState<TKSession | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Execute canvas draw-actions whenever a new AI response arrives
  useEffect(() => {
    if (!response?.actions?.length) return
    canvasRef.current?.executeActions(response.actions)
  }, [response])

  const { speak } = useVoice({
    onTranscript: (text) => handlePrompt(text),
  })

  // Redirect to setup if not configured
  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

  // Init session + show profile picker
  useEffect(() => {
    async function init() {
      const s = await createSession(
        activeProfile?.id ?? 'guest',
        `Session — ${new Date().toLocaleDateString()}`,
      )
      setSession(s)
      setProfilePickerOpen(true)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePrompt(text: string, imageBase64?: string) {
    const cfg = getProviderConfig()
    if (!cfg) return

    setIsLoading(true)
    try {
      const provider = getProvider(cfg)

      if (imageBase64) {
        // Vision path
        const res = await fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, prompt: text, providerConfig: cfg, profile: activeProfile }),
        })
        if (res.ok) {
          const data: AICanvasResponse = await res.json()
          setResponse(data)
          const speakAction = data.actions.find((a) => a.type === 'speak')
          if (speakAction && flags.canUseVoiceOutput) speak((speakAction as any).text)
          if (session) await appendMessage(session.id, { role: 'user', content: `[image] ${text}` })
          if (session && speakAction) await appendMessage(session.id, { role: 'assistant', content: (speakAction as any).text })
        }
      } else {
        // Text streaming path
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: text }],
            providerConfig: cfg,
            profile: activeProfile,
          }),
        })
        if (!res.ok) throw new Error('Chat request failed')

        // Collect SSE stream
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let raw = ''
        while (reader) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          // Parse SSE lines
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break
              try { raw += JSON.parse(data) } catch { raw += data }
            }
          }
        }

        const parsed = parseAIResponse(raw)
        setResponse(parsed)
        const speakAction = parsed.actions.find((a) => a.type === 'speak')
        if (speakAction && flags.canUseVoiceOutput) speak((speakAction as any).text)
        if (session) {
          await appendMessage(session.id, { role: 'user', content: text })
          if (speakAction) await appendMessage(session.id, { role: 'assistant', content: (speakAction as any).text })
        }
      }
    } catch (err) {
      console.error('AI request failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleProfileSelect(profileId: string | null) {
    if (profileId) selectProfile(profileId)
    setProfilePickerOpen(false)
  }

  async function handleNewSession() {
    const s = await createSession(
      activeProfile?.id ?? 'guest',
      `Session — ${new Date().toLocaleDateString()}`,
    )
    setSession(s)
    setResponse(null)
    setHasChanges(false)
    window.location.reload() // easiest way to reset tldraw editor
  }

  async function handleExportPng() {
    const png = await canvasRef.current?.exportPng()
    if (!png) return
    const a = document.createElement('a')
    a.href = png
    a.download = `tutorkanvas-${Date.now()}.png`
    a.click()
  }

  function handleClearCanvas() {
    if (!confirm('Clear the canvas? This cannot be undone.')) return
    window.location.reload()
  }

  const handleCanvasChange = useCallback(async (snapshot: object) => {
    setHasChanges(true)
    if (session) await saveCanvasState(session.id, snapshot)
  }, [session])

  return (
    <main className="w-screen h-screen overflow-hidden">
      <Toolbar
        sessionName={session?.name}
        hasChanges={hasChanges}
        onNewSession={handleNewSession}
        onExportPng={handleExportPng}
        onClearCanvas={handleClearCanvas}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSessions={() => setSessionPickerOpen(true)}
      />

      {/* Canvas fills the screen below toolbar */}
      <div className="pt-14 h-full">
        <CanvasWrapper
          ref={canvasRef}
          onCanvasChange={handleCanvasChange}
        />
      </div>

      {/* Bottom AI toolbar */}
      <AIToolbar
        profile={activeProfile ?? null}
        onAIResponse={(res) => setResponse(res)}
        onAskText={(text) => handlePrompt(text)}
        isProcessing={isLoading}
      />

      {/* Floating AI response */}
      <AIResponseCard
        response={response}
        isLoading={isLoading}
        onGameComplete={(stars) => {
          console.log('stars:', stars)
          if (activeProfile) addStars(activeProfile.id, stars)
        }}
        onDismiss={() => setResponse(null)}
      />

      {/* Modals */}
      <ProfilePicker
        open={profilePickerOpen}
        onClose={() => setProfilePickerOpen(false)}
        onSelect={handleProfileSelect}
      />
      <SessionPicker
        open={sessionPickerOpen}
        onClose={() => setSessionPickerOpen(false)}
        onResume={(s) => {
          setSession(s)
          setResponse(null)
          setHasChanges(false)
          // Reload the page to restore the tldraw snapshot
          window.location.reload()
        }}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  )
}
