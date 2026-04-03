import { describe, expect, it, vi } from 'vitest'
import type { CanvasEngine } from '@/lib/canvas-engine/types'
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

function makeEngineMock() {
  const engine: Partial<CanvasEngine> = {
    kind: 'tldraw',
    getSnapshot: vi.fn(() => null),
    loadSnapshot: vi.fn(),
    clearScene: vi.fn(),
    resetTransientLayer: vi.fn(),
    addText: vi.fn(() => `text-${Math.random()}`),
    addRectangle: vi.fn(() => `rect-${Math.random()}`),
    addEllipse: vi.fn(() => `ellipse-${Math.random()}`),
    addLine: vi.fn(() => `line-${Math.random()}`),
    addArrow: vi.fn(() => `arrow-${Math.random()}`),
    deleteByIds: vi.fn(),
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
    listElementIds: vi.fn(() => []),
    exportPng: vi.fn(async () => null),
  }
  return engine as CanvasEngine & {
    addText: ReturnType<typeof vi.fn>
    addRectangle: ReturnType<typeof vi.fn>
    addEllipse: ReturnType<typeof vi.fn>
    addLine: ReturnType<typeof vi.fn>
    addArrow: ReturnType<typeof vi.fn>
  }
}

describe('demonstration tools', () => {
  it('circles and annotates nodes using semantic ids', () => {
    const engine = makeEngineMock()
    const scene = layoutVerticalSubtraction({ minuend: 42, subtrahend: 18 })

    const circleId = circleNode(engine, scene, 'minuend.ones')
    const annotationId = writeAboveNode(engine, scene, 'minuend.ones', '1')

    expect(circleId).toBeTruthy()
    expect(annotationId).toBeTruthy()
    expect(engine.addEllipse).toHaveBeenCalledTimes(1)
    expect(engine.addText).toHaveBeenCalledTimes(1)
  })

  it('draws arrows and underlines across semantic nodes', () => {
    const engine = makeEngineMock()
    const scene = layoutVerticalSubtraction({ minuend: 42, subtrahend: 18 })

    const arrowId = drawArrowBetweenNodes(engine, scene, 'minuend.tens', 'minuend.ones')
    const underlineId = underlineNodes(engine, scene, ['minuend.tens', 'minuend.ones'])

    expect(arrowId).toBeTruthy()
    expect(underlineId).toBeTruthy()
    expect(engine.addArrow).toHaveBeenCalledOnce()
    expect(engine.addLine).toHaveBeenCalledOnce()
  })

  it('crosses out and rewrites node values', () => {
    const engine = makeEngineMock()
    const scene = layoutVerticalSubtraction({ minuend: 42, subtrahend: 18 })

    const crossed = crossOutNode(engine, scene, 'minuend.tens')
    const rewritten = rewriteNodeValue(engine, scene, 'minuend.tens', '3')

    expect(crossed).toHaveLength(2)
    expect(rewritten?.scene.nodes['minuend.tens'].value).toBe('3')
  })

  it('performs a borrow macro and updates scene state', () => {
    const engine = makeEngineMock()
    const scene = layoutVerticalSubtraction({ minuend: 42, subtrahend: 18 })

    const result = performBorrow(engine, scene, 'tens', 'ones')

    expect(result.scene.nodes['minuend.tens'].value).toBe('3')
    expect(result.scene.nodes['borrow.anchor.ones'].value).toBe('1')
    expect(result.shapeIds.length).toBeGreaterThan(0)
  })

  it('performs a carry macro and updates scene state', () => {
    const engine = makeEngineMock()
    const scene = layoutVerticalSubtraction({ minuend: 42, subtrahend: 18 })

    const result = performCarry(engine, scene, 'ones', 'tens', '1')

    expect(result.scene.nodes['carry.anchor.tens'].value).toBe('1')
    expect(result.shapeIds.length).toBeGreaterThan(0)
  })
})
