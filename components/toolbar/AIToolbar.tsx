'use client'
// ─────────────────────────────────────────────
// TutorKanvas — AIToolbar
// Snap, camera, mic, ask AI buttons.
// ─────────────────────────────────────────────

import { useRef, useState, useCallback } from 'react'
import { Camera, Mic, MicOff, Bot, Upload, Volume2, VolumeX, Loader2 } from 'lucide-react'
import { cn, fileToBase64, validateImageFile } from '@/lib/utils'
import { getProviderConfig } from '@/lib/security'
import type { LearnerProfile, AICanvasResponse } from '@/types'
import { useVoice } from '@/hooks/useVoice'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'

interface AIToolbarProps {
  profile: LearnerProfile | null
  onAIResponse: (response: AICanvasResponse) => void
  onAskText: (text: string) => void
  isProcessing: boolean
}

export default function AIToolbar({ profile, onAIResponse, onAskText, isProcessing }: AIToolbarProps) {
  const [prompt, setPrompt] = useState('')
  const [imageError, setImageError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { flags, canUseVoiceInput, canUseVoiceOutput } = useFeatureFlags()

  const { voiceState, voiceEnabled, toggleVoice, startRecording, stopRecording } =
    useVoice({
      onTranscript: (text) => {
        setPrompt(text)
        onAskText(text)
      },
    })

  const handleFileUpload = useCallback(async (file: File) => {
    setImageError(null)
    const validation = validateImageFile(file)
    if (!validation.valid) {
      setImageError(validation.error ?? 'Invalid image')
      return
    }
    const base64 = await fileToBase64(file)
    const config = getProviderConfig()
    if (!config) return

    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, providerConfig: config, profile }),
      })
      if (res.ok) {
        const data: AICanvasResponse = await res.json()
        onAIResponse(data)
      } else {
        setImageError('AI could not process the image. Please try again.')
      }
    } catch {
      setImageError('Network error — check your connection and try again.')
    }
  }, [profile, onAIResponse])

  const handleSubmitText = useCallback(() => {
    if (!prompt.trim()) return
    onAskText(prompt.trim())
    setPrompt('')
  }, [prompt, onAskText])

  const isMicActive = voiceState === 'recording'

  return (
    <div className="fixed bottom-24 left-1/2 z-30 w-[min(92vw,760px)] -translate-x-1/2">
      <div className="flex items-center gap-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur rounded-2xl shadow-lg px-3 py-2 border border-purple-100 dark:border-purple-900/50">
        {/* Image upload */}
        {flags.visionAnalysis && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              title="Snap or upload classwork"
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all min-h-[44px]',
                'bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50'
              )}
            >
              <Camera size={18} />
              <span className="hidden sm:inline">Snap</span>
            </button>
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute('capture')
                  fileInputRef.current.click()
                  setTimeout(() => fileInputRef.current?.setAttribute('capture', 'environment'), 500)
                }
              }}
              disabled={isProcessing}
              title="Upload an image"
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all min-h-[44px]',
                'bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50'
              )}
            >
              <Upload size={18} />
              <span className="hidden sm:inline">Upload</span>
            </button>
          </>
        )}

        {/* Text prompt input */}
        {flags.aiTutor && (
          <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
            <input
              type="text"
              placeholder="Ask Max a maths question…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitText()}
              className="flex-1 px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 min-h-[44px]"
            />
            <button
              onClick={handleSubmitText}
              disabled={!prompt.trim() || isProcessing}
              title="Ask AI"
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all min-h-[44px]',
                'bg-green-500 hover:bg-green-600 text-white disabled:opacity-50'
              )}
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
              <span className="hidden sm:inline">Ask</span>
            </button>
          </div>
        )}

        {/* Mic (push-to-talk) */}
        {canUseVoiceInput && (
          <button
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            title={isMicActive ? 'Release to send' : 'Hold to speak'}
            className={cn(
              'flex items-center justify-center w-11 h-11 rounded-xl transition-all',
              isMicActive
                ? 'bg-red-500 text-white scale-110 ring-4 ring-red-300 animate-pulse'
                : 'bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200 dark:hover:bg-orange-800/50 text-orange-600 dark:text-orange-400'
            )}
          >
            {isMicActive ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        )}

        {/* Voice toggle */}
        {canUseVoiceOutput && (
          <button
            onClick={toggleVoice}
            title={voiceEnabled ? 'Mute AI voice' : 'Unmute AI voice'}
            className={cn(
              'flex items-center justify-center w-11 h-11 rounded-xl transition-all',
              voiceEnabled
                ? 'bg-teal-100 dark:bg-teal-900/40 hover:bg-teal-200 dark:hover:bg-teal-800/50 text-teal-600 dark:text-teal-400'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500'
            )}
          >
            {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        )}
      </div>

      {imageError && (
        <p className="mt-2 text-center text-xs text-red-500">{imageError}</p>
      )}
    </div>
  )
}
