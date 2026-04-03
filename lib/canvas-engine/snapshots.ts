import type { CanvasEngineKind, CanvasSnapshotEnvelope } from '@/types'

export function createCanvasSnapshotEnvelope(input: {
  engine: CanvasEngineKind
  scene: unknown
  files?: Record<string, unknown> | null
  session?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  legacy?: CanvasSnapshotEnvelope['legacy']
}): CanvasSnapshotEnvelope {
  return {
    version: 1,
    engine: input.engine,
    scene: input.scene,
    files: input.files ?? null,
    session: input.session ?? null,
    metadata: input.metadata ?? null,
    legacy: input.legacy ?? null,
  }
}

export function isCanvasSnapshotEnvelope(value: unknown): value is CanvasSnapshotEnvelope {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CanvasSnapshotEnvelope>
  return candidate.version === 1 &&
    (candidate.engine === 'tldraw' || candidate.engine === 'excalidraw') &&
    'scene' in candidate
}

export function normalizeCanvasSnapshot(snapshot: unknown, defaultEngine: CanvasEngineKind): CanvasSnapshotEnvelope | null {
  if (!snapshot) return null
  if (isCanvasSnapshotEnvelope(snapshot)) return snapshot
  return createCanvasSnapshotEnvelope({
    engine: defaultEngine,
    scene: snapshot,
    legacy: {
      sourceEngine: defaultEngine,
      originalSnapshot: snapshot,
    },
  })
}

export function getCanvasSnapshotEngine(snapshot: unknown): CanvasEngineKind | null {
  if (!snapshot) return null
  if (isCanvasSnapshotEnvelope(snapshot)) return snapshot.engine
  return 'tldraw'
}
