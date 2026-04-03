import { executeCanvasActions } from '@/lib/canvas-actions'
import { DemonstrationRuntime } from '@/lib/demonstration-runtime'
import type { CanvasEngine } from '@/lib/canvas-engine/types'
import {
  circleNode,
  crossOutNode,
  drawArrowBetweenNodes,
  glowNode,
  performBorrow,
  performCarry,
  placeEllipseAtNode,
  placeLineAtNode,
  placeRectangleAtNode,
  placeTextAtNode,
  rewriteNodeValue,
  writeAboveNode,
} from '@/lib/demonstration-tools'
import { getNode, updateNodeValue } from '@/lib/lesson-scene'
import type { CanvasAction, DemonstrationAction, LessonScene, LessonScript, LessonStep } from '@/types'

export async function exportCanvasPng(engine: CanvasEngine, sessionId?: string): Promise<string | null> {
  const blob = await engine.exportPng()
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tutorkanvas-${sessionId ?? Date.now()}.png`
  a.click()
  URL.revokeObjectURL(url)
  return url
}

export function runCanvasActions(engine: CanvasEngine, actions: CanvasAction[]) {
  engine.resetTransientLayer()
  return executeCanvasActions(engine, actions)
}

export async function playChalkTalk(engine: CanvasEngine, segments: string[], options?: {
  stepPauseMs?: number
  speak?: (text: string) => Promise<void> | void
}): Promise<string[]> {
  engine.resetTransientLayer()
  const ids: string[] = []
  const viewport = engine.getViewportBounds()
  const width = Math.max(320, Math.min(680, viewport.width * 0.56))
  let y = viewport.minY + 56

  for (const segment of segments) {
    const text = segment.trim()
    if (!text) continue

    ids.push(engine.addText({
      x: viewport.minX + 48,
      y,
      text,
      color: 'white',
      width,
      size: looksLikeMath(text) ? 'l' : 'm',
      autoSize: true,
      metadata: {
        transient: true,
        programmaticSource: 'chalk',
        runtimeRole: 'chalk-segment',
      },
    }))

    const speakResult = options?.speak ? Promise.resolve(options.speak(text)) : Promise.resolve()
    await Promise.all([speakResult, wait(options?.stepPauseMs ?? 1200)])
    y += looksLikeMath(text) ? 84 : 104
  }

  return ids
}

export function renderLessonScene(engine: CanvasEngine, scene: LessonScene): LessonScene {
  const nextNodes = { ...scene.nodes }

  for (const node of Object.values(scene.nodes)) {
    if (node.role === 'borrow_anchor' || node.role === 'carry_anchor') continue

    if (
      node.role === 'division_bracket_top' ||
      node.role === 'division_bracket_vertical'
    ) {
      const shapeId = placeLineAtNode(engine, scene, node.id, 'white')
      nextNodes[node.id] = { ...node, shapeId: shapeId ?? undefined }
      continue
    }

    if (node.role === 'demo_group_circle') {
      const shapeId = placeEllipseAtNode(engine, scene, node.id, 'light-blue')
      nextNodes[node.id] = { ...node, shapeId: shapeId ?? undefined }
      continue
    }

    if (node.role === 'demo_panel_border') {
      const shapeId = placeRectangleAtNode(engine, scene, node.id, 'light-blue')
      nextNodes[node.id] = { ...node, shapeId: shapeId ?? undefined }
      continue
    }

    if (node.role === 'answer_line') {
      const shapeId = engine.addLine({
        x: node.x,
        y: node.y,
        width: node.width,
        height: 0,
        color: 'black',
        metadata: {
          semanticNodeId: node.id,
          runtimeRole: 'answer-line',
          transient: true,
          programmaticSource: 'lesson',
        },
      })
      nextNodes[node.id] = { ...node, shapeId: shapeId ?? undefined }
      continue
    }

    if (node.value) {
      const shapeId = placeTextAtNode(engine, scene, node.id, node.value)
      nextNodes[node.id] = { ...node, shapeId: shapeId ?? undefined }
    }
  }

  return {
    ...scene,
    nodes: nextNodes,
  }
}

export async function playLessonScript(engine: CanvasEngine, script: LessonScript, options?: {
  speak?: (text: string) => Promise<void> | void
  onStepStart?: (step: LessonStep, index: number) => void
  stepPauseMs?: number
}): Promise<{ scene: LessonScene; createdIds: string[] }> {
  engine.resetTransientLayer()
  const before = new Set(engine.listElementIds())
  let scene = renderLessonScene(engine, script.scene)
  const runtime = new DemonstrationRuntime({
    speak: async (text) => {
      await options?.speak?.(text)
    },
    onAction: async (action, currentScene) => {
      scene = executeDemonstrationAction(engine, currentScene, action)
      return scene
    },
  })
  runtime.setScene(scene)

  for (const [index, step] of script.steps.entries()) {
    options?.onStepStart?.(step, index)
    await runtime.playStep(step)
    scene = runtime.getScene() ?? scene
    if (options?.stepPauseMs) {
      await wait(options.stepPauseMs)
    }
  }

  const createdIds = engine.listElementIds().filter((id) => !before.has(id))
  return { scene, createdIds }
}

function executeDemonstrationAction(engine: CanvasEngine, scene: LessonScene, action: DemonstrationAction): LessonScene {
  switch (action.type) {
    case 'place_problem':
      return scene
    case 'highlight_symbol':
      if (action.style === 'glow') {
        glowNode(engine, scene, action.target, action.color)
      } else {
        circleNode(engine, scene, action.target, action.color)
      }
      return scene
    case 'focus_column': {
      const prefixes = ['minuend', 'subtrahend', 'result', 'borrow.anchor', 'carry.anchor']
      for (const prefix of prefixes) {
        glowNode(engine, scene, `${prefix}.${action.column}`, 'yellow')
      }
      return scene
    }
    case 'cross_out':
      crossOutNode(engine, scene, action.target)
      return scene
    case 'write_annotation':
      writeAboveNode(engine, scene, action.target, action.text, action.placement, action.color)
      return scene
    case 'borrow_from_column':
      return performBorrow(engine, scene, action.from, action.to).scene
    case 'carry_to_column':
      return performCarry(engine, scene, action.from, action.to, action.value ?? '1').scene
    case 'reveal_result': {
      const node = getNode(scene, action.target)
      if (!node) return scene
      if (
        node.role === 'division_step_line' ||
        node.role === 'division_bracket_top' ||
        node.role === 'division_bracket_vertical' ||
        node.role === 'demo_group_tally_stroke'
      ) {
        const lineColor = typeof node.meta?.color === 'string' ? node.meta.color : 'white'
        placeLineAtNode(engine, scene, action.target, lineColor)
        return updateNodeValue(scene, action.target, action.text)
      }
      if (node.value) {
        const rewritten = rewriteNodeValue(engine, scene, action.target, action.text)
        return rewritten?.scene ?? scene
      }
      placeTextAtNode(engine, scene, action.target, action.text)
      return updateNodeValue(scene, action.target, action.text)
    }
    case 'ask_check_question':
    case 'pause':
      return scene
    default:
      return scene
  }
}

function looksLikeMath(text: string) {
  return /[=+\-÷/]/.test(text) || /\d/.test(text)
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}
