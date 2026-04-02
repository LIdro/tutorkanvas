import type { LessonNode, LessonPlacement, LessonScene } from '@/types'

export function getNode(scene: LessonScene, id: string): LessonNode | null {
  return scene.nodes[id] ?? null
}

export function getNodeBounds(scene: LessonScene, id: string) {
  const node = getNode(scene, id)
  if (!node) return null

  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    right: node.x + node.width,
    bottom: node.y + node.height,
    centerX: node.x + node.width / 2,
    centerY: node.y + node.height / 2,
  }
}

export function resolvePlacement(
  scene: LessonScene,
  targetId: string,
  placement: LessonPlacement = 'center',
  padding: number = 10
) {
  const bounds = getNodeBounds(scene, targetId)
  if (!bounds) return null

  switch (placement) {
    case 'center':
      return { x: bounds.centerX, y: bounds.centerY }
    case 'top':
      return { x: bounds.centerX, y: bounds.y - padding }
    case 'right':
      return { x: bounds.right + padding, y: bounds.centerY }
    case 'bottom':
      return { x: bounds.centerX, y: bounds.bottom + padding }
    case 'left':
      return { x: bounds.x - padding, y: bounds.centerY }
    case 'top-right':
      return { x: bounds.right + padding, y: bounds.y - padding }
    case 'top-left':
      return { x: bounds.x - padding, y: bounds.y - padding }
    case 'bottom-right':
      return { x: bounds.right + padding, y: bounds.bottom + padding }
    case 'bottom-left':
      return { x: bounds.x - padding, y: bounds.bottom + padding }
  }
}

export function updateNodeValue(scene: LessonScene, id: string, nextValue: string): LessonScene {
  const node = getNode(scene, id)
  if (!node) return scene

  return {
    ...scene,
    nodes: {
      ...scene.nodes,
      [id]: {
        ...node,
        value: nextValue,
      },
    },
  }
}
