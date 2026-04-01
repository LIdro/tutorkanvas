'use client'
// ─────────────────────────────────────────────
// TutorKanvas — FillInBlank game card
// e.g. "4 + __ = 9"
// ─────────────────────────────────────────────

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { GameConfig } from '@/types'

interface Props {
  config: GameConfig
  onCorrect: (score: number) => void
  onSkip?: () => void
}

export default function FillInBlank({ config, onCorrect, onSkip }: Props) {
  const [value, setValue] = useState('')
  const [state, setState] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [attempts, setAttempts] = useState(0)
  const [hint, setHint] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function check() {
    const userNum = parseFloat(value.trim())
    const correct = parseFloat(String(config.answer))
    const isCorrect = !isNaN(userNum) && Math.abs(userNum - correct) < 0.001
    const next = attempts + 1
    setAttempts(next)

    if (isCorrect) {
      setState('correct')
      // score: 3 stars for first try, 2 for second, 1 for third+
      const stars = next === 1 ? 3 : next === 2 ? 2 : 1
      setTimeout(() => onCorrect(stars), 900)
    } else {
      setState('wrong')
      setValue('')
      if (next >= 2) setHint(true)
      setTimeout(() => setState('idle'), 600)
      setTimeout(() => inputRef.current?.focus(), 650)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-6 w-full max-w-sm mx-auto text-center space-y-5 border border-gray-100 dark:border-gray-700">
      {/* Equation display */}
      <div className="text-4xl font-bold text-gray-800 dark:text-gray-100 tracking-wide">
        {config.question.split('__').map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && (
              <span className={cn(
                'inline-block w-14 border-b-4 mx-2 align-bottom transition-colors',
                state === 'correct' ? 'border-green-500' : state === 'wrong' ? 'border-red-400' : 'border-purple-400'
              )}>
                {state === 'correct' ? <span className="text-green-500">{config.answer}</span> : value}
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Hint */}
      {hint && config.hint && (
        <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-xl px-4 py-2">
          💡 Hint: {config.hint}
        </p>
      )}

      {/* Result feedback */}
      {state === 'correct' && (
        <p className="text-green-600 font-bold text-xl animate-bounce">🎉 Correct!</p>
      )}
      {state === 'wrong' && (
        <p className="text-red-500 font-medium">Not quite — try again!</p>
      )}

      {/* Input */}
      {state !== 'correct' && (
        <div className="flex gap-3 justify-center">
          <input
            ref={inputRef}
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && value && check()}
            placeholder="?"
            autoFocus
            className="w-28 text-center text-2xl font-bold border-2 border-purple-300 dark:border-purple-700 rounded-2xl px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-purple-500 dark:focus:border-purple-400"
          />
          <button onClick={check} disabled={!value}
            className="btn-primary text-xl px-5 py-2">
            ✓
          </button>
        </div>
      )}

      {onSkip && state !== 'correct' && (
        <button onClick={onSkip} className="text-xs text-gray-400 hover:text-gray-600 mt-1">Skip this one</button>
      )}
    </div>
  )
}
