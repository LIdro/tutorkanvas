'use client'

import dynamic from 'next/dynamic'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import '@excalidraw/excalidraw/index.css'
import { exportCanvasPng, playChalkTalk, playLessonScript, runCanvasActions } from '@/lib/canvas-runtime'
import { ExcalidrawCanvasEngine } from '@/lib/canvas-engine/excalidraw-adapter'
import { isUnsupportedLegacySnapshot, normalizeCanvasSnapshot } from '@/lib/canvas-engine/snapshots'
import type { CanvasEngine } from '@/lib/canvas-engine/types'
import type { CanvasAction, LessonScript, LessonStep } from '@/types'
import { debounce } from '@/lib/utils'

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false }
)

const DEFAULT_CHALK_STROKE = '#f8fafc'
const DEFAULT_CANVAS_BACKGROUND = '#12160f'

interface CanvasWrapperProps {
  sessionId?: string
  initialSnapshot?: unknown
  onEditorReady?: (engine: CanvasEngine) => void
  onCanvasChange?: (snapshot: object) => void
}

export interface CanvasWrapperRef {
  getSnapshot: () => unknown
  exportPng: () => Promise<string | null>
  executeActions: (actions: CanvasAction[]) => void
  playChalkTalk: (
    segments: string[],
    options?: {
      stepPauseMs?: number
      speak?: (text: string) => Promise<void> | void
    }
  ) => Promise<void>
  playLessonScript: (
    script: LessonScript,
    options?: {
      speak?: (text: string) => Promise<void> | void
      onStepStart?: (step: LessonStep, index: number) => void
      stepPauseMs?: number
    }
  ) => Promise<void>
  clear: () => void
}

const CanvasWrapper = forwardRef<CanvasWrapperRef, CanvasWrapperProps>(
  ({ sessionId, initialSnapshot, onEditorReady, onCanvasChange }, ref) => {
    const engineRef = useRef<CanvasEngine | null>(null)
    const transientIdsRef = useRef<string[]>([])
    const [prefersDark, setPrefersDark] = useState(true)
    const [activeEngine, setActiveEngine] = useState<CanvasEngine | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)

    useEffect(() => {
      if (typeof window === 'undefined') return
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      setPrefersDark(mq.matches)
      const handler = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }, [])

    const save = useMemo(() => debounce(() => {
      const snapshot = engineRef.current?.getSnapshot()
      if (snapshot) {
        onCanvasChange?.(snapshot)
      }
    }, 2000), [onCanvasChange])

    const normalizedSnapshot = useMemo(
      () => normalizeCanvasSnapshot(initialSnapshot, 'excalidraw'),
      [initialSnapshot]
    )

    const attachEngine = useCallback((nextEngine: CanvasEngine) => {
      engineRef.current = nextEngine
      setActiveEngine(nextEngine)
      setLoadError(null)

      if (initialSnapshot) {
        if (isUnsupportedLegacySnapshot(initialSnapshot)) {
          setLoadError('This session contains an unsupported legacy canvas snapshot and cannot be restored automatically.')
        } else if (normalizedSnapshot) {
          nextEngine.loadSnapshot(normalizedSnapshot)
        }
      }

      onEditorReady?.(nextEngine)
    }, [initialSnapshot, normalizedSnapshot, onEditorReady])

    useEffect(() => {
      if (!activeEngine?.onChange) return
      return activeEngine.onChange((change) => {
        onCanvasChange?.(change.snapshot)
        save()
      })
    }, [activeEngine, onCanvasChange, save])

    useImperativeHandle(ref, () => ({
      getSnapshot: () => engineRef.current?.getSnapshot() ?? null,
      exportPng: async () => {
        const currentEngine = engineRef.current
        if (!currentEngine) return null
        return exportCanvasPng(currentEngine, sessionId)
      },
      executeActions: (actions) => {
        const currentEngine = engineRef.current
        if (!currentEngine) return
        clearTransientShapes(currentEngine, transientIdsRef.current)
        transientIdsRef.current = runCanvasActions(currentEngine, actions)
      },
      playChalkTalk: async (segments, options) => {
        const currentEngine = engineRef.current
        if (!currentEngine) return
        clearTransientShapes(currentEngine, transientIdsRef.current)
        transientIdsRef.current = await playChalkTalk(currentEngine, segments, options)
      },
      playLessonScript: async (script, options) => {
        const currentEngine = engineRef.current
        if (!currentEngine) return
        clearTransientShapes(currentEngine, transientIdsRef.current)
        const result = await playLessonScript(currentEngine, script, options)
        transientIdsRef.current = result.createdIds
      },
      clear: () => {
        const currentEngine = engineRef.current
        if (!currentEngine) return
        transientIdsRef.current = []
        setLoadError(null)
        currentEngine.clearScene()
      },
    }), [sessionId])

    return (
      <div className="absolute inset-0">
        <Excalidraw
          theme={prefersDark ? 'dark' : 'light'}
          initialData={(() => {
            const restored = normalizedSnapshot?.engine === 'excalidraw'
              ? (normalizedSnapshot.scene as { elements?: unknown[]; appState?: Record<string, unknown> })
              : undefined

            return {
              elements: restored?.elements ?? [],
              appState: {
                ...(restored?.appState ?? {}),
                currentItemStrokeColor: DEFAULT_CHALK_STROKE,
                currentItemBackgroundColor: 'transparent',
                viewBackgroundColor: DEFAULT_CANVAS_BACKGROUND,
                currentItemFillStyle: 'solid',
                currentItemRoughness: 0,
                currentItemStrokeWidth: 2,
              },
            }
          })() as any}
          excalidrawAPI={(api) => {
            if (!api) return
            void import('@excalidraw/excalidraw')
              .then((mod) => {
                attachEngine(new ExcalidrawCanvasEngine(api as any, {
                  convertToExcalidrawElements: mod.convertToExcalidrawElements as any,
                  exportToBlob: mod.exportToBlob as any,
                }))
                api.updateScene({
                  appState: {
                    ...api.getAppState(),
                    currentItemStrokeColor: DEFAULT_CHALK_STROKE,
                    currentItemBackgroundColor: 'transparent',
                    viewBackgroundColor: DEFAULT_CANVAS_BACKGROUND,
                    currentItemFillStyle: 'solid',
                    currentItemRoughness: 0,
                    currentItemStrokeWidth: 2,
                  },
                  captureUpdate: 'NEVER',
                })
                api.setActiveTool({
                  type: 'freedraw',
                  locked: false,
                })
              })
              .catch((error) => {
                console.error('[canvas] Failed to load Excalidraw runtime', error)
                setLoadError('Excalidraw failed to initialize. Check the browser console and deployment logs.')
              })
          }}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveAsImage: false,
            },
          }}
        />

        {loadError && (
          <div className="pointer-events-none absolute inset-x-6 top-6 z-40 rounded-2xl border border-red-400/70 bg-[#301414]/95 px-4 py-3 text-white shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-300">Canvas Error</p>
            <p className="mt-2 text-sm leading-relaxed">{loadError}</p>
          </div>
        )}
      </div>
    )
  }
)

CanvasWrapper.displayName = 'CanvasWrapper'
export default CanvasWrapper

function clearTransientShapes(engine: CanvasEngine, ids: string[]) {
  if (!ids.length) return
  const currentIds = new Set(engine.listElementIds())
  const existing = ids.filter((id) => currentIds.has(id))
  if (existing.length) {
    engine.deleteByIds(existing)
  }
}
