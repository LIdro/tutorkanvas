'use client'
// ─────────────────────────────────────────────
// TutorKanvas — Main Canvas Page
// Wires together: CanvasWrapper, Toolbar, AIToolbar,
// ProfilePicker and SettingsPanel.
// ─────────────────────────────────────────────

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import CanvasWrapper, { type CanvasWrapperRef } from '@/components/canvas/CanvasWrapper'
import Toolbar from '@/components/toolbar/Toolbar'
import AIToolbar from '@/components/toolbar/AIToolbar'
import SettingsPanel from '@/components/settings/SettingsPanel'
import ProfilePicker from '@/components/ui/ProfilePicker'
import SessionPicker from '@/components/ui/SessionPicker'
import { useLearnerProfile } from '@/hooks/useLearnerProfile'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useVoice } from '@/hooks/useVoice'
import {
  getExplanationStepPauseMs,
  getProviderConfig,
  hasMinimumSetup,
  isSetupComplete,
} from '@/lib/security'
import { parseAIResponse } from '@/lib/canvas-actions'
import { parseLessonScript } from '@/lib/lesson-script'
import { buildLocalLessonScript, hydrateLessonScriptScene, shouldUseLessonPlanner } from '@/lib/lesson-planner'
import { createSession, appendMessage, saveCanvasState } from '@/lib/session'
import { getEffectiveUserId, isDevAuthBypassClient, useAuthSafe } from '@/lib/dev-auth'
import { logInteraction } from '@/lib/ai-logger'
import { buildSystemPrompt, buildLessonPlannerPrompt, buildVisionPrompt } from '@/lib/prompts'
import type { AICanvasResponse, LessonScript, TKSession } from '@/types'

const CHAT_REQUEST_TIMEOUT_MS = 45000
const VISION_REQUEST_TIMEOUT_MS = 45000
const CONTINUATION_REQUEST_TIMEOUT_MS = 12000
const MAX_CONTINUATION_PASSES = 3
const GENERIC_ERROR_MESSAGE = 'I ran into a problem. Please try again.'
const NETWORK_ERROR_MESSAGE = 'I could not reach the AI service just now. Please try again.'

function getResponseDisplayText(response: AICanvasResponse): string {
  const speakAction = response.actions.find((a): a is Extract<typeof response.actions[number], { type: 'speak' }> => a.type === 'speak')
  const addCardAction = response.actions.find((a): a is Extract<typeof response.actions[number], { type: 'add_card' }> => a.type === 'add_card')
  const addTextAction = response.actions.find((a): a is Extract<typeof response.actions[number], { type: 'add_text' }> => a.type === 'add_text')

  return (
    speakAction?.text ??
    response.message ??
    addCardAction?.content.body ??
    addTextAction?.content ??
    ''
  ).trim()
}

function isTechnicalErrorMessage(text: string): boolean {
  const normalized = text.trim()
  if (!normalized) return false

  return (
    /validationerror|syntaxerror|referenceerror|typeerror|networkerror/i.test(normalized) ||
    /expected a valid url|invalid protocol|failed to fetch|request failed|timed out|unauthorized|forbidden/i.test(normalized) ||
    normalized.includes(' at ') ||
    normalized.includes('/api/')
  )
}

function toGracefulErrorMessage(rawMessage: string): string {
  if (/failed to fetch|networkerror|timed out/i.test(rawMessage)) {
    return NETWORK_ERROR_MESSAGE
  }

  return GENERIC_ERROR_MESSAGE
}

function buildGracefulErrorResponse(rawMessage: string): AICanvasResponse {
  return {
    message: toGracefulErrorMessage(rawMessage),
    actions: [
      {
        type: 'add_card',
        x: 100,
        y: 100,
        content: {
          type: 'error',
          body: toGracefulErrorMessage(rawMessage),
        },
      },
    ],
  }
}

function getSpeechTextForResponse(response: AICanvasResponse): string {
  const displayText = getResponseDisplayText(response)
  if (!displayText) return ''

  const hasErrorCard = response.actions.some(
    (action) => action.type === 'add_card' && action.content.type === 'error'
  )

  if (hasErrorCard || isTechnicalErrorMessage(displayText)) {
    return toGracefulErrorMessage(displayText)
  }

  return displayText
}

export default function CanvasPage() {
  const router = useRouter()
  const { isLoaded, userId } = useAuthSafe()
  const bypassEnabled = isDevAuthBypassClient()
  const effectiveUserId = getEffectiveUserId(userId, bypassEnabled)
  const canvasRef = useRef<CanvasWrapperRef>(null)
  const { activeProfile, selectProfile } = useLearnerProfile()
  const flags = useFeatureFlags()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profilePickerOpen, setProfilePickerOpen] = useState(false)
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [session, setSession] = useState<TKSession | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [teacherNote, setTeacherNote] = useState<string | null>(null)
  const shouldHideCanvasOverlays = settingsOpen || profilePickerOpen || sessionPickerOpen

  useEffect(() => {
    document.body.classList.toggle('tk-hide-canvas-overlays', shouldHideCanvasOverlays)
    return () => {
      document.body.classList.remove('tk-hide-canvas-overlays')
    }
  }, [shouldHideCanvasOverlays])

  const { speak } = useVoice({
    onTranscript: (text) => handlePrompt(text),
  })

  // Redirect to setup if not configured
  useEffect(() => {
    if (!isLoaded && !bypassEnabled) return
    if (!effectiveUserId) {
      router.replace('/sign-in')
      return
    }
    if (!isSetupComplete() && !hasMinimumSetup()) {
      router.replace('/setup')
    }
  }, [bypassEnabled, effectiveUserId, isLoaded, router])

  // Init session + show profile picker
  useEffect(() => {
    if ((!isLoaded && !bypassEnabled) || !effectiveUserId) return
    async function init() {
      try {
        const s = await createSession(
          activeProfile?.id ?? 'guest',
          `Session — ${new Date().toLocaleDateString()}`,
        )
        setSession(s)
        setProfilePickerOpen(true)
      } catch {
        // createSession falls back to IndexedDB; this catch guards unexpected errors
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id, bypassEnabled, effectiveUserId, isLoaded])

  async function handlePrompt(text: string, imageBase64?: string) {
    setIsLoading(true)
    const t0 = Date.now()
    try {
      if (!imageBase64) {
        const localLessonScript = buildLocalLessonScript(text, activeProfile ?? null)
        if (localLessonScript) {
          console.info('[lesson] Using local structured lesson:', localLessonScript.lessonId)
          const cfg0 = getProviderConfig()
          void logInteraction({
            sessionId: session?.id ?? null,
            profileId: activeProfile?.id ?? null,
            provider: cfg0?.id ?? 'local',
            model: cfg0?.model ?? 'local',
            responseMode: 'lesson_script',
            systemPrompt: '(local built-in lesson — no LLM call)',
            inputMessages: [{ role: 'user', content: text }],
            rawResponse: JSON.stringify(localLessonScript),
            parsedActions: null,
            parsedLessonScript: localLessonScript,
            topic: localLessonScript.topic ?? null,
            latencyMs: Date.now() - t0,
            isError: false,
            hadImage: false,
          })
          await playLessonScript(localLessonScript, text)
          return
        }
      }

      const cfg = getProviderConfig()
      if (!cfg) return

      if (imageBase64) {
        // ── Vision path ──────────────────────────
        const systemPrompt = buildVisionPrompt(activeProfile ?? null)
        const res = await fetchWithTimeout('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, prompt: text, providerConfig: cfg, profile: activeProfile }),
        }, VISION_REQUEST_TIMEOUT_MS)
        const latencyMs = Date.now() - t0
        if (res.ok) {
          const data: AICanvasResponse = await res.json()
          // Log before presenting so we capture all artifacts
          void logInteraction({
            sessionId: session?.id ?? null,
            profileId: activeProfile?.id ?? null,
            provider: cfg.id,
            model: cfg.model,
            responseMode: 'vision',
            systemPrompt,
            inputMessages: [{ role: 'user', content: `[image attached] ${text}` }],
            rawResponse: JSON.stringify(data),
            parsedActions: data.actions ?? null,
            parsedLessonScript: null,
            topic: data.topic ?? null,
            latencyMs,
            isError: false,
            hadImage: true,
          })
          await presentCanvasResponse(data)
          const spokenText = getResponseDisplayText(data)
          if (session) await appendMessage(session.id, { role: 'user', content: `[image] ${text}` })
          if (session && spokenText) await appendMessage(session.id, { role: 'assistant', content: spokenText })
        } else {
          const errText = await res.text().catch(() => 'Vision request failed')
          void logInteraction({
            sessionId: session?.id ?? null,
            profileId: activeProfile?.id ?? null,
            provider: cfg.id,
            model: cfg.model,
            responseMode: 'vision',
            systemPrompt,
            inputMessages: [{ role: 'user', content: `[image attached] ${text}` }],
            rawResponse: errText,
            latencyMs,
            isError: true,
            errorMessage: errText,
            hadImage: true,
          })
          throw new Error(errText || 'Vision request failed')
        }
      } else {
        // ── Chat / lesson-planner path ───────────
        const useLessonPlanner = shouldUseLessonPlanner(text)
        const responseMode = useLessonPlanner ? 'lesson_script' : 'canvas'
        const systemPrompt = useLessonPlanner
          ? buildLessonPlannerPrompt(activeProfile ?? null)
          : buildSystemPrompt(activeProfile ?? null)

        const res = await fetchWithTimeout('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: text }],
            providerConfig: cfg,
            profile: activeProfile,
            responseMode,
          }),
        }, CHAT_REQUEST_TIMEOUT_MS)
        if (!res.ok) {
          const errText = await res.text().catch(() => 'Chat request failed')
          throw new Error(errText || 'Chat request failed')
        }

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
              try {
                const parsed = JSON.parse(data) as { chunk?: string; error?: string }
                if (parsed.error) {
                  throw new Error(parsed.error)
                }
                raw += parsed.chunk ?? ''
              } catch (err) {
                if (err instanceof Error) {
                  throw err
                }
                raw += data
              }
            }
          }
        }

        const latencyMs = Date.now() - t0

        if (!raw.trim()) {
          throw new Error('AI returned an empty response.')
        }

        if (useLessonPlanner) {
          const lessonScript = parseLessonScript(raw)
          if (lessonScript) {
            void logInteraction({
              sessionId: session?.id ?? null,
              profileId: activeProfile?.id ?? null,
              provider: cfg.id,
              model: cfg.model,
              responseMode: 'lesson_script',
              systemPrompt,
              inputMessages: [{ role: 'user', content: text }],
              rawResponse: raw,
              parsedActions: null,
              parsedLessonScript: lessonScript,
              topic: lessonScript.topic ?? null,
              latencyMs,
              isError: false,
              hadImage: false,
            })
            await playLessonScript(hydrateLessonScriptScene(lessonScript, text), text)
            return
          }
        }

        const parsed = parseAIResponse(raw)
        const finalResponse = await maybeExpandBriefExplanation({
          originalPrompt: text,
          response: parsed,
          providerConfig: cfg,
          profile: activeProfile ?? null,
        })
        void logInteraction({
          sessionId: session?.id ?? null,
          profileId: activeProfile?.id ?? null,
          provider: cfg.id,
          model: cfg.model,
          responseMode: 'canvas',
          systemPrompt,
          inputMessages: [{ role: 'user', content: text }],
          rawResponse: raw,
          parsedActions: finalResponse.actions ?? null,
          parsedLessonScript: null,
          topic: finalResponse.topic ?? null,
          latencyMs,
          isError: false,
          hadImage: false,
        })
        await presentCanvasResponse(finalResponse)
        const spokenText = getResponseDisplayText(finalResponse)
        if (session) {
          await appendMessage(session.id, { role: 'user', content: text })
          if (spokenText) await appendMessage(session.id, { role: 'assistant', content: spokenText })
        }
      }
    } catch (err) {
      console.error('AI request failed:', err)
      const message = err instanceof Error ? err.message : 'AI request failed.'
      const gracefulResponse = buildGracefulErrorResponse(message)
      const cfg2 = getProviderConfig()
      if (cfg2) {
        void logInteraction({
          sessionId: session?.id ?? null,
          profileId: activeProfile?.id ?? null,
          provider: cfg2.id,
          model: cfg2.model,
          responseMode: imageBase64 ? 'vision' : 'canvas',
          systemPrompt: '',
          inputMessages: [{ role: 'user', content: imageBase64 ? `[image] ${text}` : text }],
          rawResponse: message,
          latencyMs: Date.now() - t0,
          isError: true,
          errorMessage: message,
          hadImage: !!imageBase64,
        })
      }
      await presentCanvasResponse(gracefulResponse)
    } finally {
      setIsLoading(false)
    }
  }

  async function presentCanvasResponse(nextResponse: AICanvasResponse) {
    const spokenText = getSpeechTextForResponse(nextResponse)
    const pauseMs = getExplanationStepPauseMs()

    if (spokenText && isChalkboardExplanation(nextResponse)) {
      const segments = splitExplanationIntoSegments(spokenText)
      await canvasRef.current?.playChalkTalk(segments, {
        stepPauseMs: pauseMs,
        speak: flags.canUseVoiceOutput
          ? async (segment) => {
              await speak(segment)
            }
          : undefined,
      })
      return
    }

    canvasRef.current?.executeActions(nextResponse.actions)
    if (spokenText && flags.canUseVoiceOutput) {
      await speak(spokenText)
    }
  }

  async function maybeExpandBriefExplanation({
    originalPrompt,
    response,
    providerConfig,
    profile,
  }: {
    originalPrompt: string
    response: AICanvasResponse
    providerConfig: NonNullable<ReturnType<typeof getProviderConfig>>
    profile: typeof activeProfile | null
  }): Promise<AICanvasResponse> {
    let combinedText = getResponseDisplayText(response)
    if (!needsContinuationNudge(originalPrompt, combinedText)) return response

    try {
      for (let pass = 0; pass < MAX_CONTINUATION_PASSES; pass += 1) {
        if (!needsContinuationNudge(originalPrompt, combinedText)) break

        const continuationText = await requestExplanationContinuation({
          originalPrompt,
          currentText: combinedText,
          providerConfig,
          profile,
        })
        if (!continuationText) break

        combinedText = `${combinedText}\n\n${continuationText}`.trim()
      }

      if (combinedText === getResponseDisplayText(response)) return response

      return {
        ...response,
        topic: response.topic,
        message: combinedText,
        actions: [{ type: 'speak', text: combinedText }],
      }
    } catch {
      return response
    }
  }

  async function playLessonScript(script: LessonScript, userPrompt: string) {
    const combinedSpeech = script.steps.map((step) => step.speech).filter(Boolean).join('\n')
    setTeacherNote(script.steps[0]?.teacherNote ?? null)

    await canvasRef.current?.playLessonScript(script, {
      speak: flags.canUseVoiceOutput
        ? async (text) => {
            await speak(text)
          }
        : undefined,
      onStepStart: (step) => {
        console.info('[lesson] Starting step:', step.id, step.teacherNote ?? '')
        setTeacherNote(step.teacherNote ?? null)
      },
      stepPauseMs: getExplanationStepPauseMs(),
    })

    setTeacherNote(null)

    if (session) {
      await appendMessage(session.id, { role: 'user', content: userPrompt })
      await appendMessage(session.id, { role: 'assistant', content: combinedSpeech })
    }
  }

  if (!isLoaded && !bypassEnabled) {
    return (
      <main className="flex h-screen items-center justify-center bg-white text-sm text-gray-500 dark:bg-gray-950 dark:text-gray-400">
        Loading TutorKanvas…
      </main>
    )
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
    setHasChanges(false)
    canvasRef.current?.clear()
  }

  async function handleExportPng() {
    await canvasRef.current?.exportPng()
  }

  function handleClearCanvas() {
    if (!confirm('Clear the canvas? This cannot be undone.')) return
    canvasRef.current?.clear()
    setHasChanges(true)
  }

  const handleCanvasChange = useCallback(async (snapshot: object) => {
    setHasChanges(true)
    if (session) await saveCanvasState(session.id, snapshot)
  }, [session])

  return (
    <main className="w-screen h-screen overflow-hidden">
      <div className="fixed right-4 top-16 z-30">
        {bypassEnabled ? (
          <div className="rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">
            Local mode
          </div>
        ) : (
          <UserButton />
        )}
      </div>

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
          key={session?.id ?? 'new'}
          ref={canvasRef}
          sessionId={session?.id}
          initialSnapshot={session?.canvasState ?? null}
          onCanvasChange={handleCanvasChange}
        />
      </div>

      {teacherNote && !shouldHideCanvasOverlays && (
        <div className="pointer-events-none fixed right-6 top-20 z-30 max-w-[220px] rounded-2xl border border-amber-300/70 bg-[#1e2a1f]/95 px-4 py-3 text-white shadow-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">Teacher note</p>
          <p className="mt-2 text-lg font-semibold leading-tight">{teacherNote}</p>
        </div>
      )}

      {/* Bottom AI toolbar */}
      {!shouldHideCanvasOverlays && (
        <AIToolbar
          profile={activeProfile ?? null}
          onAIResponse={(res) => { void presentCanvasResponse(res) }}
          onAskText={(text) => handlePrompt(text)}
          isProcessing={isLoading}
        />
      )}

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
          setHasChanges(false)
          setSessionPickerOpen(false)
        }}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  )
}

async function requestExplanationContinuation({
  originalPrompt,
  currentText,
  providerConfig,
  profile,
}: {
  originalPrompt: string
  currentText: string
  providerConfig: NonNullable<ReturnType<typeof getProviderConfig>>
  profile: unknown
}): Promise<string | null> {
  const res = await fetchWithTimeout('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: originalPrompt },
        { role: 'assistant', content: currentText },
        {
          role: 'user',
          content: 'Continue immediately with the next teaching steps only. Stay on the same maths topic. Give the next 2 or 3 concrete steps, no emojis, no introduction, and do not stop until the method is fully demonstrated.',
        },
      ],
      providerConfig,
      profile,
      responseMode: 'canvas',
    }),
  }, CONTINUATION_REQUEST_TIMEOUT_MS)
  if (!res.ok) return null

  const reader = res.body?.getReader()
  const decoder = new TextDecoder()
  let raw = ''
  while (reader) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data) as { chunk?: string; error?: string }
        if (parsed.error) return null
        raw += parsed.chunk ?? ''
      } catch {
        raw += data
      }
    }
  }

  if (!raw.trim()) return null
  const continuation = parseAIResponse(raw)
  const continuationText = getResponseDisplayText(continuation)
  return continuationText.trim() || null
}

function isChalkboardExplanation(response: AICanvasResponse): boolean {
  return response.actions.every((action) =>
    action.type === 'add_card' ||
    action.type === 'add_text' ||
    action.type === 'speak'
  )
}

function splitExplanationIntoSegments(text: string): string[] {
  const cleaned = text.replace(/\r/g, '').trim()
  if (!cleaned) return []

  const numbered = cleaned
    .split(/\s*(?=(?:Step\s*\d+[:.]|\d+\.\s))/i)
    .map((part) => part.trim())
    .filter(Boolean)

  const sourceSegments = numbered.length > 1 ? numbered : cleaned.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)

  return sourceSegments.flatMap((segment) => chunkSegmentBySentence(segment, 120))
}

function chunkSegmentBySentence(segment: string, maxLength: number): string[] {
  const sentences = segment
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (!sentences.length) return []
  if (sentences.length === 1 && sentences[0].length <= maxLength) return sentences

  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence
    if (current && next.length > maxLength) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current = next
    }
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks
}

function needsContinuationNudge(prompt: string, responseText: string): boolean {
  const normalizedPrompt = prompt.trim().toLowerCase()
  const normalizedResponse = responseText.trim().toLowerCase()
  if (!normalizedPrompt || !normalizedResponse) return false

  const teachingPrompt = /\b(how|show|teach|explain|what is|work through|step by step)\b/.test(normalizedPrompt)
  if (!teachingPrompt) return false

  const segmentCount = splitExplanationIntoSegments(responseText).length
  const hasLaterStep = /(step\s*2|2\.)/i.test(responseText)
  const tooShort = normalizedResponse.length < 180
  const introOnly = /\b(let's break it down|we can use|it is a method|it's a way|i think you mean)\b/.test(normalizedResponse)

  return segmentCount < 2 || !hasLaterStep || tooShort || introOnly
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs / 1000} seconds.`)), timeoutMs)

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`The AI took too long to respond. Please try again.`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
