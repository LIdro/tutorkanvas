'use client'
// ─────────────────────────────────────────────
// TutorKanvas — AIResponseCard
// Floating card rendered on canvas when AI responds.
// Shows typing animation, canvas action results,
// and game suggestion prompt.
// ─────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { AICanvasResponse, CanvasAction, GameConfig } from '@/types'
import FillInBlank from '@/components/games/FillInBlank'
import MultipleChoice from '@/components/games/MultipleChoice'
import TimedMath from '@/components/games/TimedMath'

const TYPING_SPEED = 18 // ms per character

interface Props {
  response: AICanvasResponse | null
  isLoading: boolean
  onGameComplete?: (stars: number) => void
  onDismiss?: () => void
  onSuggestGame?: (action: CanvasAction & { type: 'suggest_game' }) => void
}

function TypingText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('')
  const i = useRef(0)

  useEffect(() => {
    setDisplayed('')
    i.current = 0
    const timer = setInterval(() => {
      i.current++
      setDisplayed(text.slice(0, i.current))
      if (i.current >= text.length) clearInterval(timer)
    }, TYPING_SPEED)
    return () => clearInterval(timer)
  }, [text])

  return <span>{displayed}</span>
}

export default function AIResponseCard({ response, isLoading, onGameComplete, onDismiss, onSuggestGame }: Props) {
  const [gameActive, setGameActive] = useState<GameConfig | null>(null)
  const [gameResult, setGameResult] = useState<{ stars: number; correct?: number; total?: number } | null>(null)

  // Reset game when a new response arrives
  useEffect(() => {
    setGameActive(null)
    setGameResult(null)
  }, [response])

  if (!isLoading && !response) return null

  // Loading skeleton
  if (isLoading && !response) {
    return (
      <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-30 w-[340px] bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-5 border border-purple-100 dark:border-purple-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-200 dark:bg-purple-800 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  if (!response) return null

  const speakAction = response.actions.find((a): a is CanvasAction & { type: 'speak' } => a.type === 'speak')
  const suggestAction = response.actions.find((a): a is CanvasAction & { type: 'suggest_game' } => a.type === 'suggest_game')
  const addGameAction = response.actions.find((a): a is CanvasAction & { type: 'add_game' } => a.type === 'add_game')
  const gameConfig = addGameAction?.game ?? suggestAction?.game

  function handleGameCorrect(stars: number, correct?: number, total?: number) {
    setGameResult({ stars, correct, total })
    setGameActive(null)
    onGameComplete?.(stars)
  }

  const STAR_MAP: Record<number, string> = { 1: '⭐', 2: '⭐⭐', 3: '⭐⭐⭐' }

  return (
    <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-30 w-[360px] max-h-[60vh] overflow-y-auto">
      {/* Main card */}
      {!gameActive && (
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-purple-900/50 overflow-hidden">
          {/* Max avatar + message */}
          {speakAction && (
            <div className="p-5 flex gap-3 items-start">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shrink-0">
                M
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-1">Max says</p>
                <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                  <TypingText text={speakAction.text} />
                </p>
              </div>
            </div>
          )}

          {/* Game result */}
          {gameResult && (
            <div className="mx-4 mb-4 bg-green-50 dark:bg-green-950/40 rounded-2xl p-4 text-center border border-green-100 dark:border-green-800/30">
              <p className="text-2xl">{STAR_MAP[gameResult.stars] ?? '⭐'}</p>
              <p className="text-green-700 dark:text-green-400 font-semibold text-sm">
                {gameResult.correct !== undefined
                  ? `${gameResult.correct} / ${gameResult.total} correct!`
                  : 'Great job!'}
              </p>
            </div>
          )}

          {/* Suggest game CTA */}
          {suggestAction && !gameResult && (
            <div className="px-5 pb-4 pt-0 space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Want to practise?</p>
              <div className="flex flex-wrap gap-2">
                {gameConfig ? (
                  <button
                    onClick={() => setGameActive(gameConfig)}
                    className="btn-primary text-sm px-4 py-2">
                    Play a game! 🎮
                  </button>
                ) : (
                  <button
                    onClick={() => onSuggestGame?.(suggestAction)}
                    className="btn-primary text-sm px-4 py-2">
                    Yes, let&#39;s play! 🎮
                  </button>
                )}
                <button onClick={onDismiss} className="btn-secondary text-sm px-4 py-2">Maybe later</button>
              </div>
            </div>
          )}

          {/* Dismiss button (no game suggestion) */}
          {!suggestAction && onDismiss && (
            <div className="px-5 pb-4 flex justify-end">
              <button onClick={onDismiss} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">Dismiss ×</button>
            </div>
          )}
        </div>
      )}

      {/* Active game card */}
      {gameActive && gameActive.type === 'fill-in-blank' && (
        <FillInBlank
          config={gameActive as any}
          onCorrect={(s) => handleGameCorrect(s)}
          onSkip={() => setGameActive(null)}
        />
      )}
      {gameActive && gameActive.type === 'multiple-choice' && (
        <MultipleChoice
          config={gameActive as any}
          onCorrect={(s) => handleGameCorrect(s)}
          onSkip={() => setGameActive(null)}
        />
      )}
      {gameActive && gameActive.type === 'timed-math' && (
        <TimedMath
          config={gameActive as any}
          onFinish={(s, correct, total) => handleGameCorrect(s, correct, total)}
        />
      )}
    </div>
  )
}
