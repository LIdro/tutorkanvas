import { describe, it, expect, vi } from 'vitest'
import { parseAIResponse, executeCanvasActions } from '@/lib/canvas-actions'
import type { CanvasEngine } from '@/lib/canvas-engine/types'

describe('parseAIResponse', () => {
  it('parses a valid JSON response', () => {
    const input = JSON.stringify({
      message: 'Hello!',
      actions: [{ type: 'add_text', x: 10, y: 20, content: 'Hi' }],
      topic: 'addition',
      suggestGame: false,
    })
    const result = parseAIResponse(input)
    expect(result.message).toBe('Hello!')
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('add_text')
    expect(result.topic).toBe('addition')
  })

  it('extracts JSON from a markdown code fence', () => {
    const input = '```json\n{"message":"test","actions":[]}\n```'
    const result = parseAIResponse(input)
    expect(result.message).toBe('test')
    expect(result.actions).toHaveLength(0)
  })

  it('wraps plain text in a fallback add_card action', () => {
    const input = 'This is just a plain text response from the AI.'
    const result = parseAIResponse(input)
    expect(result.message).toBe(input)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('add_card')
  })
})

function makeEngineMock() {
  const calls = {
    addText: vi.fn(() => 'text-1'),
    addRectangle: vi.fn(() => 'rect-1'),
    addEllipse: vi.fn(() => 'ellipse-1'),
    addArrow: vi.fn(() => 'arrow-1'),
    addLine: vi.fn(() => 'line-1'),
    deleteByIds: vi.fn(),
    listElementIds: vi.fn(() => ['id1', 'id2']),
  }

  const engine: Partial<CanvasEngine> = {
    kind: 'tldraw',
    getSnapshot: vi.fn(() => null),
    loadSnapshot: vi.fn(),
    clearScene: vi.fn(),
    resetTransientLayer: vi.fn(),
    getElementBounds: vi.fn(() => null),
    getViewportBounds: vi.fn(() => ({
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
      width: 100,
      height: 100,
      center: { x: 50, y: 50 },
    })),
    exportPng: vi.fn(async () => null),
    onChange: vi.fn(),
    ...calls,
  }

  return engine as CanvasEngine & typeof calls
}

describe('executeCanvasActions', () => {
  it('does nothing when actions array is empty', () => {
    const engine = makeEngineMock()
    executeCanvasActions(engine, [])
    expect(engine.addText).not.toHaveBeenCalled()
  })

  it('creates a text shape for add_text', () => {
    const engine = makeEngineMock()
    executeCanvasActions(engine, [
      { type: 'add_text', x: 100, y: 200, content: 'Hello world' },
    ])
    expect(engine.addText).toHaveBeenCalledOnce()
    expect(engine.addText).toHaveBeenCalledWith(expect.objectContaining({
      x: 100,
      y: 200,
      text: 'Hello world',
    }))
  })

  it('creates a rectangle for add_shape rectangle', () => {
    const engine = makeEngineMock()
    executeCanvasActions(engine, [
      { type: 'add_shape', shape: 'rectangle', x: 50, y: 60, props: { width: 200, height: 100 } },
    ])
    expect(engine.addRectangle).toHaveBeenCalledOnce()
  })

  it('creates an arrow shape for add_shape arrow', () => {
    const engine = makeEngineMock()
    executeCanvasActions(engine, [
      { type: 'add_shape', shape: 'arrow', x: 0, y: 0, props: { width: 150 } },
    ])
    expect(engine.addArrow).toHaveBeenCalledOnce()
  })

  it('renders add_card as explanatory text', () => {
    const engine = makeEngineMock()
    executeCanvasActions(engine, [
      { type: 'add_card', x: 10, y: 10, content: { type: 'explanation', body: 'This is a hint', title: 'Tip' } },
    ])
    expect(engine.addText).toHaveBeenCalledWith(expect.objectContaining({
      x: 10,
      y: 10,
      text: expect.stringContaining('This is a hint'),
    }))
  })

  it('silently skips speak / add_game / suggest_game', () => {
    const engine = makeEngineMock()
    executeCanvasActions(engine, [
      { type: 'speak', text: 'hello' },
      { type: 'add_game', x: 0, y: 0, game: { type: 'timed-math', question: '2+2', answer: 4, topic: 'addition', difficulty: 1 } },
    ])
    expect(engine.addText).not.toHaveBeenCalled()
  })

  it('handles legacy clear action', () => {
    const engine = makeEngineMock()
    executeCanvasActions(engine, [{ type: 'clear' } as any])
    expect(engine.deleteByIds).toHaveBeenCalledWith(['id1', 'id2'])
  })
})
