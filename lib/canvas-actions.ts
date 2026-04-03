// ─────────────────────────────────────────────
// TutorKanvas — Canvas Actions Engine
// Parses AI JSON responses into typed canvas actions
// and provides helpers to execute them via the active canvas engine.
// ─────────────────────────────────────────────

import type { CanvasEngine } from '@/lib/canvas-engine/types'
import type { CanvasAction, AICanvasResponse, GameConfig } from '@/types'

let canvasShapeCounter = 0

function nextCanvasShapeId(prefix: string): string {
  canvasShapeCounter += 1
  return `shape:canvas-${prefix}-${canvasShapeCounter}`
}

// ── Font-size mapping ─────────────────────────

const FONT_SIZE_MAP = {
  sm: 's',
  md: 'm',
  lg: 'l',
  xl: 'xl',
} as const

// ── Shape-type mapping ────────────────────────

const GEO_TYPE_MAP: Record<string, 'rectangle' | 'ellipse'> = {
  rectangle: 'rectangle',
  ellipse:   'ellipse',
  circle:    'ellipse',
  line:      'rectangle',     // closest native geo
  numberLine: 'rectangle',
}

// ── Color helper ──────────────────────────────

const CANVAS_COLORS = [
  'black', 'grey', 'light-violet', 'violet', 'blue',
  'light-blue', 'yellow', 'orange', 'green', 'light-green',
  'light-red', 'red', 'white',
] as const

function toCanvasColor(color?: string): string {
  if (!color) return 'black'
  const lower = color.toLowerCase()
  if (CANVAS_COLORS.includes(lower as typeof CANVAS_COLORS[number])) return lower
  if (lower.includes('purple') || lower.includes('pink') && lower.includes('violet')) return 'violet'
  if (lower.includes('pink'))   return 'light-red'
  if (lower.includes('gray'))   return 'grey'
  if (lower.includes('teal') || lower.includes('cyan'))  return 'light-blue'
  if (lower.includes('lime'))   return 'light-green'
  return 'black'
}

// ── executeCanvasActions ──────────────────────

/**
 * Execute a list of CanvasAction objects against the active canvas engine.
 *
 * Action types handled:
 *  - add_text    → text shape
 *  - add_shape   → shape or arrow
 *  - add_card    → chalk-style explanatory text
 *  - add_game    → silently ignored (rendered in AIResponseCard overlay)
 *  - speak       → silently ignored (handled by voice hook)
 *  - suggest_game→ silently ignored
 *
 * Legacy action types (write_text / draw_shape / highlight / clear) are
 * forwarded to their modern equivalents for backwards compatibility.
 */
export function executeCanvasActions(engine: CanvasEngine, actions: CanvasAction[]): string[] {
  if (!engine || !actions.length) return []

  const createdShapeIds: string[] = []

  for (const action of actions) {
    const type = (action as { type: string }).type

    // ── Legacy: clear ─────────────────────────────────────────────
    if (type === 'clear') {
      const ids = engine.listElementIds()
      if (ids.length) engine.deleteByIds(ids)
      continue
    }

    switch (action.type) {
      // ── add_text ───────────────────────────────────────────────
      case 'add_text': {
        const id = engine.addText({
          x: action.x,
          y: action.y,
          text: action.content,
          size: FONT_SIZE_MAP[action.style?.fontSize ?? 'md'] ?? 'm',
          color: toCanvasColor(action.style?.color),
          width: 300,
          autoSize: true,
          metadata: {
            transient: true,
            programmaticSource: 'ai',
            runtimeRole: 'canvas-action-text',
          },
        })
        createdShapeIds.push(id)
        break
      }

      // ── add_shape ──────────────────────────────────────────────
      case 'add_shape': {
        const w = action.props.width ?? 200
        const h = action.props.height ?? 120
        const color = toCanvasColor(action.props.color)

        if (action.shape === 'arrow') {
          const id = engine.addArrow({
            x: action.x,
            y: action.y,
            endX: action.x + w,
            endY: action.y,
            color,
            metadata: {
              transient: true,
              programmaticSource: 'ai',
              runtimeRole: 'canvas-action-arrow',
            },
          })
          createdShapeIds.push(id)
        } else if (GEO_TYPE_MAP[action.shape] === 'ellipse') {
          const id = engine.addEllipse({
            x: action.x,
            y: action.y,
            width: w,
            height: h,
            color,
            fill: 'none',
            metadata: {
              transient: true,
              programmaticSource: 'ai',
              runtimeRole: 'canvas-action-shape',
            },
          })
          createdShapeIds.push(id)
          if (action.props.label) {
            createdShapeIds.push(engine.addText({
              x: action.x + 12,
              y: action.y + 12,
              text: action.props.label,
              color,
              width: Math.max(80, w - 24),
              align: 'middle',
              metadata: {
                transient: true,
                programmaticSource: 'ai',
                runtimeRole: 'canvas-action-shape-label',
              },
            }))
          }
        } else {
          const id = engine.addRectangle({
            x: action.x,
            y: action.y,
            width: w,
            height: h,
            color,
            fill: 'none',
            metadata: {
              transient: true,
              programmaticSource: 'ai',
              runtimeRole: 'canvas-action-shape',
            },
          })
          createdShapeIds.push(id)
          if (action.props.label) {
            createdShapeIds.push(engine.addText({
              x: action.x + 12,
              y: action.y + 12,
              text: action.props.label,
              color,
              width: Math.max(80, w - 24),
              align: 'middle',
              metadata: {
                transient: true,
                programmaticSource: 'ai',
                runtimeRole: 'canvas-action-shape-label',
              },
            }))
          }
        }
        break
      }

      // ── add_card rendered as chalk text on the board ──────────
      case 'add_card': {
        const title = action.content.title ? `${action.content.title}\n\n` : ''
        const text = title + (action.content.body ?? '')
        const color = action.content.type === 'error' ? 'light-red' : 'white'
        const id = engine.addText({
          x: action.x,
          y: action.y,
          text,
          color,
          size: 'l',
          width: 560,
          autoSize: true,
          metadata: {
            transient: true,
            programmaticSource: 'ai',
            runtimeRole: 'canvas-action-card',
          },
        })
        createdShapeIds.push(id)
        break
      }

      // ── Silently skipped (rendered in overlay) ─────────────────
      case 'add_game':
      case 'speak':
      case 'suggest_game':
        break

      // ── Legacy action aliases ──────────────────────────────────
      default: {
        if (type === 'write_text') {
          const l = action as unknown as { x: number; y: number; text: string }
          createdShapeIds.push(engine.addText({
            x: l.x ?? 100,
            y: l.y ?? 100,
            text: l.text ?? '',
            color: 'black',
            width: 300,
            metadata: {
              transient: true,
              programmaticSource: 'ai',
              runtimeRole: 'legacy-text',
            },
          }))
        } else if (type === 'draw_shape') {
          const l = action as unknown as { x: number; y: number; shape?: string; width?: number; height?: number }
          createdShapeIds.push(engine.addRectangle({
            x: l.x ?? 100,
            y: l.y ?? 100,
            width: l.width ?? 200,
            height: l.height ?? 120,
            color: 'black',
            fill: 'none',
            metadata: {
              transient: true,
              programmaticSource: 'ai',
              runtimeRole: 'legacy-shape',
            },
          }))
        } else if (type === 'highlight') {
          const l = action as unknown as { x: number; y: number; width?: number; height?: number; color?: string }
          createdShapeIds.push(engine.addRectangle({
            x: l.x ?? 100,
            y: l.y ?? 100,
            width: l.width ?? 200,
            height: l.height ?? 60,
            color: toCanvasColor(l.color ?? 'yellow'),
            fill: 'semi',
            metadata: {
              transient: true,
              programmaticSource: 'ai',
              runtimeRole: 'legacy-highlight',
            },
          }))
        }
      }
    }
  }

  return createdShapeIds
}


// ── AI Response Parser ────────────────────────

/**
 * Parse raw AI response string into a structured AICanvasResponse.
 * The AI is instructed to return JSON. If it doesn't, we wrap the
 * plain text in a sensible default response.
 */
export function parseAIResponse(raw: string): AICanvasResponse {
  // Try to extract a JSON block from markdown code fences
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch?.[1]?.trim() ?? raw.trim()

  try {
    const parsed = JSON.parse(jsonStr)
    if (typeof parsed?.error === 'string' && parsed.error.trim()) {
      return {
        message: parsed.error,
        actions: [
          {
            type: 'add_card',
            x: 100,
            y: 100,
            content: {
              type: 'error',
              body: parsed.error,
            },
          },
        ],
      }
    }
    return {
      message:     parsed.message     ?? '',
      actions:     validateActions(parsed.actions ?? []),
      topic:       parsed.topic       ?? undefined,
      suggestGame: parsed.suggestGame ?? false,
      gameConfig:  parsed.gameConfig  ?? undefined,
    }
  } catch {
    // Fallback: treat the whole response as a plain text explanation card
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
}

// ── Action Validator ──────────────────────────

function validateActions(actions: unknown[]): CanvasAction[] {
  if (!Array.isArray(actions)) return []
  return actions.filter(isValidAction)
}

function isValidAction(a: unknown): a is CanvasAction {
  if (typeof a !== 'object' || a === null) return false
  const action = a as Record<string, unknown>
  const validTypes = ['add_text', 'add_shape', 'add_card', 'add_game', 'speak', 'suggest_game']
  return validTypes.includes(action.type as string)
}

// ── Default positions ─────────────────────────

const OFFSET = { x: 120, y: 120 }
const SPACING = 320

export function getDefaultPosition(index: number): { x: number; y: number } {
  return {
    x: OFFSET.x + (index % 3) * SPACING,
    y: OFFSET.y + Math.floor(index / 3) * SPACING,
  }
}

// ── Game Config Builder (for AI-generated games) ──

export function buildFillInBlankConfig(
  question: string,
  answer: string | number,
  topic: string,
  difficulty: 1 | 2 | 3 = 1
): GameConfig {
  return {
    type: 'fill-in-blank',
    question,
    answer,
    topic,
    difficulty,
  }
}

export function buildMultipleChoiceConfig(
  question: string,
  answer: string,
  options: string[],
  topic: string,
  difficulty: 1 | 2 | 3 = 1
): GameConfig {
  return {
    type: 'multiple-choice',
    question,
    answer,
    options,
    topic,
    difficulty,
  }
}

export function buildTimedMathConfig(
  question: string,
  answer: string | number,
  topic: string,
  timeLimit: number = 30,
  difficulty: 1 | 2 | 3 = 1
): GameConfig {
  return {
    type: 'timed-math',
    question,
    answer,
    topic,
    timeLimit,
    difficulty,
  }
}

// ── Action type guards ────────────────────────

export function isGameAction(action: CanvasAction): action is Extract<CanvasAction, { type: 'add_game' }> {
  return action.type === 'add_game'
}

export function isSpeakAction(action: CanvasAction): action is Extract<CanvasAction, { type: 'speak' }> {
  return action.type === 'speak'
}

export function isSuggestGameAction(action: CanvasAction): action is Extract<CanvasAction, { type: 'suggest_game' }> {
  return action.type === 'suggest_game'
}
