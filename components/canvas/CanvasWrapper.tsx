'use client'
// ─────────────────────────────────────────────
// TutorKanvas — CanvasWrapper
// Tldraw infinite canvas with session auto-save.
// ─────────────────────────────────────────────

import { useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Tldraw, useEditor, getSnapshot, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { saveCanvasState } from '@/lib/session'
import { executeCanvasActions } from '@/lib/canvas-actions'
import { debounce } from '@/lib/utils'

interface CanvasWrapperProps {
  sessionId?: string
  initialSnapshot?: unknown
  onEditorReady?: (editor: Editor) => void
  /** Called with the raw store snapshot whenever the canvas changes (debounced 2s) */
  onCanvasChange?: (snapshot: object) => void
}

export interface CanvasWrapperRef {
  getSnapshot: () => unknown
  exportPng: () => Promise<void>
  executeActions: (actions: import('@/types').CanvasAction[]) => void
}

// Inner component that has access to the editor context
function CanvasInner({
  sessionId,
  onEditorReady,
  onCanvasChange,
}: {
  sessionId?: string
  onEditorReady?: (editor: Editor) => void
  onCanvasChange?: (snapshot: object) => void
}) {
  const editor = useEditor()

  // Auto-save on canvas change (debounced 2s)
  const save = useCallback(
    debounce(async () => {
      const snapshot = getSnapshot(editor.store) as object
      if (sessionId) await saveCanvasState(sessionId, snapshot)
      onCanvasChange?.(snapshot)
    }, 2000),
    [editor, sessionId, onCanvasChange]
  )

  useEffect(() => {
    if (onEditorReady) onEditorReady(editor)
    const cleanup = editor.store.listen(save)
    return () => { cleanup() }
  }, [editor, onEditorReady, save])

  return null
}

const CanvasWrapper = forwardRef<CanvasWrapperRef, CanvasWrapperProps>(
  ({ sessionId, initialSnapshot, onEditorReady, onCanvasChange }, ref) => {
    let editorRef: Editor | null = null

    useImperativeHandle(ref, () => ({
      getSnapshot: () => editorRef ? getSnapshot(editorRef.store) : null,
      exportPng: async () => {
        if (!editorRef) return
        const shapeIds = editorRef.getCurrentPageShapeIds()
        if (!shapeIds.size) return
        const result = await editorRef.toImage([...shapeIds], { format: 'png', pixelRatio: 2 })
        const url = URL.createObjectURL(result.blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tutorkanvas-${sessionId ?? Date.now()}.png`
        a.click()
        URL.revokeObjectURL(url)
      },
      executeActions: (actions) => {
        if (!editorRef) return
        executeCanvasActions(editorRef, actions)
      },
    }))

    return (
      <div className="absolute inset-0">
        <Tldraw
          onMount={(editor) => {
            editorRef = editor
            // Apply dark mode from system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            editor.user.updateUserPreferences({ colorScheme: prefersDark ? 'dark' : 'light' })
            // Listen for system theme changes
            const mq = window.matchMedia('(prefers-color-scheme: dark)')
            const handler = (e: MediaQueryListEvent) => {
              editor.user.updateUserPreferences({ colorScheme: e.matches ? 'dark' : 'light' })
            }
            mq.addEventListener('change', handler)
            // Restore snapshot if provided
            if (initialSnapshot) {
              try {
                const { loadSnapshot } = require('tldraw')
                loadSnapshot(editor.store, initialSnapshot as any)
              } catch { /* ignore */ }
            }
          }}
          hideUi={false}
        >
          <CanvasInner
            sessionId={sessionId}
            onCanvasChange={onCanvasChange}
            onEditorReady={(editor) => {
              editorRef = editor
              onEditorReady?.(editor)
            }}
          />
        </Tldraw>
      </div>
    )
  }
)

CanvasWrapper.displayName = 'CanvasWrapper'
export default CanvasWrapper
