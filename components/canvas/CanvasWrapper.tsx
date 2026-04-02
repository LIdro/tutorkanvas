'use client'
// ─────────────────────────────────────────────
// TutorKanvas — CanvasWrapper
// Tldraw infinite canvas with session auto-save.
// ─────────────────────────────────────────────

import { useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react'
import { Tldraw, useEditor, getSnapshot, createShapeId, Box, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { saveCanvasState } from '@/lib/session'
import { executeCanvasActions } from '@/lib/canvas-actions'
import { debounce } from '@/lib/utils'
import { DemonstrationRuntime } from '@/lib/demonstration-runtime'
import {
  circleNode,
  crossOutNode,
  drawArrowBetweenNodes,
  glowNode,
  performBorrow,
  performCarry,
  placeTextAtNode,
  rewriteNodeValue,
  writeAboveNode,
} from '@/lib/demonstration-tools'
import { getNode, updateNodeValue } from '@/lib/lesson-scene'
import type { DemonstrationAction, LessonScene, LessonScript, LessonStep } from '@/types'

type SnapshotStoreRecord = {
  typeName?: string
  type?: string
  props?: {
    src?: string
    assetId?: string
  }
}

type SnapshotLike = {
  document?: {
    store?: Record<string, SnapshotStoreRecord>
  }
}

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
    const editorRef = useRef<Editor | null>(null)
    const transientShapeIdsRef = useRef<string[]>([])
    const presentationTokenRef = useRef(0)

    useImperativeHandle(ref, () => ({
      getSnapshot: () => editorRef.current ? getSnapshot(editorRef.current.store) : null,
      exportPng: async () => {
        if (!editorRef.current) return
        const shapeIds = editorRef.current.getCurrentPageShapeIds()
        if (!shapeIds.size) return
        const result = await editorRef.current.toImage([...shapeIds], { format: 'png', pixelRatio: 2 })
        const url = URL.createObjectURL(result.blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tutorkanvas-${sessionId ?? Date.now()}.png`
        a.click()
        URL.revokeObjectURL(url)
      },
      executeActions: (actions) => {
        if (!editorRef.current) return
        presentationTokenRef.current += 1
        clearTransientShapes(editorRef.current, transientShapeIdsRef.current)
        transientShapeIdsRef.current = executeCanvasActions(editorRef.current, actions)
      },
      playChalkTalk: async (segments, options) => {
        if (!editorRef.current) return
        const editor = editorRef.current
        const token = ++presentationTokenRef.current
        clearTransientShapes(editor, transientShapeIdsRef.current)
        transientShapeIdsRef.current = []

        const createdShapeIds: string[] = []
        const viewportBounds = editor.getViewportPageBounds()
        const zones = getTeachingBoardZones(viewportBounds)
        createdShapeIds.push(...createTeachingBoardGuides(editor, zones))
        let aggregateBounds: Box | null = null
        let commentaryShapeIds: string[] = []

        for (const segment of segments) {
          if (token !== presentationTokenRef.current) return
          if (!segment.trim()) continue

          clearTransientShapes(editor, commentaryShapeIds)
          commentaryShapeIds = []

          const boardStep = analyzeTeachingSegment(segment, zones)
          const revealTasks: Array<Promise<void>> = []

          if (boardStep.commentary) {
            const commentaryId = createCommentaryShape(editor, boardStep.commentary, { animate: true })
            commentaryShapeIds.push(commentaryId)
            createdShapeIds.push(commentaryId)
            revealTasks.push(
              revealTextShape(editor, commentaryId, boardStep.commentary.text, {
                layout: boardStep.commentary,
                durationMs: getRevealDurationMs(boardStep.commentary.text, 700, 1800),
              })
            )
          }

          for (const workingItem of boardStep.working) {
            const layout = getWorkingLayout(workingItem, zones, aggregateBounds)
            const id = layout.renderAsEquation
              ? await createEquationShape(editor, layout)
              : createChalkTextShape(editor, layout, { animate: true })
            createdShapeIds.push(id)
            if (!layout.renderAsEquation) {
              revealTasks.push(
                revealTextShape(editor, id, layout.text, {
                  layout,
                  durationMs: getRevealDurationMs(layout.text, 900, 2400),
                })
              )
            }
            const shapeBounds = editor.getShapePageBounds(id as any)
            if (!shapeBounds) continue
            aggregateBounds = aggregateBounds ? Box.Common([aggregateBounds, shapeBounds]) : shapeBounds.clone()
          }

          if (aggregateBounds) {
            revealWorkingBounds(editor, aggregateBounds)
          }

          const speechTask = speakWithAutoContinue(options?.speak, segment)
          await Promise.all([
            speechTask,
            Promise.all(revealTasks),
          ])

          await wait(options?.stepPauseMs ?? 1200)
        }

        transientShapeIdsRef.current = createdShapeIds
      },
      playLessonScript: async (script, options) => {
        if (!editorRef.current) return
        const editor = editorRef.current
        const token = ++presentationTokenRef.current
        clearTransientShapes(editor, transientShapeIdsRef.current)
        transientShapeIdsRef.current = []
        const before = new Set(editor.getCurrentPageShapeIds())
        let scene = renderLessonScene(editor, script.scene)
        const runtime = new DemonstrationRuntime({
          speak: async (text) => {
            await options?.speak?.(text)
          },
          onAction: async (action, currentScene) => {
            scene = executeDemonstrationAction(editor, currentScene, action)
            return scene
          },
        })
        runtime.setScene(scene)

        for (const [index, step] of script.steps.entries()) {
          if (token !== presentationTokenRef.current) return
          options?.onStepStart?.(step, index)
          await runtime.playStep(step)
          scene = runtime.getScene() ?? scene
          if (options?.stepPauseMs) {
            await wait(options.stepPauseMs)
          }
        }

        transientShapeIdsRef.current = [...editor.getCurrentPageShapeIds()].filter((id) => !before.has(id))
      },
    }))

    return (
      <div className="absolute inset-0">
        <Tldraw
          onMount={(editor) => {
            editorRef.current = editor
            // Apply dark mode from system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            editor.user.updateUserPreferences({ colorScheme: prefersDark ? 'dark' : 'light' })
            editor.setCurrentTool('draw')
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
                // Strip image shapes whose src is a blob: URL – blob URLs
                // don't survive page reloads so tldraw would throw
                // EncodingError trying to decode them.
                const snap = sanitizeSnapshotForRestore(initialSnapshot)
                loadSnapshot(editor.store, snap as any)
              } catch { /* ignore */ }
            }
          }}
          hideUi
        >
          <CanvasInner
            sessionId={sessionId}
            onCanvasChange={onCanvasChange}
            onEditorReady={(editor) => {
              editorRef.current = editor
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

function renderLessonScene(editor: Editor, scene: LessonScene): LessonScene {
  const nextNodes = { ...scene.nodes }

  editor.run(() => {
    for (const node of Object.values(scene.nodes)) {
      if (node.role === 'borrow_anchor' || node.role === 'carry_anchor') continue

      if (node.role === 'answer_line') {
        const shapeId = drawArrowBetweenNodes(
          editor,
          {
            ...scene,
            nodes: {
              a: { id: 'a', role: 'tmp', x: node.x, y: node.y, width: 0, height: 0 },
              b: { id: 'b', role: 'tmp', x: node.x + node.width, y: node.y, width: 0, height: 0 },
            },
          },
          'a',
          'b',
          'black'
        )
        nextNodes[node.id] = { ...node, shapeId: shapeId ?? undefined }
        continue
      }

      if (node.value) {
        const shapeId = placeTextAtNode(editor, scene, node.id, node.value)
        nextNodes[node.id] = { ...node, shapeId: shapeId ?? undefined }
      }
    }
  })

  return {
    ...scene,
    nodes: nextNodes,
  }
}

function clearTransientShapes(editor: Editor, shapeIds: string[]) {
  if (!shapeIds.length) return
  const currentShapeIds = editor.getCurrentPageShapeIds()
  const existingShapeIds = shapeIds.filter((shapeId) => currentShapeIds.has(shapeId as any))
  if (existingShapeIds.length) {
    editor.deleteShapes(existingShapeIds as any)
  }
}

function createChalkTextShape(
  editor: Editor,
  layout: ChalkSegmentLayout,
  options?: { animate?: boolean }
): string {
  const id = createShapeId(`chalk-${crypto.randomUUID()}`) as unknown as string
  editor.createShape({
    id,
    type: 'text',
    x: layout.x,
    y: layout.y,
    props: {
      richText: toRichText(options?.animate ? getRevealSeedText(layout.text) : layout.text) as any,
      size: layout.size,
      color: 'white',
      font: 'draw',
      textAlign: layout.textAlign,
      autoSize: layout.autoSize,
      w: layout.width,
      scale: 1,
    },
  } as any)
  return id
}

type ChalkSize = 's' | 'm' | 'l' | 'xl'

type ChalkSegmentLayout = {
  x: number
  y: number
  width: number
  text: string
  size: ChalkSize
  textAlign: 'start' | 'middle'
  isMath: boolean
  renderAsEquation: boolean
  autoSize: boolean
}

type TeachingBoardZones = {
  commentary: Box
  workspace: Box
}

type TeachingBoardStep = {
  commentary: ChalkSegmentLayout | null
  working: string[]
}

function getWorkingLayout(text: string, zones: TeachingBoardZones, aggregateBounds: Box | null): ChalkSegmentLayout {
  return getChalkLayout(text, zones.workspace, aggregateBounds)
}

function getChalkLayout(text: string, viewportBounds: Box, aggregateBounds: Box | null): ChalkSegmentLayout {
  const isMath = looksLikeMathExpression(text)
  const preset = pickChalkPreset(text, isMath)
  const width = Math.max(240, Math.min(viewportBounds.width - 96, preset.maxWidthRatio * viewportBounds.width))
  const wrappedText = isMath ? text.trim() : wrapTextForBoard(text, preset.charsPerLine)
  const gap = 24 / Math.max(0.75, viewportBounds.width / 900)
  const y = aggregateBounds ? aggregateBounds.maxY + gap : viewportBounds.minY + 40

  if (!aggregateBounds && preset.textAlign === 'middle') {
    return {
      x: viewportBounds.center.x,
      y,
      width,
      text: wrappedText,
      size: preset.size,
      textAlign: 'middle',
      isMath,
      renderAsEquation: shouldRenderEquation(text),
      autoSize: isMath,
    }
  }

  return {
    x: aggregateBounds ? aggregateBounds.minX : viewportBounds.minX + 48,
    y,
    width,
    text: wrappedText,
    size: preset.size,
    textAlign: 'start',
    isMath,
    renderAsEquation: shouldRenderEquation(text),
    autoSize: !wrappedText.includes('\n'),
  }
}

function getTeachingBoardZones(viewportBounds: Box): TeachingBoardZones {
  const rightGutter = Math.max(120, viewportBounds.width * 0.14)
  const commentaryWidth = Math.max(180, viewportBounds.width * 0.2)
  const commentaryHeight = Math.max(140, viewportBounds.height * 0.24)
  const workspaceWidth = Math.min(
    viewportBounds.width * 0.54,
    viewportBounds.width - commentaryWidth - rightGutter - 140
  )

  return {
    commentary: new Box(
      viewportBounds.maxX - commentaryWidth - rightGutter,
      viewportBounds.minY + 24,
      commentaryWidth,
      commentaryHeight
    ),
    workspace: new Box(
      viewportBounds.minX + 36,
      viewportBounds.minY + 72,
      Math.max(320, workspaceWidth),
      viewportBounds.height * 1.8
    ),
  }
}

function createTeachingBoardGuides(editor: Editor, zones: TeachingBoardZones): string[] {
  const ids: string[] = []
  ids.push(createZoneLabel(editor, zones.workspace.minX, zones.workspace.minY - 36, 'Working'))
  ids.push(createZoneLabel(editor, zones.commentary.minX, zones.commentary.minY - 36, 'Teacher note'))
  ids.push(createUnderline(editor, zones.workspace.minX, zones.workspace.minY - 8, zones.workspace.width * 0.34))
  ids.push(createUnderline(editor, zones.commentary.minX, zones.commentary.minY - 8, zones.commentary.width * 0.48))
  return ids
}

function analyzeTeachingSegment(segment: string, zones: TeachingBoardZones): TeachingBoardStep {
  const normalized = segment.trim()
  const commentaryText = buildCommentaryCue(normalized)
  const workingItems = extractWorkingItems(normalized)

  return {
    commentary: commentaryText
      ? {
          x: zones.commentary.minX,
          y: zones.commentary.minY,
          width: zones.commentary.width,
          text: commentaryText,
          size: 'm',
          textAlign: 'start',
          isMath: false,
          renderAsEquation: false,
          autoSize: false,
        }
      : null,
    working: workingItems,
  }
}

function buildCommentaryCue(segment: string): string {
  const stripped = segment.replace(/\s+/g, ' ').trim()
  const stepMatch = stripped.match(/^(step\s*\d+[:.]?\s*)(.*)$/i)
  const firstSentence = (stepMatch
    ? `${stepMatch[1].trim()} ${stepMatch[2].split(/(?<=[.!?])\s+/)[0]?.trim() ?? ''}`.trim()
    : stripped.split(/(?<=[.!?])\s+/)[0]?.trim() ?? stripped)
  return wrapTextForBoard(firstSentence, 14)
}

function extractWorkingItems(segment: string): string[] {
  const items = normalizeWorkingItems([
    ...extractSymbolicExpressions(segment),
    ...extractDivisionForms(segment),
    ...extractDigitStatements(segment),
  ])
  return items
}

function normalizeWorkingItems(items: string[]): string[] {
  const seen = new Set<string>()
  const cleaned: string[] = []

  for (const raw of items) {
    const item = raw.replace(/\s+/g, ' ').trim()
    if (!item || seen.has(item)) continue
    seen.add(item)
    cleaned.push(item)
  }

  return cleaned.slice(0, 3)
}

function extractSymbolicExpressions(segment: string): string[] {
  return Array.from(segment.matchAll(/\b\d[\d,]*(?:\s*[+\-×÷/*=]\s*\d[\d,]*)+(?:\s*=\s*\d[\d,]*)?/g))
    .map((match) => match[0])
}

function extractDivisionForms(segment: string): string[] {
  const items: string[] = []
  const directDivision = segment.match(/\bdivide\s+(\d[\d,]*)\s+by\s+(\d[\d,]*)/i)
  if (directDivision) items.push(`${directDivision[1]} ÷ ${directDivision[2]}`)

  const houseDivision = segment.match(/\bwrite\s+(\d[\d,]*)\s+inside.*?(\d[\d,]*)\s+outside/i)
  if (houseDivision) items.push(`${houseDivision[2]} ⟌ ${houseDivision[1]}`)

  const goesInto = segment.match(/\b(\d[\d,]*)\s+goes\s+into\s+(\d[\d,]*)\s+(\w+)/i)
  if (goesInto) items.push(`${goesInto[1]} ⟌ ${goesInto[2]}`)

  return items
}

function extractDigitStatements(segment: string): string[] {
  const items: string[] = []
  const numberMatches = segment.match(/\b\d[\d,]*\b/g) ?? []
  if (numberMatches.length >= 2 && numberMatches.length <= 4) {
    items.push(numberMatches.join('   '))
  }
  return items
}

function createCommentaryShape(
  editor: Editor,
  layout: ChalkSegmentLayout,
  options?: { animate?: boolean }
): string {
  return createChalkTextShape(editor, layout, options)
}

function pickChalkPreset(text: string, isMath: boolean): {
  size: ChalkSize
  charsPerLine: number
  maxWidthRatio: number
  textAlign: 'start' | 'middle'
} {
  const length = text.trim().length

  if (isMath) {
    if (length <= 18) return { size: 'xl', charsPerLine: 18, maxWidthRatio: 0.92, textAlign: 'middle' }
    if (length <= 42) return { size: 'l', charsPerLine: 42, maxWidthRatio: 1.1, textAlign: 'middle' }
    return { size: 'm', charsPerLine: 80, maxWidthRatio: 1.4, textAlign: 'start' }
  }

  if (length <= 6) return { size: 'xl', charsPerLine: 8, maxWidthRatio: 0.4, textAlign: 'middle' }
  if (length <= 18) return { size: 'xl', charsPerLine: 16, maxWidthRatio: 0.55, textAlign: 'middle' }
  if (length <= 60) return { size: 'l', charsPerLine: 22, maxWidthRatio: 0.7, textAlign: 'start' }
  if (length <= 140) return { size: 'm', charsPerLine: 32, maxWidthRatio: 0.82, textAlign: 'start' }
  return { size: 's', charsPerLine: 40, maxWidthRatio: 0.88, textAlign: 'start' }
}

function wrapTextForBoard(text: string, charsPerLine: number): string {
  const lines: string[] = []
  const paragraphs = text.split('\n').map((line) => line.trim()).filter(Boolean)

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let current = ''

    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (current && next.length > charsPerLine) {
        lines.push(current)
        current = word
      } else {
        current = next
      }
    }

    if (current) lines.push(current)
  }

  return lines.join('\n')
}

function looksLikeMathExpression(text: string): boolean {
  const trimmed = text.trim()
  const symbolCount = (trimmed.match(/[=+\-*/÷×^()[\]{}]/g) ?? []).length
  const digitCount = (trimmed.match(/\d/g) ?? []).length
  return symbolCount >= 2 || (digitCount >= 3 && /\d+\s*[=+\-*/÷×]/.test(trimmed))
}

function revealWorkingBounds(editor: Editor, bounds: Box) {
  const viewportBounds = editor.getViewportPageBounds()
  const needsHorizontalFit = bounds.width > viewportBounds.width * 0.72
  const needsVerticalFit = bounds.height > viewportBounds.height * 0.8

  if (needsHorizontalFit) {
    editor.zoomToBounds(bounds.clone().expandBy(32), {
      animation: { duration: 250 },
      inset: 32,
    } as any)
    return
  }

  if (needsVerticalFit || bounds.maxY > viewportBounds.maxY - 80) {
    const currentCamera = editor.getCamera()
    const targetTop = Math.max(bounds.maxY - viewportBounds.height + 120, bounds.minY - 24)
    editor.setCamera(
      {
        x: currentCamera.x,
        y: -targetTop,
        z: currentCamera.z,
      },
      { animation: { duration: 220 } } as any
    )
  }
}

function shouldRenderEquation(text: string): boolean {
  const trimmed = text.trim()
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  return looksLikeMathExpression(trimmed) && wordCount <= 10 && /[=+\-*/÷×()[\]{}]/.test(trimmed)
}

async function createEquationShape(editor: Editor, layout: ChalkSegmentLayout): Promise<string> {
  return createChalkTextShape(editor, {
    ...layout,
    text: formatEquationForBoard(layout.text),
    autoSize: true,
  })
}

function createZoneLabel(editor: Editor, x: number, y: number, text: string): string {
  const id = createShapeId(`zone-${crypto.randomUUID()}`) as unknown as string
  editor.createShape({
    id,
    type: 'text',
    x,
    y,
    props: {
      richText: toRichText(text) as any,
      size: 'm',
      color: 'yellow',
      font: 'draw',
      textAlign: 'start',
      autoSize: true,
      w: 220,
      scale: 1,
    },
  } as any)
  return id
}

function createUnderline(editor: Editor, x: number, y: number, width: number): string {
  const id = createShapeId(`zone-line-${crypto.randomUUID()}`) as unknown as string
  editor.createShape({
    id,
    type: 'arrow',
    x,
    y,
    props: {
      color: 'yellow',
      start: { x: 0, y: 0 },
      end: { x: width, y: 0 },
      arrowheadStart: 'none',
      arrowheadEnd: 'none',
    },
  } as any)
  return id
}

async function revealTextShape(
  editor: Editor,
  shapeId: string,
  fullText: string,
  options: {
    layout: ChalkSegmentLayout
    durationMs: number
  }
) {
  const normalizedText = fullText.trim()
  if (!normalizedText) return

  const steps = Math.max(4, Math.min(18, Math.ceil(normalizedText.length / 8)))
  const intervalMs = Math.max(45, Math.floor(options.durationMs / steps))

  for (let step = 1; step <= steps; step += 1) {
    const shape = editor.getShape(shapeId as any)
    if (!shape) return

    const visibleText = getRevealTextSlice(normalizedText, step / steps)
    editor.updateShape({
      id: shapeId,
      type: 'text',
      props: {
        richText: toRichText(visibleText) as any,
        w: options.layout.width,
      },
    } as any)

    if (step < steps) {
      await wait(intervalMs)
    }
  }
}

function getRevealSeedText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return getRevealTextSlice(trimmed, 0.12)
}

function getRevealTextSlice(text: string, progress: number): string {
  const targetLength = Math.max(1, Math.min(text.length, Math.ceil(text.length * progress)))
  let slice = text.slice(0, targetLength)

  const lastWhitespace = slice.lastIndexOf(' ')
  if (targetLength < text.length && lastWhitespace > 0 && targetLength < text.length - 2) {
    slice = slice.slice(0, lastWhitespace)
  }

  return slice.trimEnd() || text.slice(0, 1)
}

function getRevealDurationMs(text: string, minMs: number, maxMs: number): number {
  const estimated = text.trim().length * 32
  return Math.max(minMs, Math.min(maxMs, estimated))
}

function formatEquationForBoard(text: string): string {
  return text
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s*\*\s*/g, ' × ')
    .replace(/\s*\+\s*/g, ' + ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s+/g, ' ')
    .trim()
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function speakWithAutoContinue(
  speak: ((text: string) => Promise<void> | void) | undefined,
  text: string
) {
  if (!speak) return

  await Promise.race([
    Promise.resolve(speak(text)),
    wait(30000),
  ])
}

function executeDemonstrationAction(editor: Editor, scene: LessonScene, action: DemonstrationAction): LessonScene {
  switch (action.type) {
    case 'place_problem':
      return scene
    case 'highlight_symbol':
      if (action.style === 'glow') {
        glowNode(editor, scene, action.target, action.color)
      } else {
        circleNode(editor, scene, action.target, action.color)
      }
      return scene
    case 'focus_column': {
      const prefixes = ['minuend', 'subtrahend', 'result', 'borrow.anchor', 'carry.anchor']
      for (const prefix of prefixes) {
        glowNode(editor, scene, `${prefix}.${action.column}`, 'yellow')
      }
      return scene
    }
    case 'cross_out':
      crossOutNode(editor, scene, action.target)
      return scene
    case 'write_annotation':
      writeAboveNode(editor, scene, action.target, action.text, action.placement, action.color)
      return scene
    case 'borrow_from_column':
      return performBorrow(editor, scene, action.from, action.to).scene
    case 'carry_to_column':
      return performCarry(editor, scene, action.from, action.to, action.value ?? '1').scene
    case 'reveal_result': {
      const node = getNode(scene, action.target)
      if (!node) return scene
      if (node.value) {
        const rewritten = rewriteNodeValue(editor, scene, action.target, action.text)
        return rewritten?.scene ?? scene
      }
      placeTextAtNode(editor, scene, action.target, action.text)
      return updateNodeValue(scene, action.target, action.text)
    }
    case 'ask_check_question':
      return scene
    case 'pause':
      return scene
    default:
      return scene
  }
}

function sanitizeSnapshotForRestore(initialSnapshot: unknown): SnapshotLike {
  const snap = structuredClone((initialSnapshot ?? {}) as SnapshotLike)
  const store = snap?.document?.store
  if (!store) return snap

  const invalidAssetIds = new Set<string>()

  for (const [key, record] of Object.entries(store)) {
    const src = record?.props?.src
    const assetId = record?.props?.assetId

    const isImageShape = record?.typeName === 'shape' && record?.type === 'image'
    const isAssetRecord = record?.typeName === 'asset'
    const hasInvalidSrc = typeof src === 'string' && !isRestorableImageSrc(src)

    if (isAssetRecord && hasInvalidSrc) {
      invalidAssetIds.add(key)
      delete store[key]
      continue
    }

    if (isImageShape && (hasInvalidSrc || (assetId && invalidAssetIds.has(assetId)))) {
      delete store[key]
    }
  }

  for (const [key, record] of Object.entries(store)) {
    const assetId = record?.props?.assetId
    if (record?.typeName === 'shape' && record?.type === 'image' && assetId && !store[assetId]) {
      delete store[key]
    }
  }

  return snap
}

function isRestorableImageSrc(src: string): boolean {
  return src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')
}
