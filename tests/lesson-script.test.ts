import { describe, expect, it } from 'vitest'
import { parseLessonScript } from '@/lib/lesson-script'
import { layoutVerticalAddition, layoutVerticalSubtraction } from '@/lib/layout/arithmetic'
import { buildLessonSceneFromPrompt, extractArithmeticTeachingProblem, hydrateLessonScriptScene } from '@/lib/lesson-planner'
import { getNodeBounds, resolvePlacement, updateNodeValue } from '@/lib/lesson-scene'

describe('parseLessonScript', () => {
  it('parses a valid lesson script', () => {
    const raw = JSON.stringify({
      lessonId: 'lesson_1',
      topic: 'subtraction with borrowing',
      scene: {
        id: 'scene_1',
        kind: 'vertical-subtraction',
        nodes: {
          'minuend.ones': { id: 'minuend.ones', role: 'minuend_digit', x: 100, y: 100, width: 40, height: 50, value: '2' },
        },
      },
      steps: [
        {
          id: 'step_1',
          speech: 'Look at the ones column.',
          waitFor: 'speech_end',
          actions: [
            { type: 'highlight_symbol', target: 'minuend.ones', style: 'circle' },
          ],
        },
      ],
    })

    const result = parseLessonScript(raw)
    expect(result?.lessonId).toBe('lesson_1')
    expect(result?.steps).toHaveLength(1)
    expect(result?.steps[0].actions[0].type).toBe('highlight_symbol')
  })

  it('returns null for invalid scripts', () => {
    expect(parseLessonScript('{"message":"hello"}')).toBeNull()
  })

  it('filters invalid demonstration actions', () => {
    const raw = JSON.stringify({
      lessonId: 'lesson_1',
      topic: 'subtraction with borrowing',
      scene: { id: 'scene_1', kind: 'vertical-subtraction', nodes: {} },
      steps: [
        {
          id: 'step_1',
          speech: 'Look at the ones column.',
          actions: [
            { type: 'highlight_symbol', target: 'minuend.ones', style: 'circle' },
            { type: 'made_up', target: 'minuend.ones' },
          ],
        },
      ],
    })

    const result = parseLessonScript(raw)
    expect(result?.steps[0].actions).toHaveLength(1)
  })
})

describe('arithmetic layout', () => {
  it('creates semantic nodes for vertical subtraction', () => {
    const scene = layoutVerticalSubtraction({ minuend: 42, subtrahend: 18 })
    expect(scene.kind).toBe('vertical-subtraction')
    expect(scene.nodes['minuend.ones'].value).toBe('2')
    expect(scene.nodes['minuend.tens'].value).toBe('4')
    expect(scene.nodes['subtrahend.ones'].value).toBe('8')
    expect(scene.nodes['subtrahend.tens'].value).toBe('1')
    expect(scene.nodes.answerLine).toBeDefined()
  })

  it('creates semantic nodes for vertical addition', () => {
    const scene = layoutVerticalAddition({ minuend: 27, subtrahend: 15 })
    expect(scene.kind).toBe('vertical-addition')
    expect(scene.nodes.operator.value).toBe('+')
  })
})

describe('lesson planner helpers', () => {
  it('extracts arithmetic problems from prompts', () => {
    expect(extractArithmeticTeachingProblem('Explain 42 - 18 step by step')).toEqual({
      left: 42,
      right: 18,
      operator: '-',
    })
    expect(extractArithmeticTeachingProblem('Show me 27 + 15')).toEqual({
      left: 27,
      right: 15,
      operator: '+',
    })
  })

  it('builds a canonical lesson scene from the user prompt', () => {
    const scene = buildLessonSceneFromPrompt('Solve 42 - 18 for me')
    expect(scene?.kind).toBe('vertical-subtraction')
    expect(scene?.nodes['minuend.tens'].value).toBe('4')
    expect(scene?.nodes['subtrahend.ones'].value).toBe('8')
  })

  it('hydrates a planner script with the canonical arithmetic scene', () => {
    const script = parseLessonScript(JSON.stringify({
      lessonId: 'lesson_1',
      topic: 'subtraction with borrowing',
      scene: { id: 'scene_1', kind: 'vertical-subtraction', nodes: {} },
      steps: [
        {
          id: 'step_1',
          speech: 'Look at the ones column.',
          actions: [{ type: 'highlight_symbol', target: 'minuend.ones', style: 'circle' }],
        },
      ],
    }))

    const hydrated = hydrateLessonScriptScene(script!, 'Explain 42 - 18 step by step')
    expect(hydrated.scene.kind).toBe('vertical-subtraction')
    expect(hydrated.scene.nodes['minuend.tens'].value).toBe('4')
    expect(hydrated.scene.nodes['subtrahend.ones'].value).toBe('8')
  })
})

describe('lesson scene helpers', () => {
  it('resolves placement relative to a node', () => {
    const scene = layoutVerticalSubtraction({ minuend: 42, subtrahend: 18 })
    const point = resolvePlacement(scene, 'minuend.ones', 'top-right', 8)
    const bounds = getNodeBounds(scene, 'minuend.ones')

    expect(point?.x).toBe((bounds?.right ?? 0) + 8)
    expect(point?.y).toBe((bounds?.y ?? 0) - 8)
  })

  it('updates node values immutably', () => {
    const scene = layoutVerticalSubtraction({ minuend: 42, subtrahend: 18 })
    const updated = updateNodeValue(scene, 'minuend.tens', '3')

    expect(updated.nodes['minuend.tens'].value).toBe('3')
    expect(scene.nodes['minuend.tens'].value).toBe('4')
  })
})
