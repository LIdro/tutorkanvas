// ─────────────────────────────────────────────
// TutorKanvas — Canvas Actions Engine
// Parses AI JSON responses into typed canvas actions
// and provides helpers to execute them via tldraw.
// ─────────────────────────────────────────────

import type { Editor } from 'tldraw'
import type { CanvasAction, AICanvasResponse, GameConfig } from '@/types'

let canvasShapeCounter = 0

function nextCanvasShapeId(prefix: string): string {
  canvasShapeCounter += 1
  return `shape:canvas-${prefix}-${canvasShapeCounter}`
}

// ── TLRichText helper ─────────────────────────

/**
 * Build a minimal ProseMirror doc (TLRichText) from a plain string.
 * Uses the same structure as tldraw's built-in toRichText() export.
 * We keep this local to avoid pulling the full tldraw bundle into
 * server-side code paths (API routes, etc.).
 */
function toRichText(plain: string) {
  // Split on newlines to produce separate paragraphs
  const lines = plain.split('\n')
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line
        ? [{ type: 'text', text: line }]
        : [],
    })),
  }
}

// ── Font-size mapping ─────────────────────────

const FONT_SIZE_MAP = {
  sm: 's',
  md: 'm',
  lg: 'l',
  xl: 'xl',
} as const

type TldrawSize  = 's' | 'm' | 'l' | 'xl'
type TldrawColor = 'black' | 'grey' | 'light-violet' | 'violet' | 'blue' |
                   'light-blue' | 'yellow' | 'orange' | 'green' | 'light-green' |
                   'light-red' | 'red' | 'white'
type TldrawGeo   = 'rectangle' | 'ellipse' | 'triangle' | 'diamond' |
                   'arrow-left' | 'arrow-right' | 'arrow-up' | 'arrow-down' |
                   'oval' | 'cloud' | 'heart' | 'hexagon' | 'octagon'
type TldrawFill  = 'none' | 'semi' | 'solid' | 'pattern'
type TldrawDash  = 'draw' | 'solid' | 'dashed' | 'dotted'
type TldrawAlign = 'start' | 'middle' | 'end'
type TldrawFont  = 'draw' | 'sans' | 'serif' | 'mono'

// ── Shape-type mapping ────────────────────────

const GEO_TYPE_MAP: Record<string, TldrawGeo> = {
  rectangle: 'rectangle',
  ellipse:   'ellipse',
  circle:    'ellipse',
  triangle:  'triangle',
  diamond:   'diamond',
  line:      'rectangle',     // closest native geo
  numberLine: 'rectangle',
}

// ── Color helper ──────────────────────────────

const TLDRAW_COLORS: TldrawColor[] = [
  'black', 'grey', 'light-violet', 'violet', 'blue',
  'light-blue', 'yellow', 'orange', 'green', 'light-green',
  'light-red', 'red', 'white',
]

function toTldrawColor(color?: string): TldrawColor {
  if (!color) return 'black'
  const lower = color.toLowerCase()
  if (TLDRAW_COLORS.includes(lower as TldrawColor)) return lower as TldrawColor
  if (lower.includes('purple') || lower.includes('pink') && lower.includes('violet')) return 'violet'
  if (lower.includes('pink'))   return 'light-red'
  if (lower.includes('gray'))   return 'grey'
  if (lower.includes('teal') || lower.includes('cyan'))  return 'light-blue'
  if (lower.includes('lime'))   return 'light-green'
  return 'black'
}

// ── executeCanvasActions ──────────────────────

/**
 * Execute a list of CanvasAction objects against the live tldraw Editor.
 *
 * Action types handled:
 *  - add_text    → tldraw text shape (uses richText)
 *  - add_shape   → geo shape (rectangle, ellipse, …) or arrow
 *  - add_card    → note shape (sticky note, uses richText)
 *  - add_game    → silently ignored (rendered in AIResponseCard overlay)
 *  - speak       → silently ignored (handled by voice hook)
 *  - suggest_game→ silently ignored
 *
 * Legacy action types (write_text / draw_shape / highlight / clear) are
 * forwarded to their modern equivalents for backwards compatibility.
 */
export function executeCanvasActions(editor: Editor, actions: CanvasAction[]): string[] {
  if (!editor || !actions.length) return []

  const createdShapeIds: string[] = []

  editor.run(() => {
    for (const action of actions) {
      const type = (action as { type: string }).type

      // ── Legacy: clear ─────────────────────────────────────────────
      if (type === 'clear') {
        const ids = [...editor.getCurrentPageShapeIds()]
        if (ids.length) editor.deleteShapes(ids)
        continue
      }

      switch (action.type) {
        // ── add_text ───────────────────────────────────────────────
        case 'add_text': {
          const id = nextCanvasShapeId('text')
          const size  = (FONT_SIZE_MAP[action.style?.fontSize ?? 'md'] ?? 'm') as TldrawSize
          const color = toTldrawColor(action.style?.color)
          editor.createShape({
            id,
            type: 'text',
            x: action.x,
            y: action.y,
            props: {
              richText: toRichText(action.content) as any,
              size,
              color,
              font:     'draw' as TldrawFont,
              textAlign: 'start' as TldrawAlign,
              autoSize: true,
              w: 300,
              scale: 1,
            },
          } as any)
          createdShapeIds.push(id)
          break
        }

        // ── add_shape ──────────────────────────────────────────────
        case 'add_shape': {
          const w     = action.props.width  ?? 200
          const h     = action.props.height ?? 120
          const color = toTldrawColor(action.props.color)
          const label = action.props.label ?? ''

          if (action.shape === 'arrow') {
            const id = nextCanvasShapeId('arrow')
            editor.createShape({
              id,
              type: 'arrow',
              x: action.x,
              y: action.y,
              props: {
                color,
                start: { x: 0, y: 0 },
                end:   { x: w, y: 0 },
              } as any,
            } as any)
            createdShapeIds.push(id)
          } else {
            const id = nextCanvasShapeId('shape')
            const geo = GEO_TYPE_MAP[action.shape] ?? 'rectangle'
            editor.createShape({
              id,
              type: 'geo',
              x: action.x,
              y: action.y,
              props: {
                geo,
                w,
                h,
                color,
                fill:   'none'   as TldrawFill,
                dash:   'draw'   as TldrawDash,
                size:   'm'      as TldrawSize,
                richText: label ? toRichText(label) as any : toRichText('') as any,
                font:   'draw'   as TldrawFont,
                align:  'middle' as TldrawAlign,
              } as any,
            } as any)
            createdShapeIds.push(id)
          }
          break
        }

        // ── add_card rendered as chalk text on the board ──────────
        case 'add_card': {
          const title = action.content.title ? `${action.content.title}\n\n` : ''
          const text  = title + (action.content.body ?? '')
          const id = nextCanvasShapeId('card-text')
          const color = action.content.type === 'error' ? 'light-red' : 'white'
          editor.createShape({
            id,
            type: 'text',
            x: action.x,
            y: action.y,
            props: {
              richText: toRichText(text) as any,
              color: color as TldrawColor,
              size:   'l'      as TldrawSize,
              font:   'draw'   as TldrawFont,
              textAlign: 'start' as TldrawAlign,
              autoSize: true,
              w: 560,
              scale: 1,
            } as any,
          } as any)
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
            const id = nextCanvasShapeId('legacy-text')
            editor.createShape({
              id,
              type: 'text',
              x: l.x ?? 100,
              y: l.y ?? 100,
              props: {
                richText: toRichText(l.text ?? '') as any,
                size:    'm'     as TldrawSize,
                color:   'black' as TldrawColor,
                font:    'draw'  as TldrawFont,
                textAlign: 'start' as TldrawAlign,
                autoSize: true,
                w: 300,
                scale: 1,
              },
            } as any)
            createdShapeIds.push(id)
          } else if (type === 'draw_shape') {
            const l = action as unknown as { x: number; y: number; shape?: string; width?: number; height?: number }
            const id = nextCanvasShapeId('legacy-shape')
            editor.createShape({
              id,
              type: 'geo',
              x: l.x ?? 100,
              y: l.y ?? 100,
              props: {
                geo:   GEO_TYPE_MAP[l.shape ?? 'rectangle'] ?? 'rectangle',
                w:     l.width  ?? 200,
                h:     l.height ?? 120,
                color: 'black' as TldrawColor,
                fill:  'none'  as TldrawFill,
                dash:  'draw'  as TldrawDash,
                size:  'm'     as TldrawSize,
              } as any,
            } as any)
            createdShapeIds.push(id)
          } else if (type === 'highlight') {
            const l = action as unknown as { x: number; y: number; width?: number; height?: number; color?: string }
            const id = nextCanvasShapeId('legacy-highlight')
            editor.createShape({
              id,
              type: 'geo',
              x: l.x ?? 100,
              y: l.y ?? 100,
              props: {
                geo:   'rectangle' as TldrawGeo,
                w:     l.width  ?? 200,
                h:     l.height ?? 60,
                color: toTldrawColor(l.color ?? 'yellow'),
                fill:  'semi'  as TldrawFill,
                dash:  'draw'  as TldrawDash,
                size:  'm'     as TldrawSize,
              } as any,
            } as any)
            createdShapeIds.push(id)
          }
        }
      }
    }
  })

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
