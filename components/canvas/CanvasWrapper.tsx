'use client'

import dynamic from 'next/dynamic'
import { debounce } from '@/lib/utils'
import { exportCanvasPng, playChalkTalk, playLessonScript, runCanvasActions } from '@/lib/canvas-runtime'
import { normalizeCanvasSnapshot } from '@/lib/canvas-engine/snapshots'
import { ExcalidrawCanvasEngine } from '@/lib/canvas-engine/excalidraw-adapter'
import { TldrawCanvasEngine } from '@/lib/canvas-engine/tldraw-adapter'
import type { CanvasEngine } from '@/lib/canvas-engine/types'
import type { CanvasAction, CanvasEngineKind, LessonScript, LessonStep } from '@/types'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Tldraw, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import '@excalidraw/excalidraw/index.css'

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false }
)

interface CanvasWrapperProps {
  sessionId?: string
  initialSnapshot?: unknown
  engine?: CanvasEngineKind
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
  ({ sessionId, initialSnapshot, engine = 'tldraw', onEditorReady, onCanvasChange }, ref) => {
    const engineRef = useRef<CanvasEngine | null>(null)
    const transientIdsRef = useRef<string[]>([])
    const mountedSnapshotRef = useRef(false)
    const [prefersDark, setPrefersDark] = useState(true)
    const [activeEngine, setActiveEngine] = useState<CanvasEngine | null>(null)

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

    const attachEngine = useCallback((nextEngine: CanvasEngine) => {
      engineRef.current = nextEngine
      setActiveEngine(nextEngine)
      if (!mountedSnapshotRef.current && initialSnapshot) {
        nextEngine.loadSnapshot(initialSnapshot)
        mountedSnapshotRef.current = true
      }
      onEditorReady?.(nextEngine)
    }, [initialSnapshot, onEditorReady, save])

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
        currentEngine.clearScene()
      },
    }), [sessionId])

    const normalizedSnapshot = useMemo(() => normalizeCanvasSnapshot(initialSnapshot, engine), [initialSnapshot, engine])

    return (
      <div className="absolute inset-0">
        {engine === 'excalidraw' ? (
          <Excalidraw
            theme={prefersDark ? 'dark' : 'light'}
            initialData={(normalizedSnapshot?.engine === 'excalidraw'
              ? (normalizedSnapshot.scene as { elements?: unknown[]; appState?: object })
              : undefined) as any}
            excalidrawAPI={(api) => {
              if (!api) return
              void import('@excalidraw/excalidraw').then((mod) => {
                attachEngine(new ExcalidrawCanvasEngine(api as any, {
                  convertToExcalidrawElements: mod.convertToExcalidrawElements as any,
                  exportToBlob: mod.exportToBlob as any,
                }))
              })
            }}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                saveAsImage: false,
              },
            }}
          />
        ) : (
          <Tldraw
            hideUi
            onMount={(editor) => {
              const nextEngine = new TldrawCanvasEngine(editor as Editor)
              attachEngine(nextEngine)
              editor.setCurrentTool('draw')
              editor.user.updateUserPreferences({ colorScheme: prefersDark ? 'dark' : 'light' })
            }}
          />
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
