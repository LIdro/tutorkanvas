// ─────────────────────────────────────────────
// Tests: lib/canvas-actions.ts — parseAIResponse + executeCanvasActions
// ─────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest'
import { parseAIResponse, executeCanvasActions } from '@/lib/canvas-actions'
import type { Editor } from 'tldraw'

// ── parseAIResponse ───────────────────────────

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

  it('strips invalid action types', () => {
    const input = JSON.stringify({
      message: '',
      actions: [
        { type: 'add_text', x: 0, y: 0, content: 'ok' },
        { type: 'invalid_type', foo: 'bar' },
      ],
    })
    const result = parseAIResponse(input)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('add_text')
  })

  it('handles missing fields gracefully', () => {
    const input = JSON.stringify({ message: 'hi' })
    const result = parseAIResponse(input)
    expect(result.message).toBe('hi')
    expect(result.actions).toHaveLength(0)
    expect(result.suggestGame).toBe(false)
  })

  it('handles completely empty JSON object', () => {
    const result = parseAIResponse('{}')
    expect(result.message).toBe('')
    expect(result.actions).toHaveLength(0)
  })
})

// ── executeCanvasActions ──────────────────────

function makeEditorMock() {
  const createdShapes: unknown[] = []
  const deletedIds: string[] = []
  let runCb: (() => void) | null = null

  const editor = {
    createShape: vi.fn((shape: unknown) => { createdShapes.push(shape) }),
    createShapes: vi.fn((shapes: unknown[]) => { createdShapes.push(...shapes) }),
    deleteShapes: vi.fn((ids: string[]) => { deletedIds.push(...ids) }),
    getCurrentPageShapeIds: vi.fn(() => new Set(['id1', 'id2'])),
    run: vi.fn((cb: () => void) => { runCb = cb; cb() }),
    _createdShapes: createdShapes,
    _deletedIds: deletedIds,
  }
  return editor as unknown as Editor & {
    _createdShapes: unknown[]
    _deletedIds: string[]
  }
}

describe('executeCanvasActions', () => {
  it('does nothing when actions array is empty', () => {
    const editor = makeEditorMock()
    executeCanvasActions(editor, [])
    expect((editor as any).createShape).not.toHaveBeenCalled()
  })

  it('creates a text shape for add_text', () => {
    const editor = makeEditorMock()
    executeCanvasActions(editor, [
      { type: 'add_text', x: 100, y: 200, content: 'Hello world' },
    ])
    expect((editor as any).createShape).toHaveBeenCalledOnce()
    const call = (editor as any).createShape.mock.calls[0][0]
    expect(call.type).toBe('text')
    expect(call.x).toBe(100)
    expect(call.y).toBe(200)
    // tldraw v4 uses richText (ProseMirror doc) instead of a plain text prop
    expect(call.props.richText.content[0].content[0].text).toBe('Hello world')
  })

  it('creates a geo shape for add_shape rectangle', () => {
    const editor = makeEditorMock()
    executeCanvasActions(editor, [
      { type: 'add_shape', shape: 'rectangle', x: 50, y: 60, props: { width: 200, height: 100 } },
    ])
    const call = (editor as any).createShape.mock.calls[0][0]
    expect(call.type).toBe('geo')
    expect(call.props.geo).toBe('rectangle')
  })

  it('creates an arrow shape for add_shape arrow', () => {
    const editor = makeEditorMock()
    executeCanvasActions(editor, [
      { type: 'add_shape', shape: 'arrow', x: 0, y: 0, props: { width: 150 } },
    ])
    const call = (editor as any).createShape.mock.calls[0][0]
    expect(call.type).toBe('arrow')
  })

  it('creates a note shape for add_card', () => {
    const editor = makeEditorMock()
    executeCanvasActions(editor, [
      { type: 'add_card', x: 10, y: 10, content: { type: 'explanation', body: 'This is a hint', title: 'Tip' } },
    ])
    const call = (editor as any).createShape.mock.calls[0][0]
    expect(call.type).toBe('note')
    // tldraw v4 uses richText — check all paragraph texts joined
    const paragraphTexts: string[] = call.props.richText.content
      .flatMap((p: any) => (p.content ?? []).map((n: any) => n.text ?? ''))
    const joined = paragraphTexts.join(' ')
    expect(joined).toContain('This is a hint')
    expect(joined).toContain('Tip')
  })

  it('silently skips speak / add_game / suggest_game', () => {
    const editor = makeEditorMock()
    executeCanvasActions(editor, [
      { type: 'speak', text: 'hello' },
      { type: 'add_game', x: 0, y: 0, game: { type: 'timed-math', question: '2+2', answer: 4, topic: 'addition', difficulty: 1 } },
    ])
    expect((editor as any).createShape).not.toHaveBeenCalled()
  })

  it('handles legacy clear action', () => {
    const editor = makeEditorMock()
    executeCanvasActions(editor, [{ type: 'clear' } as any])
    expect((editor as any).deleteShapes).toHaveBeenCalledWith(['id1', 'id2'])
  })

  it('handles legacy write_text action', () => {
    const editor = makeEditorMock()
    executeCanvasActions(editor, [{ type: 'write_text', x: 5, y: 5, text: 'legacy text' } as any])
    const call = (editor as any).createShape.mock.calls[0][0]
    expect(call.type).toBe('text')
    // tldraw v4 uses richText
    expect(call.props.richText.content[0].content[0].text).toBe('legacy text')
  })

  it('applies font size mapping from add_text style', () => {
    const editor = makeEditorMock()
    executeCanvasActions(editor, [
      { type: 'add_text', x: 0, y: 0, content: 'big text', style: { fontSize: 'xl' } },
    ])
    const call = (editor as any).createShape.mock.calls[0][0]
    expect(call.props.size).toBe('xl')
  })
})
