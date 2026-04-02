import { describe, expect, it, vi } from 'vitest'
import type { Editor } from 'tldraw'
import { layoutVerticalSubtraction } from '@/lib/layout/arithmetic'
import {
  circleNode,
  crossOutNode,
  drawArrowBetweenNodes,
  performBorrow,
  performCarry,
  rewriteNodeValue,
  underlineNodes,
  writeAboveNode,
} from '@/lib/demonstration-tools'

function makeEditorMock() {
  const createdShapes: unknown[] = []

  const editor = {
    createShape: vi.fn((shape: unknown) => {
      createdShapes.push(shape)
      return shape
    }),
  }

  return editor as unknown as Editor & {
    createShape: ReturnType<typeof vi.fn>
    _createdShapes?: unknown[]
  }
}

describe('demonstration tools', () => {
  it('circles and annotates nodes using semantic ids', () => {
    const editor = makeEditorMock()
    const scene = layoutVerticalSubtraction({ minuend: 42, subtrahend: 18 })

    const circleId = circleNode(editor, scene, 'minuend.ones')
    const annotationId = writeAboveNode(editor, scene, 'minuend.ones', '1')

    expect(circleId).toBeTruthy()
    expect(annotationId).toBeTruthy()
    expect(editor.createShape).toHaveBeenCalledTimes(2)
  })

  it('draws arrows and underlines across semantic nodes', () => {
    const editor = makeEditorMock()
    const scene = layoutVerticalSubtraction({ minuend: 42, subtrahend: 18 })

    const arrowId = drawArrowBetweenNodes(editor, scene, 'minuend.tens', 'minuend.ones')
    const underlineId = underlineNodes(editor, scene, ['minuend.tens', 'minuend.ones'])

    expect(arrowId).toBeTruthy()
    expect(underlineId).toBeTruthy()
  })

  it('crosses out and rewrites node values', () => {
    const editor = makeEditorMock()
    const scene = layoutVerticalSubtraction({ minuend: 42, subtrahend: 18 })

    const crossed = crossOutNode(editor, scene, 'minuend.tens')
    const rewritten = rewriteNodeValue(editor, scene, 'minuend.tens', '3')

    expect(crossed).toHaveLength(2)
    expect(rewritten?.scene.nodes['minuend.tens'].value).toBe('3')
  })

  it('performs a borrow macro and updates scene state', () => {
    const editor = makeEditorMock()
    const scene = layoutVerticalSubtraction({ minuend: 42, subtrahend: 18 })

    const result = performBorrow(editor, scene, 'tens', 'ones')

    expect(result.scene.nodes['minuend.tens'].value).toBe('3')
    expect(result.scene.nodes['borrow.anchor.ones'].value).toBe('1')
    expect(result.shapeIds.length).toBeGreaterThan(0)
  })

  it('performs a carry macro and updates scene state', () => {
    const editor = makeEditorMock()
    const scene = layoutVerticalSubtraction({ minuend: 42, subtrahend: 18 })

    const result = performCarry(editor, scene, 'ones', 'tens', '1')

    expect(result.scene.nodes['carry.anchor.tens'].value).toBe('1')
    expect(result.shapeIds.length).toBeGreaterThan(0)
  })
})

