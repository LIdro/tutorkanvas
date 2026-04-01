'use client'
// ─────────────────────────────────────────────
// TutorKanvas — useVoice Hook
// Handles push-to-talk, STT, and TTS with
// graceful fallback to Web Speech API.
// ─────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from 'react'
import { getDeepgramKey, getDeepgramVoice, getVoiceEnabled, saveVoiceEnabled } from '@/lib/security'

export type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking'

interface UseVoiceOptions {
  onTranscript: (text: string) => void
}

// Browser speech recognition type shim
type AnySpeechRecognition = typeof window extends { SpeechRecognition: infer T } ? T : typeof window extends { webkitSpeechRecognition: infer T } ? T : never

export function useVoice({ onTranscript }: UseVoiceOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [voiceEnabled, setVoiceEnabledState] = useState(true)
  const [hasMicSupport, setHasMicSupport] = useState(false)
  const [hasSpeechSupport, setHasSpeechSupport] = useState(false)
  const [hasDeepgram, setHasDeepgram] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    setHasMicSupport(!!navigator.mediaDevices?.getUserMedia)
    setHasSpeechSupport('speechSynthesis' in window)
    setHasDeepgram(!!getDeepgramKey())
    setVoiceEnabledState(getVoiceEnabled())
  }, [])

  const toggleVoice = useCallback(() => {
    const next = !voiceEnabled
    setVoiceEnabledState(next)
    saveVoiceEnabled(next)
  }, [voiceEnabled])

  // ── Push-to-talk start ─────────────────────

  const startRecording = useCallback(async () => {
    if (voiceState !== 'idle') return
    setVoiceState('recording')
    audioChunksRef.current = []

    const deepgramKey = getDeepgramKey()

    if (deepgramKey) {
      // Use MediaRecorder + Deepgram
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream)
        mediaRecorderRef.current = recorder
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        recorder.start()
      } catch {
        setVoiceState('idle')
      }
    } else {
      // Use Web Speech API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      const SpeechRecognitionCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition
      if (!SpeechRecognitionCtor) {
        setVoiceState('idle')
        return
      }
      const recognition = new SpeechRecognitionCtor()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'
      speechRecognitionRef.current = recognition

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript ?? ''
        if (transcript) onTranscript(transcript)
        setVoiceState('idle')
      }
      recognition.onerror = () => setVoiceState('idle')
      recognition.onend = () => setVoiceState('idle')
      recognition.start()
    }
  }, [voiceState, onTranscript])

  // ── Push-to-talk stop ──────────────────────

  const stopRecording = useCallback(async () => {
    if (voiceState !== 'recording') return
    setVoiceState('processing')

    const deepgramKey = getDeepgramKey()

    if (deepgramKey && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop())

      await new Promise<void>((resolve) => {
        mediaRecorderRef.current!.onstop = () => resolve()
      })

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      try {
        const res = await fetch('/api/stt', {
          method: 'POST',
          headers: { Authorization: `Token ${deepgramKey}` },
          body: audioBlob,
        })
        if (res.status === 200) {
          const data = await res.json()
          if (data.transcript) onTranscript(data.transcript)
        }
      } catch {
        // silently fail — child just types instead
      }
      setVoiceState('idle')
    } else {
      // Web Speech API handles its own stop
      speechRecognitionRef.current?.stop()
    }
  }, [voiceState, onTranscript])

  // ── Text-to-Speech ─────────────────────────

  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled || !text.trim()) return
    setVoiceState('speaking')

    const deepgramKey = getDeepgramKey()
    const voice = getDeepgramVoice()

    if (deepgramKey) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${deepgramKey}`,
          },
          body: JSON.stringify({ text, voice }),
        })

        if (res.status === 200) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => {
            setVoiceState('idle')
            URL.revokeObjectURL(url)
          }
          await audio.play()
          return
        }
      } catch {
        // fall through to browser TTS
      }
    }

    // Browser TTS fallback
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.95
      utterance.pitch = 1.1
      utterance.onend = () => setVoiceState('idle')
      window.speechSynthesis.speak(utterance)
    } else {
      setVoiceState('idle')
    }
  }, [voiceEnabled])

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause()
    window.speechSynthesis?.cancel()
    setVoiceState('idle')
  }, [])

  return {
    voiceState,
    voiceEnabled,
    hasMicSupport,
    hasSpeechSupport,
    hasDeepgram,
    canUseVoiceInput: hasMicSupport,
    canUseVoiceOutput: hasSpeechSupport || hasDeepgram,
    toggleVoice,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking,
  }
}
