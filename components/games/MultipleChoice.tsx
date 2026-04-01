'use client'
// ─────────────────────────────────────────────
// TutorKanvas — MultipleChoice game card
// ─────────────────────────────────────────────

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { GameConfig } from '@/types'

interface Props {
  config: GameConfig
  onCorrect: (score: number) => void
  onSkip?: () => void
}

export default function MultipleChoice({ config, onCorrect, onSkip }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set())

  function choose(optionId: string) {
    if (selected !== null) return
    const isCorrect = optionId === String(config.answer)
    const next = attempts + 1
    setAttempts(next)

    if (isCorrect) {
      setSelected(optionId)
      const stars = next === 1 ? 3 : next === 2 ? 2 : 1
      setTimeout(() => onCorrect(stars), 1000)
    } else {
      setWrongIds((prev) => new Set([...prev, optionId]))
      // brief shake effect — reset selection so another option can be chosen
      setTimeout(() => {}, 300)
    }
  }

  const rawOptions = config.options ?? []
  const options: Array<{ id: string; text: string }> = rawOptions.map((o, i) =>
    typeof o === 'string' ? { id: String(i), text: o } : o
  )

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-6 w-full max-w-sm mx-auto space-y-5 border border-gray-100 dark:border-gray-700">
      {/* Question */}
      <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center">{config.question}</p>

      {/* Options grid */}
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const isCorrect = opt.id === String(config.answer)
          const isWrong = wrongIds.has(opt.id)
          const isChosen = selected === opt.id
          return (
            <button
              key={opt.id}
              disabled={wrongIds.has(opt.id) || selected !== null}
              onClick={() => choose(opt.id)}
              className={cn(
                'py-4 px-3 rounded-2xl text-lg font-bold border-2 transition-all',
                isChosen && isCorrect && 'bg-green-100 dark:bg-green-900/40 border-green-500 text-green-700 dark:text-green-400 scale-105',
                isWrong && 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-300 line-through opacity-60',
                !isChosen && !isWrong && 'border-purple-200 dark:border-purple-800 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-gray-800 dark:text-gray-100',
              )}
            >
              {opt.text}
            </button>
          )
        })}
      </div>

      {selected && <p className="text-green-600 dark:text-green-400 font-bold text-xl text-center animate-bounce">🎉 Correct!</p>}
      {wrongIds.size > 0 && !selected && (
        <p className="text-amber-600 dark:text-amber-400 text-sm text-center">Not quite — keep trying!</p>
      )}

      {onSkip && !selected && (
        <button onClick={onSkip} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-center w-full">Skip this one</button>
      )}
    </div>
  )
}
