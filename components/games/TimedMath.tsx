'use client'
// ─────────────────────────────────────────────
// TutorKanvas — TimedMath game card
// Rapid-fire arithmetic with countdown timer.
// ─────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { GameConfig } from '@/types'

interface Props {
  config: GameConfig
  onFinish: (score: number, correct: number, total: number) => void
}

const ROUND_SECS = 60 // configurable via config.timeLimit in the future

interface Question { q: string; answer: number }

function generateQuestion(difficulty: 'easy' | 'medium' | 'hard'): Question {
  const ops = difficulty === 'easy' ? ['+', '-'] : difficulty === 'medium' ? ['+', '-', '×'] : ['+', '-', '×', '÷']
  const op = ops[Math.floor(Math.random() * ops.length)]
  let a: number, b: number, answer: number

  if (op === '+') {
    a = Math.floor(Math.random() * (difficulty === 'easy' ? 10 : 50)) + 1
    b = Math.floor(Math.random() * (difficulty === 'easy' ? 10 : 50)) + 1
    answer = a + b
  } else if (op === '-') {
    b = Math.floor(Math.random() * (difficulty === 'easy' ? 9 : 30)) + 1
    a = b + Math.floor(Math.random() * (difficulty === 'easy' ? 10 : 30)) + 1
    answer = a - b
  } else if (op === '×') {
    a = Math.floor(Math.random() * 12) + 1
    b = Math.floor(Math.random() * 12) + 1
    answer = a * b
  } else {
    b = Math.floor(Math.random() * 11) + 2
    answer = Math.floor(Math.random() * 10) + 1
    a = answer * b
  }
  return { q: `${a} ${op} ${b}`, answer }
}

export default function TimedMath({ config, onFinish }: Props) {
  const diffMap: Record<number, 'easy' | 'medium' | 'hard'> = { 1: 'easy', 2: 'medium', 3: 'hard' }
  const diff = diffMap[config.difficulty] ?? 'easy'
  const totalTime = config.timeLimit ?? ROUND_SECS

  const [started, setStarted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(totalTime)
  const [current, setCurrent] = useState<Question>(() => generateQuestion(diff))
  const [input, setInput] = useState('')
  const [correct, setCorrect] = useState(0)
  const [total, setTotal] = useState(0)
  const [flash, setFlash] = useState<'correct' | 'wrong' | null>(null)
  const [finished, setFinished] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setFinished(true)
    // Score: percentage of correct out of total, mapped to 1-3 stars
    const pct = total > 0 ? correct / total : 0
    const stars = pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : 1
    setTimeout(() => onFinish(stars, correct, total), 1500)
  }, [correct, total, onFinish])

  useEffect(() => {
    if (started && !finished) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) { finish(); return 0 }
          return t - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [started, finished, finish])

  function submit() {
    const userNum = parseFloat(input.trim())
    const isCorrect = !isNaN(userNum) && Math.abs(userNum - current.answer) < 0.001
    setTotal((t) => t + 1)
    if (isCorrect) setCorrect((c) => c + 1)
    setFlash(isCorrect ? 'correct' : 'wrong')
    setTimeout(() => setFlash(null), 400)
    setInput('')
    setCurrent(generateQuestion(diff))
    inputRef.current?.focus()
  }

  const pctTime = (timeLeft / totalTime) * 100

  if (!started) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-8 w-full max-w-sm mx-auto text-center space-y-4 border border-gray-100 dark:border-gray-700">
        <div className="text-5xl">⏱️</div>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Speed Maths!</h3>
        <p className="text-gray-500 dark:text-gray-400">Answer as many questions as you can in {totalTime} seconds.</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 capitalize">Difficulty: {diff}</p>
        <button onClick={() => { setStarted(true); setTimeout(() => inputRef.current?.focus(), 100) }}
          className="btn-primary w-full text-lg">
          Start! 🚀
        </button>
      </div>
    )
  }

  if (finished) {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0
    return (
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-8 w-full max-w-sm mx-auto text-center space-y-4 border border-gray-100 dark:border-gray-700">
        <div className="text-6xl">{pct >= 80 ? '🌟' : pct >= 50 ? '⭐' : '💪'}</div>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Time's up!</h3>
        <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">{correct} / {total}</p>
        <p className="text-gray-500 dark:text-gray-400">{pct}% correct — {pct >= 80 ? 'Amazing!' : pct >= 50 ? 'Good job!' : 'Keep practising!'}</p>
      </div>
    )
  }

  return (
    <div className={cn(
      'bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-6 w-full max-w-sm mx-auto space-y-5 transition-all border border-gray-100 dark:border-gray-700',
      flash === 'correct' && 'ring-4 ring-green-400',
      flash === 'wrong' && 'ring-4 ring-red-400',
    )}>
      {/* Timer bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm font-medium">
          <span className="text-gray-600 dark:text-gray-400">⏱️ {timeLeft}s</span>
          <span className="text-purple-600 dark:text-purple-400">✓ {correct}</span>
        </div>
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', pctTime > 30 ? 'bg-purple-400' : 'bg-red-400')}
            style={{ width: `${pctTime}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <p className="text-5xl font-bold text-gray-800 dark:text-gray-100 text-center py-2">{current.q} = ?</p>

      {/* Input */}
      <div className="flex gap-3">
        <input
          ref={inputRef}
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && input && submit()}
          placeholder="?"
          className="flex-1 text-center text-3xl font-bold border-2 border-purple-300 dark:border-purple-700 rounded-2xl px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-purple-500 dark:focus:border-purple-400"
        />
        <button onClick={submit} disabled={!input} className="btn-primary text-2xl px-5">✓</button>
      </div>
    </div>
  )
}
