import { layoutVerticalAddition, layoutVerticalSubtraction } from '@/lib/layout/arithmetic'
import { buildLongDivisionLessonScript, extractLongDivisionProblem, shouldUseLocalLongDivision } from '@/lib/long-division'
import type { LearnerProfile, LessonScene, LessonScript } from '@/types'

export interface ArithmeticTeachingProblem {
  left: number
  right: number
  operator: '+' | '-'
}

export function shouldUseLessonPlanner(prompt: string): boolean {
  if (shouldUseLocalLongDivision(prompt)) return true

  const normalized = prompt.trim().toLowerCase()
  if (!normalized) return false

  const arithmeticPattern = /\b\d+\s*[\+\-]\s*\d+\b/
  const teachingPattern = /\b(explain|show|teach|work through|step by step|solve)\b/
  const operationPattern = /\b(add|adding|addition|subtract|subtraction|borrow|carry)\b/

  return arithmeticPattern.test(normalized) || (teachingPattern.test(normalized) && operationPattern.test(normalized))
}

export function extractArithmeticTeachingProblem(prompt: string): ArithmeticTeachingProblem | null {
  const normalized = prompt.trim().toLowerCase()
  const arithmeticMatch = normalized.match(/(\d+)\s*([\+\-])\s*(\d+)/)
  if (!arithmeticMatch) return null

  const left = Number(arithmeticMatch[1])
  const operator = arithmeticMatch[2] as '+' | '-'
  const right = Number(arithmeticMatch[3])

  if (Number.isNaN(left) || Number.isNaN(right)) return null

  return { left, right, operator }
}

export function buildLessonSceneFromPrompt(prompt: string, profile: LearnerProfile | null = null): LessonScene | null {
  const divisionProblem = extractLongDivisionProblem(prompt)
  if (divisionProblem) {
    return buildLongDivisionLessonScript(divisionProblem, profile)?.scene ?? null
  }

  const problem = extractArithmeticTeachingProblem(prompt)
  if (!problem) return null

  if (problem.operator === '+') {
    return layoutVerticalAddition({
      minuend: problem.left,
      subtrahend: problem.right,
    })
  }

  return layoutVerticalSubtraction({
    minuend: problem.left,
    subtrahend: problem.right,
  })
}

export function hydrateLessonScriptScene(script: LessonScript, prompt: string): LessonScript {
  const canonicalScene = buildLessonSceneFromPrompt(prompt)
  if (!canonicalScene) return script

  return {
    ...script,
    scene: canonicalScene,
  }
}

export function buildLocalLessonScript(prompt: string, profile: LearnerProfile | null = null): LessonScript | null {
  const divisionProblem = extractLongDivisionProblem(prompt)
  if (divisionProblem) {
    return buildLongDivisionLessonScript(divisionProblem, profile)
  }

  return null
}
