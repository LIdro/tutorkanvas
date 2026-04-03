import { Box, createShapeId, getSnapshot, loadSnapshot, type Editor } from 'tldraw'
import type {
  CanvasArrowInput,
  CanvasElementBounds,
  CanvasEllipseInput,
  CanvasEngine,
  CanvasEngineChange,
  CanvasLineInput,
  CanvasRectangleInput,
  CanvasTextInput,
  CanvasViewportBounds,
} from '@/lib/canvas-engine/types'
import { createCanvasSnapshotEnvelope, normalizeCanvasSnapshot } from '@/lib/canvas-engine/snapshots'

let tldrawShapeCounter = 0

function nextId(prefix: string): string {
  tldrawShapeCounter += 1
  return createShapeId(`${prefix}-${tldrawShapeCounter}`) as unknown as string
}

function toRichText(plain: string) {
  const lines = plain.split('\n')
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  }
}

function toViewportBounds(box: Box): CanvasViewportBounds {
  return {
    minX: box.minX,
    minY: box.minY,
    maxX: box.maxX,
    maxY: box.maxY,
    width: box.width,
    height: box.height,
    center: {
      x: box.center.x,
      y: box.center.y,
    },
  }
}

function toElementBounds(bounds: Box): CanvasElementBounds {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
  }
}

export class TldrawCanvasEngine implements CanvasEngine {
  readonly kind = 'tldraw' as const

  constructor(private readonly editor: Editor) {}

  getSnapshot() {
    const scene = getSnapshot(this.editor.store)
    return createCanvasSnapshotEnvelope({
      engine: 'tldraw',
      scene,
    })
  }

  loadSnapshot(snapshot: unknown) {
    const normalized = normalizeCanvasSnapshot(snapshot, 'tldraw')
    if (!normalized) return
    loadSnapshot(this.editor.store, normalized.scene as any)
  }

  clearScene() {
    const ids = [...this.editor.getCurrentPageShapeIds()]
    if (ids.length) {
      this.editor.deleteShapes(ids)
    }
  }

  resetTransientLayer() {
    // Transient elements are tracked by the runtime layer, not by tldraw.
  }

  addText(input: CanvasTextInput) {
    const id = nextId('text')
    this.editor.createShape({
      id,
      type: 'text',
      x: input.x,
      y: input.y,
      meta: input.metadata ?? {},
      props: {
        richText: toRichText(input.text) as any,
        size: input.size ?? 'm',
        color: input.color ?? 'white',
        font: 'draw',
        textAlign: input.align ?? 'start',
        autoSize: input.autoSize ?? true,
        w: input.width ?? 240,
        scale: 1,
      },
    } as any)
    return id
  }

  addRectangle(input: CanvasRectangleInput) {
    const id = nextId('rect')
    this.editor.createShape({
      id,
      type: 'geo',
      x: input.x,
      y: input.y,
      meta: input.metadata ?? {},
      props: {
        geo: 'rectangle',
        w: input.width,
        h: input.height,
        color: input.color ?? 'white',
        fill: input.fill ?? 'none',
        dash: 'draw',
        size: 'm',
      },
    } as any)
    return id
  }

  addEllipse(input: CanvasEllipseInput) {
    const id = nextId('ellipse')
    this.editor.createShape({
      id,
      type: 'geo',
      x: input.x,
      y: input.y,
      meta: input.metadata ?? {},
      props: {
        geo: 'ellipse',
        w: input.width,
        h: input.height,
        color: input.color ?? 'white',
        fill: input.fill ?? 'none',
        dash: 'draw',
        size: 'm',
      },
    } as any)
    return id
  }

  addLine(input: CanvasLineInput) {
    const id = nextId('line')
    this.editor.createShape({
      id,
      type: 'arrow',
      x: input.x,
      y: input.y,
      meta: input.metadata ?? {},
      props: {
        color: input.color ?? 'white',
        start: { x: 0, y: 0 },
        end: { x: input.width, y: input.height },
        arrowheadStart: 'none',
        arrowheadEnd: 'none',
      },
    } as any)
    return id
  }

  addArrow(input: CanvasArrowInput) {
    const id = nextId('arrow')
    this.editor.createShape({
      id,
      type: 'arrow',
      x: input.x,
      y: input.y,
      meta: input.metadata ?? {},
      props: {
        color: input.color ?? 'red',
        start: { x: 0, y: 0 },
        end: { x: input.endX - input.x, y: input.endY - input.y },
      },
    } as any)
    return id
  }

  deleteByIds(ids: string[]) {
    if (ids.length) {
      this.editor.deleteShapes(ids as any)
    }
  }

  getElementBounds(id: string) {
    const bounds = this.editor.getShapePageBounds(id as any)
    return bounds ? toElementBounds(bounds) : null
  }

  getViewportBounds() {
    return toViewportBounds(this.editor.getViewportPageBounds())
  }

  listElementIds() {
    return [...this.editor.getCurrentPageShapeIds()] as string[]
  }

  async exportPng() {
    const ids = this.listElementIds()
    if (!ids.length) return null
    const result = await this.editor.toImage(ids as any, { format: 'png', pixelRatio: 2 })
    return result.blob
  }

  onChange(listener: (change: CanvasEngineChange) => void) {
    return this.editor.store.listen(() => {
      const snapshot = this.getSnapshot()
      if (snapshot) {
        listener({ snapshot })
      }
    })
  }
}
