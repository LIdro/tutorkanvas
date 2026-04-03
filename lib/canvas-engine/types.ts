import type { CanvasEngineKind, CanvasRuntimeMetadata, CanvasSnapshotEnvelope } from '@/types'

export interface CanvasViewportBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
  center: {
    x: number
    y: number
  }
}

export interface CanvasElementBounds {
  x: number
  y: number
  width: number
  height: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface CanvasTextInput {
  x: number
  y: number
  text: string
  color?: string
  width?: number
  size?: 's' | 'm' | 'l' | 'xl'
  align?: 'start' | 'middle' | 'end'
  autoSize?: boolean
  metadata?: CanvasRuntimeMetadata
}

export interface CanvasRectangleInput {
  x: number
  y: number
  width: number
  height: number
  color?: string
  fill?: 'none' | 'semi' | 'solid'
  metadata?: CanvasRuntimeMetadata
}

export interface CanvasEllipseInput extends CanvasRectangleInput {}

export interface CanvasLineInput {
  x: number
  y: number
  width: number
  height: number
  color?: string
  metadata?: CanvasRuntimeMetadata
}

export interface CanvasArrowInput {
  x: number
  y: number
  endX: number
  endY: number
  color?: string
  metadata?: CanvasRuntimeMetadata
}

export interface CanvasEngineChange {
  snapshot: CanvasSnapshotEnvelope
}

export interface CanvasEngine {
  readonly kind: CanvasEngineKind
  getSnapshot(): CanvasSnapshotEnvelope | null
  loadSnapshot(snapshot: unknown): Promise<void> | void
  clearScene(): void
  resetTransientLayer(): void
  addText(input: CanvasTextInput): string
  addRectangle(input: CanvasRectangleInput): string
  addEllipse(input: CanvasEllipseInput): string
  addLine(input: CanvasLineInput): string
  addArrow(input: CanvasArrowInput): string
  deleteByIds(ids: string[]): void
  getElementBounds(id: string): CanvasElementBounds | null
  getViewportBounds(): CanvasViewportBounds
  listElementIds(): string[]
  exportPng(): Promise<Blob | null>
  onChange?(listener: (change: CanvasEngineChange) => void): () => void
}
