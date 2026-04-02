import type {
  AICanvasResponse,
  DemonstrationAction,
  LessonPlacement,
  LessonScene,
  LessonScript,
  LessonStep,
} from '@/types'

const VALID_DEMONSTRATION_TYPES = [
  'place_problem',
  'highlight_symbol',
  'focus_column',
  'cross_out',
  'write_annotation',
  'borrow_from_column',
  'carry_to_column',
  'reveal_result',
  'ask_check_question',
  'pause',
] as const

function extractJson(raw: string): string {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/)
  return jsonMatch?.[1]?.trim() ?? raw.trim()
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isLessonScene(value: unknown): value is LessonScene {
  if (!isObject(value)) return false
  return typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    isObject(value.nodes)
}

function isValidPlacement(value: unknown): value is LessonPlacement {
  return [
    'center',
    'top',
    'right',
    'bottom',
    'left',
    'top-right',
    'top-left',
    'bottom-right',
    'bottom-left',
  ].includes(String(value))
}

function validateDemonstrationActions(actions: unknown[]): DemonstrationAction[] {
  if (!Array.isArray(actions)) return []

  return actions.filter((action): action is DemonstrationAction => {
    if (!isObject(action) || typeof action.type !== 'string') return false
    if (!VALID_DEMONSTRATION_TYPES.includes(action.type as (typeof VALID_DEMONSTRATION_TYPES)[number])) {
      return false
    }

    if (action.type === 'write_annotation' && action.placement !== undefined && !isValidPlacement(action.placement)) {
      return false
    }

    return true
  })
}

function validateLessonSteps(steps: unknown[]): LessonStep[] {
  if (!Array.isArray(steps)) return []

  return steps
    .filter((step): step is Record<string, unknown> => isObject(step) && typeof step.id === 'string' && typeof step.speech === 'string')
    .map((step) => ({
      id: step.id as string,
      speech: step.speech as string,
      teacherNote: typeof step.teacherNote === 'string' ? step.teacherNote : undefined,
      actions: validateDemonstrationActions(Array.isArray(step.actions) ? step.actions : []),
      focusTargets: Array.isArray(step.focusTargets)
        ? step.focusTargets.filter((value): value is string => typeof value === 'string')
        : undefined,
      waitFor: step.waitFor === 'speech_end' || step.waitFor === 'actions_end' || step.waitFor === 'user'
        ? step.waitFor
        : 'speech_end',
    }))
}

export function parseLessonScript(raw: string): LessonScript | null {
  const jsonStr = extractJson(raw)

  try {
    const parsed = JSON.parse(jsonStr)
    if (!isObject(parsed)) return null
    if (typeof parsed.lessonId !== 'string' || typeof parsed.topic !== 'string' || !isLessonScene(parsed.scene)) {
      return null
    }

    const steps = validateLessonSteps(Array.isArray(parsed.steps) ? parsed.steps : [])
    if (steps.length === 0) return null

    return {
      lessonId: parsed.lessonId,
      topic: parsed.topic,
      scene: parsed.scene,
      steps,
    }
  } catch {
    return null
  }
}

export function buildLessonFallbackResponse(raw: string): AICanvasResponse {
  return {
    message: raw,
    actions: [
      {
        type: 'add_card',
        x: 100,
        y: 100,
        content: {
          type: 'explanation',
          body: raw,
        },
      },
    ],
  }
}
