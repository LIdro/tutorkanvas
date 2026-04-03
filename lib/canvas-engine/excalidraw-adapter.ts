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

interface ExcalidrawImperativeAPI {
  updateScene: (scene: Record<string, unknown>) => void
  resetScene: () => void
  getSceneElementsIncludingDeleted: () => readonly ExcalidrawElementLike[]
  getSceneElements: () => readonly ExcalidrawElementLike[]
  getAppState: () => Record<string, any>
  getFiles: () => Record<string, unknown>
  setActiveTool: (tool: Record<string, unknown>) => void
  refresh: () => void
  onChange: (callback: (elements: readonly ExcalidrawElementLike[], appState: Record<string, any>, files: Record<string, unknown>) => void) => () => void
}

interface ExcalidrawAdapterUtils {
  convertToExcalidrawElements: (elements: unknown[] | null) => any[]
  exportToBlob: (input: Record<string, unknown>) => Promise<Blob>
}

type ExcalidrawElementLike = {
  id: string
  type: string
  x: number
  y: number
  width?: number
  height?: number
  isDeleted?: boolean
}

const COLOR_MAP: Record<string, string> = {
  black: '#111827',
  grey: '#9ca3af',
  gray: '#9ca3af',
  white: '#f8fafc',
  yellow: '#facc15',
  orange: '#fb923c',
  red: '#ef4444',
  'light-red': '#fca5a5',
  blue: '#60a5fa',
  'light-blue': '#93c5fd',
  green: '#4ade80',
  'light-green': '#86efac',
  violet: '#a78bfa',
  'light-violet': '#c4b5fd',
}

const FONT_SIZE_MAP: Record<NonNullable<CanvasTextInput['size']>, number> = {
  s: 18,
  m: 24,
  l: 32,
  xl: 40,
}

function toCaptureUpdate(action: 'IMMEDIATELY' | 'EVENTUALLY' | 'NEVER' = 'IMMEDIATELY') {
  return action
}

function normalizeColor(color?: string, fallback: string = '#f8fafc') {
  if (!color) return fallback
  const normalized = color.trim().toLowerCase()
  return COLOR_MAP[normalized] ?? color
}

function normalizeFillStyle(fill: 'none' | 'semi' | 'solid' | undefined) {
  if (fill === 'solid') return 'solid'
  if (fill === 'semi') return 'hachure'
  return 'solid'
}

function getElementBounds(element: ExcalidrawElementLike): CanvasElementBounds {
  const width = element.width ?? 0
  const height = element.height ?? 0
  const minX = Math.min(element.x, element.x + width)
  const minY = Math.min(element.y, element.y + height)
  const maxX = Math.max(element.x, element.x + width)
  const maxY = Math.max(element.y, element.y + height)

  return {
    x: minX,
    y: minY,
    width: Math.abs(width),
    height: Math.abs(height),
    minX,
    minY,
    maxX,
    maxY,
  }
}

function getVisibleBounds(api: ExcalidrawImperativeAPI): CanvasViewportBounds {
  const appState = api.getAppState() as {
    width: number
    height: number
    zoom: { value: number }
    scrollX: number
    scrollY: number
  }
  const zoom = appState.zoom?.value || 1
  const minX = -appState.scrollX / zoom
  const minY = -appState.scrollY / zoom
  const width = appState.width / zoom
  const height = appState.height / zoom
  const maxX = minX + width
  const maxY = minY + height

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    center: {
      x: minX + width / 2,
      y: minY + height / 2,
    },
  }
}

export class ExcalidrawCanvasEngine implements CanvasEngine {
  readonly kind = 'excalidraw' as const

  constructor(
    private readonly api: ExcalidrawImperativeAPI,
    private readonly utils: ExcalidrawAdapterUtils,
  ) {}

  getSnapshot() {
    return createCanvasSnapshotEnvelope({
      engine: 'excalidraw',
      scene: {
        elements: this.api.getSceneElementsIncludingDeleted(),
        appState: this.api.getAppState(),
      },
      files: this.api.getFiles() as unknown as Record<string, unknown>,
    })
  }

  loadSnapshot(snapshot: unknown) {
    const normalized = normalizeCanvasSnapshot(snapshot, 'excalidraw')
    if (!normalized || normalized.engine !== 'excalidraw') return
    const scene = (normalized.scene ?? {}) as {
      elements?: readonly ExcalidrawElementLike[]
      appState?: Record<string, unknown>
    }
    this.api.updateScene({
      elements: (scene.elements ?? []) as any,
      appState: scene.appState as any,
      captureUpdate: toCaptureUpdate('NEVER'),
    })
  }

  clearScene() {
    this.api.updateScene({
      elements: [],
      captureUpdate: toCaptureUpdate('IMMEDIATELY'),
    })
  }

  resetTransientLayer() {
    const kept = this.api.getSceneElements().filter((element: any) => !element.customData?.transient)
    this.api.updateScene({
      elements: kept as any,
      captureUpdate: toCaptureUpdate('IMMEDIATELY'),
    })
  }

  addText(input: CanvasTextInput) {
    const [element] = this.utils.convertToExcalidrawElements([
      {
        type: 'text',
        x: input.x,
        y: input.y,
        text: input.text,
        strokeColor: normalizeColor(input.color),
        backgroundColor: 'transparent',
        fontSize: FONT_SIZE_MAP[input.size ?? 'm'],
        fontFamily: 1,
        textAlign: input.align === 'middle' ? 'center' : input.align === 'end' ? 'right' : 'left',
        verticalAlign: 'top',
        lineHeight: 1.25,
        width: input.width,
        customData: input.metadata,
      } as any,
    ])
    this.api.updateScene({
      elements: [...this.api.getSceneElements(), element] as any,
      captureUpdate: toCaptureUpdate('IMMEDIATELY'),
    })
    return element.id
  }

  addRectangle(input: CanvasRectangleInput) {
    const [element] = this.utils.convertToExcalidrawElements([
      {
        type: 'rectangle',
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height,
        strokeColor: normalizeColor(input.color),
        backgroundColor: input.fill === 'none' ? 'transparent' : normalizeColor(input.color, '#f8fafc'),
        fillStyle: normalizeFillStyle(input.fill),
        opacity: input.fill === 'semi' ? 28 : 100,
        roughness: 0,
        strokeWidth: 2,
        customData: input.metadata,
      } as any,
    ])
    this.api.updateScene({
      elements: [...this.api.getSceneElements(), element] as any,
      captureUpdate: toCaptureUpdate('IMMEDIATELY'),
    })
    return element.id
  }

  addEllipse(input: CanvasEllipseInput) {
    const [element] = this.utils.convertToExcalidrawElements([
      {
        type: 'ellipse',
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height,
        strokeColor: normalizeColor(input.color),
        backgroundColor: input.fill === 'none' ? 'transparent' : normalizeColor(input.color, '#f8fafc'),
        fillStyle: normalizeFillStyle(input.fill),
        opacity: input.fill === 'semi' ? 28 : 100,
        roughness: 0,
        strokeWidth: 2,
        customData: input.metadata,
      } as any,
    ])
    this.api.updateScene({
      elements: [...this.api.getSceneElements(), element] as any,
      captureUpdate: toCaptureUpdate('IMMEDIATELY'),
    })
    return element.id
  }

  addLine(input: CanvasLineInput) {
    const deltaX = Math.abs(input.width) < 0.01 ? 0.75 : input.width
    const deltaY = Math.abs(input.height) < 0.01 ? 0.75 : input.height
    const [element] = this.utils.convertToExcalidrawElements([
      {
        type: 'line',
        x: input.x,
        y: input.y,
        points: [
          [0, 0],
          [deltaX, deltaY],
        ],
        strokeColor: normalizeColor(input.color),
        roughness: 0,
        strokeWidth: 2,
        customData: input.metadata,
      } as any,
    ])
    this.api.updateScene({
      elements: [...this.api.getSceneElements(), element] as any,
      captureUpdate: toCaptureUpdate('IMMEDIATELY'),
    })
    return element.id
  }

  addArrow(input: CanvasArrowInput) {
    const [element] = this.utils.convertToExcalidrawElements([
      {
        type: 'arrow',
        x: input.x,
        y: input.y,
        points: [
          [0, 0],
          [input.endX - input.x, input.endY - input.y],
        ],
        strokeColor: normalizeColor(input.color, '#ef4444'),
        roughness: 0,
        strokeWidth: 2,
        customData: input.metadata,
      } as any,
    ])
    this.api.updateScene({
      elements: [...this.api.getSceneElements(), element] as any,
      captureUpdate: toCaptureUpdate('IMMEDIATELY'),
    })
    return element.id
  }

  deleteByIds(ids: string[]) {
    if (!ids.length) return
    const next = this.api.getSceneElementsIncludingDeleted().map((element: any) => (
      ids.includes(element.id)
        ? { ...element, isDeleted: true }
        : element
    ))
    this.api.updateScene({
      elements: next as any,
      captureUpdate: toCaptureUpdate('IMMEDIATELY'),
    })
  }

  getElementBounds(id: string) {
    const element = this.api.getSceneElementsIncludingDeleted().find((candidate: any) => candidate.id === id)
    return element ? getElementBounds(element as ExcalidrawElementLike) : null
  }

  getViewportBounds() {
    return getVisibleBounds(this.api)
  }

  listElementIds() {
    return this.api.getSceneElements().map((element) => element.id)
  }

  async exportPng() {
    const elements = this.api.getSceneElements()
    if (!elements.length) return null
    return this.utils.exportToBlob({
      elements: elements as any,
      appState: {
        ...this.api.getAppState(),
        exportBackground: true,
        viewBackgroundColor: '#12160f',
      } as any,
      files: this.api.getFiles(),
      mimeType: 'image/png',
    } as any)
  }

  onChange(listener: (change: CanvasEngineChange) => void) {
    return this.api.onChange((_elements, _appState, _files) => {
      const snapshot = this.getSnapshot()
      if (snapshot) {
        listener({ snapshot })
      }
    })
  }
}
