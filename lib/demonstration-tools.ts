import type { Editor } from 'tldraw'
import type { LessonNode, LessonPlacement, LessonScene } from '@/types'
import { getNode, resolvePlacement, updateNodeValue } from '@/lib/lesson-scene'

let demoShapeCounter = 0

function nextShapeId(prefix: string): string {
  demoShapeCounter += 1
  return `shape:demo-${prefix}-${demoShapeCounter}`
}

function toRichText(plain: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: plain ? [{ type: 'text', text: plain }] : [],
      },
    ],
  }
}

function createTextShape(
  editor: Editor,
  x: number,
  y: number,
  text: string,
  color: string = 'white',
  width: number = 240
) {
  const id = nextShapeId('text')
  editor.createShape({
    id,
    type: 'text',
    x,
    y,
    props: {
      richText: toRichText(text) as any,
      size: 'm',
      color,
      font: 'draw',
      textAlign: 'start',
      autoSize: true,
      w: width,
      scale: 1,
    },
  } as any)
  return id
}

function createArrowShape(editor: Editor, x: number, y: number, endX: number, endY: number, color: string = 'red') {
  const id = nextShapeId('arrow')
  editor.createShape({
    id,
    type: 'arrow',
    x,
    y,
    props: {
      color,
      start: { x: 0, y: 0 },
      end: { x: endX - x, y: endY - y },
    },
  } as any)
  return id
}

function createEllipse(editor: Editor, x: number, y: number, width: number, height: number, color: string = 'blue', fill: 'none' | 'semi' = 'none') {
  const id = nextShapeId('ellipse')
  editor.createShape({
    id,
    type: 'geo',
    x,
    y,
    props: {
      geo: 'ellipse',
      w: width,
      h: height,
      color,
      fill,
      dash: 'draw',
      size: 'm',
    },
  } as any)
  return id
}

function createRectangle(
  editor: Editor,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string = 'white',
  fill: 'none' | 'semi' = 'none'
) {
  const id = nextShapeId('rect')
  editor.createShape({
    id,
    type: 'geo',
    x,
    y,
    props: {
      geo: 'rectangle',
      w: width,
      h: height,
      color,
      fill,
      dash: 'draw',
      size: 'm',
    },
  } as any)
  return id
}

export function placeEllipseAtNode(
  editor: Editor,
  scene: LessonScene,
  nodeId: string,
  color: string = 'white',
  fill: 'none' | 'semi' = 'none'
): string | null {
  const node = getNode(scene, nodeId)
  if (!node) return null
  return createEllipse(editor, node.x, node.y, node.width, node.height, color, fill)
}

function createLine(editor: Editor, x: number, y: number, width: number, height: number, color: string = 'white') {
  const id = nextShapeId('line')
  editor.createShape({
    id,
    type: 'arrow',
    x,
    y,
    props: {
      color,
      start: { x: 0, y: 0 },
      end: { x: width, y: height },
      arrowheadStart: 'none',
      arrowheadEnd: 'none',
    },
  } as any)
  return id
}

export function placeLineAtNode(editor: Editor, scene: LessonScene, nodeId: string, color: string = 'black'): string | null {
  const node = getNode(scene, nodeId)
  if (!node) return null
  return createLine(editor, node.x, node.y, node.width, node.height, color)
}

export function placeRectangleAtNode(
  editor: Editor,
  scene: LessonScene,
  nodeId: string,
  color: string = 'white',
  fill: 'none' | 'semi' = 'none'
): string | null {
  const node = getNode(scene, nodeId)
  if (!node) return null
  return createRectangle(editor, node.x, node.y, node.width, node.height, color, fill)
}

export function placeTextAtNode(
  editor: Editor,
  scene: LessonScene,
  nodeId: string,
  text: string,
  color?: string
): string | null {
  const node = getNode(scene, nodeId)
  if (!node) return null
  const resolvedColor = color ?? (typeof node.meta?.color === 'string' ? node.meta.color : 'white')
  return createTextShape(editor, node.x, node.y, text, resolvedColor, node.width)
}

export function circleNode(editor: Editor, scene: LessonScene, nodeId: string, color: string = 'blue'): string | null {
  const node = getNode(scene, nodeId)
  if (!node) return null
  return createEllipse(editor, node.x - 8, node.y - 6, node.width + 16, node.height + 12, color)
}

export function glowNode(editor: Editor, scene: LessonScene, nodeId: string, color: string = 'yellow'): string | null {
  const node = getNode(scene, nodeId)
  if (!node) return null
  return createEllipse(editor, node.x - 10, node.y - 8, node.width + 20, node.height + 16, color, 'semi')
}

export function crossOutNode(editor: Editor, scene: LessonScene, nodeId: string, color: string = 'red'): string[] {
  const node = getNode(scene, nodeId)
  if (!node) return []

  return [
    createLine(editor, node.x, node.y + node.height, node.width, -node.height, color),
    createLine(editor, node.x, node.y, node.width, node.height, color),
  ]
}

export function writeAboveNode(
  editor: Editor,
  scene: LessonScene,
  nodeId: string,
  text: string,
  placement: LessonPlacement = 'top-right',
  color: string = 'red'
): string | null {
  const point = resolvePlacement(scene, nodeId, placement, 8)
  if (!point) return null
  return createTextShape(editor, point.x, point.y, text, color)
}

export function drawArrowBetweenNodes(
  editor: Editor,
  scene: LessonScene,
  fromId: string,
  toId: string,
  color: string = 'red'
): string | null {
  const from = getNode(scene, fromId)
  const to = getNode(scene, toId)
  if (!from || !to) return null

  return createArrowShape(
    editor,
    from.x + from.width / 2,
    from.y + from.height / 2,
    to.x + to.width / 2,
    to.y + to.height / 2,
    color
  )
}

export function underlineNodes(editor: Editor, scene: LessonScene, nodeIds: string[], color: string = 'white'): string | null {
  const nodes = nodeIds
    .map((nodeId) => getNode(scene, nodeId))
    .filter((node): node is LessonNode => Boolean(node))

  if (!nodes.length) return null

  const left = Math.min(...nodes.map((node) => node.x))
  const right = Math.max(...nodes.map((node) => node.x + node.width))
  const y = Math.max(...nodes.map((node) => node.y + node.height)) + 6

  return createLine(editor, left, y, right - left, 0, color)
}

export function rewriteNodeValue(
  editor: Editor,
  scene: LessonScene,
  nodeId: string,
  text: string,
  color?: string
): { shapeIds: string[]; scene: LessonScene } | null {
  const node = getNode(scene, nodeId)
  if (!node) return null

  const resolvedColor = color ?? (typeof node.meta?.color === 'string' ? node.meta.color : 'white')
  const shapeIds = crossOutNode(editor, scene, nodeId, 'red')
  shapeIds.push(createTextShape(editor, node.x, node.y, text, resolvedColor, node.width))
  return {
    shapeIds,
    scene: updateNodeValue(scene, nodeId, text),
  }
}

export function performBorrow(
  editor: Editor,
  scene: LessonScene,
  fromColumn: 'tens' | 'hundreds' | 'thousands',
  toColumn: 'ones' | 'tens' | 'hundreds'
): { shapeIds: string[]; scene: LessonScene } {
  const shapeIds: string[] = []
  let nextScene = scene

  shapeIds.push(...crossOutNode(editor, nextScene, `minuend.${fromColumn}`, 'red'))

  const sourceNode = getNode(nextScene, `minuend.${fromColumn}`)
  const targetAnchorId = `borrow.anchor.${toColumn}`
  const targetNodeId = `minuend.${toColumn}`

  const decrementedValue = sourceNode?.value && /^\d+$/.test(sourceNode.value)
    ? String(Math.max(Number(sourceNode.value) - 1, 0))
    : sourceNode?.value ?? ''

  if (sourceNode) {
    const rewritten = rewriteNodeValue(editor, nextScene, `minuend.${fromColumn}`, decrementedValue)
    if (rewritten) {
      shapeIds.push(...rewritten.shapeIds)
      nextScene = rewritten.scene
    }
  }

  const annotation = writeAboveNode(editor, nextScene, targetAnchorId, '1', 'center', 'red')
  if (annotation) shapeIds.push(annotation)

  const arrow = drawArrowBetweenNodes(editor, nextScene, `minuend.${fromColumn}`, targetNodeId, 'red')
  if (arrow) shapeIds.push(arrow)

  nextScene = updateNodeValue(nextScene, targetAnchorId, '1')
  return { shapeIds, scene: nextScene }
}

export function performCarry(
  editor: Editor,
  scene: LessonScene,
  fromColumn: 'ones' | 'tens' | 'hundreds',
  toColumn: 'tens' | 'hundreds' | 'thousands',
  value: string = '1'
): { shapeIds: string[]; scene: LessonScene } {
  const shapeIds: string[] = []
  const annotation = writeAboveNode(editor, scene, `carry.anchor.${toColumn}`, value, 'center', 'red')
  if (annotation) shapeIds.push(annotation)
  const arrow = drawArrowBetweenNodes(editor, scene, `result.${fromColumn}`, `carry.anchor.${toColumn}`, 'red')
  if (arrow) shapeIds.push(arrow)

  return {
    shapeIds,
    scene: updateNodeValue(scene, `carry.anchor.${toColumn}`, value),
  }
}
