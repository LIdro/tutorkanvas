import type { CanvasEngine } from '@/lib/canvas-engine/types'
import type { LessonNode, LessonPlacement, LessonScene } from '@/types'
import { getNode, resolvePlacement, updateNodeValue } from '@/lib/lesson-scene'

function createTextShape(
  engine: CanvasEngine,
  x: number,
  y: number,
  text: string,
  color: string = 'white',
  width: number = 240,
  metadata?: Record<string, unknown>
) {
  return engine.addText({
    x,
    y,
    text,
    color,
    width,
    autoSize: true,
    metadata: {
      transient: true,
      programmaticSource: 'lesson',
      ...(metadata ?? {}),
    },
  })
}

function createArrowShape(engine: CanvasEngine, x: number, y: number, endX: number, endY: number, color: string = 'red', metadata?: Record<string, unknown>) {
  return engine.addArrow({
    x,
    y,
    endX,
    endY,
    color,
    metadata: {
      transient: true,
      programmaticSource: 'lesson',
      ...(metadata ?? {}),
    },
  })
}

function createEllipse(engine: CanvasEngine, x: number, y: number, width: number, height: number, color: string = 'blue', fill: 'none' | 'semi' = 'none', metadata?: Record<string, unknown>) {
  return engine.addEllipse({
    x,
    y,
    width,
    height,
    color,
    fill,
    metadata: {
      transient: true,
      programmaticSource: 'lesson',
      ...(metadata ?? {}),
    },
  })
}

function createRectangle(
  engine: CanvasEngine,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string = 'white',
  fill: 'none' | 'semi' = 'none',
  metadata?: Record<string, unknown>
) {
  return engine.addRectangle({
    x,
    y,
    width,
    height,
    color,
    fill,
    metadata: {
      transient: true,
      programmaticSource: 'lesson',
      ...(metadata ?? {}),
    },
  })
}

export function placeEllipseAtNode(
  engine: CanvasEngine,
  scene: LessonScene,
  nodeId: string,
  color: string = 'white',
  fill: 'none' | 'semi' = 'none'
): string | null {
  const node = getNode(scene, nodeId)
  if (!node) return null
  return createEllipse(engine, node.x, node.y, node.width, node.height, color, fill, { semanticNodeId: nodeId, runtimeRole: 'node-ellipse' })
}

function createLine(engine: CanvasEngine, x: number, y: number, width: number, height: number, color: string = 'white', metadata?: Record<string, unknown>) {
  return engine.addLine({
    x,
    y,
    width,
    height,
    color,
    metadata: {
      transient: true,
      programmaticSource: 'lesson',
      ...(metadata ?? {}),
    },
  })
}

export function placeLineAtNode(engine: CanvasEngine, scene: LessonScene, nodeId: string, color: string = 'black'): string | null {
  const node = getNode(scene, nodeId)
  if (!node) return null
  return createLine(engine, node.x, node.y, node.width, node.height, color, { semanticNodeId: nodeId, runtimeRole: 'node-line' })
}

export function placeRectangleAtNode(
  engine: CanvasEngine,
  scene: LessonScene,
  nodeId: string,
  color: string = 'white',
  fill: 'none' | 'semi' = 'none'
): string | null {
  const node = getNode(scene, nodeId)
  if (!node) return null
  return createRectangle(engine, node.x, node.y, node.width, node.height, color, fill, { semanticNodeId: nodeId, runtimeRole: 'node-rectangle' })
}

export function placeTextAtNode(
  engine: CanvasEngine,
  scene: LessonScene,
  nodeId: string,
  text: string,
  color?: string
): string | null {
  const node = getNode(scene, nodeId)
  if (!node) return null
  const resolvedColor = color ?? (typeof node.meta?.color === 'string' ? node.meta.color : 'white')
  return createTextShape(engine, node.x, node.y, text, resolvedColor, node.width, { semanticNodeId: nodeId, runtimeRole: 'node-text' })
}

export function circleNode(engine: CanvasEngine, scene: LessonScene, nodeId: string, color: string = 'blue'): string | null {
  const node = getNode(scene, nodeId)
  if (!node) return null
  return createEllipse(engine, node.x - 8, node.y - 6, node.width + 16, node.height + 12, color, 'none', { semanticNodeId: nodeId, runtimeRole: 'node-circle' })
}

export function glowNode(engine: CanvasEngine, scene: LessonScene, nodeId: string, color: string = 'yellow'): string | null {
  const node = getNode(scene, nodeId)
  if (!node) return null
  return createEllipse(engine, node.x - 10, node.y - 8, node.width + 20, node.height + 16, color, 'semi', { semanticNodeId: nodeId, runtimeRole: 'node-glow' })
}

export function crossOutNode(engine: CanvasEngine, scene: LessonScene, nodeId: string, color: string = 'red'): string[] {
  const node = getNode(scene, nodeId)
  if (!node) return []

  return [
    createLine(engine, node.x, node.y + node.height, node.width, -node.height, color, { semanticNodeId: nodeId, runtimeRole: 'node-cross-out' }),
    createLine(engine, node.x, node.y, node.width, node.height, color, { semanticNodeId: nodeId, runtimeRole: 'node-cross-out' }),
  ]
}

export function writeAboveNode(
  engine: CanvasEngine,
  scene: LessonScene,
  nodeId: string,
  text: string,
  placement: LessonPlacement = 'top-right',
  color: string = 'red'
): string | null {
  const point = resolvePlacement(scene, nodeId, placement, 8)
  if (!point) return null
  return createTextShape(engine, point.x, point.y, text, color, 240, { semanticNodeId: nodeId, runtimeRole: 'node-annotation' })
}

export function drawArrowBetweenNodes(
  engine: CanvasEngine,
  scene: LessonScene,
  fromId: string,
  toId: string,
  color: string = 'red'
): string | null {
  const from = getNode(scene, fromId)
  const to = getNode(scene, toId)
  if (!from || !to) return null

  return createArrowShape(
    engine,
    from.x + from.width / 2,
    from.y + from.height / 2,
    to.x + to.width / 2,
    to.y + to.height / 2,
    color,
    { semanticNodeId: `${fromId}->${toId}`, runtimeRole: 'node-arrow' }
  )
}

export function underlineNodes(engine: CanvasEngine, scene: LessonScene, nodeIds: string[], color: string = 'white'): string | null {
  const nodes = nodeIds
    .map((nodeId) => getNode(scene, nodeId))
    .filter((node): node is LessonNode => Boolean(node))

  if (!nodes.length) return null

  const left = Math.min(...nodes.map((node) => node.x))
  const right = Math.max(...nodes.map((node) => node.x + node.width))
  const y = Math.max(...nodes.map((node) => node.y + node.height)) + 6

  return createLine(engine, left, y, right - left, 0, color, { semanticNodeId: nodeIds.join(','), runtimeRole: 'node-underline' })
}

export function rewriteNodeValue(
  engine: CanvasEngine,
  scene: LessonScene,
  nodeId: string,
  text: string,
  color?: string
): { shapeIds: string[]; scene: LessonScene } | null {
  const node = getNode(scene, nodeId)
  if (!node) return null

  const resolvedColor = color ?? (typeof node.meta?.color === 'string' ? node.meta.color : 'white')
  const shapeIds = crossOutNode(engine, scene, nodeId, 'red')
  shapeIds.push(createTextShape(engine, node.x, node.y, text, resolvedColor, node.width, { semanticNodeId: nodeId, runtimeRole: 'node-rewrite' }))
  return {
    shapeIds,
    scene: updateNodeValue(scene, nodeId, text),
  }
}

export function performBorrow(
  engine: CanvasEngine,
  scene: LessonScene,
  fromColumn: 'tens' | 'hundreds' | 'thousands',
  toColumn: 'ones' | 'tens' | 'hundreds'
): { shapeIds: string[]; scene: LessonScene } {
  const shapeIds: string[] = []
  let nextScene = scene

  shapeIds.push(...crossOutNode(engine, nextScene, `minuend.${fromColumn}`, 'red'))

  const sourceNode = getNode(nextScene, `minuend.${fromColumn}`)
  const targetAnchorId = `borrow.anchor.${toColumn}`
  const targetNodeId = `minuend.${toColumn}`

  const decrementedValue = sourceNode?.value && /^\d+$/.test(sourceNode.value)
    ? String(Math.max(Number(sourceNode.value) - 1, 0))
    : sourceNode?.value ?? ''

  if (sourceNode) {
    const rewritten = rewriteNodeValue(engine, nextScene, `minuend.${fromColumn}`, decrementedValue)
    if (rewritten) {
      shapeIds.push(...rewritten.shapeIds)
      nextScene = rewritten.scene
    }
  }

  const annotation = writeAboveNode(engine, nextScene, targetAnchorId, '1', 'center', 'red')
  if (annotation) shapeIds.push(annotation)

  const arrow = drawArrowBetweenNodes(engine, nextScene, `minuend.${fromColumn}`, targetNodeId, 'red')
  if (arrow) shapeIds.push(arrow)

  nextScene = updateNodeValue(nextScene, targetAnchorId, '1')
  return { shapeIds, scene: nextScene }
}

export function performCarry(
  engine: CanvasEngine,
  scene: LessonScene,
  fromColumn: 'ones' | 'tens' | 'hundreds',
  toColumn: 'tens' | 'hundreds' | 'thousands',
  value: string = '1'
): { shapeIds: string[]; scene: LessonScene } {
  const shapeIds: string[] = []
  const annotation = writeAboveNode(engine, scene, `carry.anchor.${toColumn}`, value, 'center', 'red')
  if (annotation) shapeIds.push(annotation)
  const arrow = drawArrowBetweenNodes(engine, scene, `result.${fromColumn}`, `carry.anchor.${toColumn}`, 'red')
  if (arrow) shapeIds.push(arrow)

  return {
    shapeIds,
    scene: updateNodeValue(scene, `carry.anchor.${toColumn}`, value),
  }
}
