import type { LessonNode, LessonScene } from '@/types'

interface ArithmeticLayoutOptions {
  originX?: number
  originY?: number
  columnSpacing?: number
  rowSpacing?: number
  digitWidth?: number
  digitHeight?: number
}

interface VerticalArithmeticProblem {
  minuend: number | string
  subtrahend: number | string
}

const DEFAULTS = {
  originX: 540,
  originY: 180,
  columnSpacing: 64,
  rowSpacing: 72,
  digitWidth: 42,
  digitHeight: 54,
}

function normalizeDigits(value: number | string): string[] {
  return String(value).replace(/\s+/g, '').split('')
}

function buildColumnNode(
  rowPrefix: string,
  place: string,
  digit: string,
  x: number,
  y: number,
  width: number,
  height: number
): LessonNode {
  return {
    id: `${rowPrefix}.${place}`,
    role: `${rowPrefix}_digit`,
    x,
    y,
    width,
    height,
    value: digit,
    meta: {
      place,
    },
  }
}

function getPlaceNames(count: number): string[] {
  const names = ['ones', 'tens', 'hundreds', 'thousands']
  return names.slice(0, count)
}

function buildVerticalArithmeticScene(
  kind: LessonScene['kind'],
  problem: VerticalArithmeticProblem,
  operator: '+' | '-',
  options?: ArithmeticLayoutOptions
): LessonScene {
  const config = { ...DEFAULTS, ...options }
  const topDigits = normalizeDigits(problem.minuend)
  const bottomDigits = normalizeDigits(problem.subtrahend)
  const columnCount = Math.max(topDigits.length, bottomDigits.length)
  const placeNames = getPlaceNames(columnCount)
  const topStartX = config.originX - (columnCount - 1) * config.columnSpacing
  const nodes: Record<string, LessonNode> = {}

  for (let visualIndex = 0; visualIndex < columnCount; visualIndex += 1) {
    const placeIndex = columnCount - 1 - visualIndex
    const place = placeNames[visualIndex]
    const x = topStartX + placeIndex * config.columnSpacing
    const topDigit = topDigits[topDigits.length - 1 - visualIndex] ?? ''
    const bottomDigit = bottomDigits[bottomDigits.length - 1 - visualIndex] ?? ''

    nodes[`minuend.${place}`] = buildColumnNode(
      'minuend',
      place,
      topDigit,
      x,
      config.originY,
      config.digitWidth,
      config.digitHeight
    )
    nodes[`subtrahend.${place}`] = buildColumnNode(
      'subtrahend',
      place,
      bottomDigit,
      x,
      config.originY + config.rowSpacing,
      config.digitWidth,
      config.digitHeight
    )
    nodes[`result.${place}`] = {
      id: `result.${place}`,
      role: 'result_digit',
      x,
      y: config.originY + config.rowSpacing * 2,
      width: config.digitWidth,
      height: config.digitHeight,
      value: '',
      meta: { place },
    }
    nodes[`borrow.anchor.${place}`] = {
      id: `borrow.anchor.${place}`,
      role: 'borrow_anchor',
      x,
      y: config.originY - 38,
      width: config.digitWidth,
      height: 24,
      value: '',
      meta: { place },
    }
    nodes[`carry.anchor.${place}`] = {
      id: `carry.anchor.${place}`,
      role: 'carry_anchor',
      x,
      y: config.originY - 38,
      width: config.digitWidth,
      height: 24,
      value: '',
      meta: { place },
    }
  }

  nodes.operator = {
    id: 'operator',
    role: 'operator',
    x: topStartX - config.columnSpacing,
    y: config.originY + config.rowSpacing,
    width: config.digitWidth,
    height: config.digitHeight,
    value: operator,
  }

  nodes.answerLine = {
    id: 'answerLine',
    role: 'answer_line',
    x: topStartX - 8,
    y: config.originY + config.rowSpacing * 2 - 10,
    width: config.columnSpacing * Math.max(columnCount, 2),
    height: 6,
  }

  return {
    id: `${kind}:${String(problem.minuend)}${operator}${String(problem.subtrahend)}`,
    kind,
    nodes,
  }
}

export function layoutVerticalSubtraction(
  problem: VerticalArithmeticProblem,
  options?: ArithmeticLayoutOptions
): LessonScene {
  return buildVerticalArithmeticScene('vertical-subtraction', problem, '-', options)
}

export function layoutVerticalAddition(
  problem: VerticalArithmeticProblem,
  options?: ArithmeticLayoutOptions
): LessonScene {
  return buildVerticalArithmeticScene('vertical-addition', problem, '+', options)
}

