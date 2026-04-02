import type { LessonNode, LessonScene, LessonScript, LessonStep } from '@/types'

export interface LongDivisionProblem {
  dividend: number
  divisor: number
}

interface LongDivisionStepData {
  index: number
  partialDividend: number
  partialDigits: string
  startIndex: number
  endIndex: number
  quotientDigit: number
  product: number
  remainder: number
  nextDigit?: string
  resultDigits: string
}

const DIGIT_WIDTH = 38
const DIGIT_HEIGHT = 48
const COLUMN_SPACING = 40
const ORIGIN_X = 330
const ORIGIN_Y = 150
const DIVISOR_X = ORIGIN_X
const DIVISOR_Y = ORIGIN_Y + 6
const BRACKET_X = ORIGIN_X + 72
const DIVIDEND_START_X = BRACKET_X + 24
const DIVIDEND_Y = ORIGIN_Y + 8
const QUOTIENT_Y = ORIGIN_Y - 58
const STEP_START_Y = ORIGIN_Y + 86
const STEP_HEIGHT = 124

export function extractLongDivisionProblem(prompt: string): LongDivisionProblem | null {
  const normalized = prompt.trim().toLowerCase()
  if (!normalized) return null

  const directMatch = normalized.match(/(\d+)\s*(?:÷|\/)\s*(\d+)/)
  if (directMatch) {
    return toProblem(directMatch[1], directMatch[2])
  }

  const dividedByMatch = normalized.match(/(\d+)\s+divided\s+by\s+(\d+)/)
  if (dividedByMatch) {
    return toProblem(dividedByMatch[1], dividedByMatch[2])
  }

  const divideByMatch = normalized.match(/(?:how\s+to\s+)?divide\s+(\d+)\s+by\s+(\d+)/)
  if (divideByMatch) {
    return toProblem(divideByMatch[1], divideByMatch[2])
  }

  const longDivisionMatch = normalized.match(/long\s+division\s+of\s+(\d+)\s+by\s+(\d+)/)
  if (longDivisionMatch) {
    return toProblem(longDivisionMatch[1], longDivisionMatch[2])
  }

  const flexiblePatterns = [
    /(?:how\s+to\s+)?divide\s+(.+?)\s+by\s+(.+?)(?:\s+with\b|\s+using\b|\s+step\b|[?.!,]|$)/,
    /(.+?)\s+divided\s+by\s+(.+?)(?:\s+with\b|\s+using\b|\s+step\b|[?.!,]|$)/,
    /long\s+division\s+of\s+(.+?)\s+by\s+(.+?)(?:\s+with\b|\s+using\b|\s+step\b|[?.!,]|$)/,
  ]

  for (const pattern of flexiblePatterns) {
    const match = normalized.match(pattern)
    if (!match) continue
    const problem = toProblem(match[1], match[2])
    if (problem) return problem
  }

  return null
}

export function shouldUseLocalLongDivision(prompt: string): boolean {
  const normalized = prompt.trim().toLowerCase()
  if (!normalized) return false

  const problem = extractLongDivisionProblem(prompt)
  if (!problem) return false

  return /\b(divide|division|divided|long division|show|teach|explain|work through|step by step|solve)\b/.test(normalized)
}

export function buildLongDivisionLessonScript(problem: LongDivisionProblem): LessonScript | null {
  if (!Number.isFinite(problem.dividend) || !Number.isFinite(problem.divisor)) return null
  if (problem.dividend < 0 || problem.divisor <= 0) return null

  const steps = solveLongDivision(problem.dividend, problem.divisor)
  if (!steps.length) return null

  const scene = buildLongDivisionScene(problem, steps)

  return {
    lessonId: `long-division:${problem.dividend}:${problem.divisor}`,
    topic: 'long division',
    scene,
    steps: buildLessonSteps(problem, steps),
  }
}

function toProblem(dividendRaw: string, divisorRaw: string): LongDivisionProblem | null {
  const dividend = parseFlexibleInteger(dividendRaw)
  const divisor = parseFlexibleInteger(divisorRaw)
  if (Number.isNaN(dividend) || Number.isNaN(divisor) || divisor <= 0) return null
  return { dividend, divisor }
}

function parseFlexibleInteger(raw: string): number {
  const normalized = raw.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ')
  if (!normalized) return Number.NaN
  if (/^\d+$/.test(normalized)) return Number(normalized)

  const units: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
  }

  const tens: Record<string, number> = {
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  }

  let total = 0
  let current = 0

  for (const token of normalized.split(' ')) {
    if (token === 'and') continue
    if (token in units) {
      current += units[token]
      continue
    }
    if (token in tens) {
      current += tens[token]
      continue
    }
    if (token === 'hundred') {
      current = (current || 1) * 100
      continue
    }
    if (token === 'thousand') {
      total += (current || 1) * 1000
      current = 0
      continue
    }
    return Number.NaN
  }

  return total + current
}

function solveLongDivision(dividend: number, divisor: number): LongDivisionStepData[] {
  const digits = String(dividend).split('')
  const steps: LongDivisionStepData[] = []
  let quotientStarted = false
  let carryDigits = ''

  for (let index = 0; index < digits.length; index += 1) {
    const currentDigits = `${carryDigits}${digits[index]}`.replace(/^0+(?=\d)/, '')
    const partialDigits = currentDigits || '0'
    const partialDividend = Number(partialDigits)

    if (!quotientStarted && partialDividend < divisor && index < digits.length - 1) {
      carryDigits = partialDigits
      continue
    }

    const quotientDigit = partialDividend < divisor ? 0 : Math.floor(partialDividend / divisor)
    const product = quotientDigit * divisor
    const remainder = partialDividend - product
    const startIndex = index - partialDigits.length + 1
    const nextDigit = index < digits.length - 1 ? digits[index + 1] : undefined

    steps.push({
      index: steps.length,
      partialDividend,
      partialDigits,
      startIndex,
      endIndex: index,
      quotientDigit,
      product,
      remainder,
      nextDigit,
      resultDigits: nextDigit !== undefined ? `${remainder}${nextDigit}` : String(remainder),
    })

    quotientStarted = true
    carryDigits = String(remainder)
  }

  return steps
}

function buildLongDivisionScene(problem: LongDivisionProblem, steps: LongDivisionStepData[]): LessonScene {
  const nodes: Record<string, LessonNode> = {}
  const dividendDigits = String(problem.dividend).split('')
  const quotientDigits = String(Math.floor(problem.dividend / problem.divisor)).split('')
  const bracketHeight = STEP_START_Y + steps.length * STEP_HEIGHT - ORIGIN_Y + 14

  nodes.divisor = createTextNode('divisor', 'divisor', DIVISOR_X, DIVISOR_Y, String(problem.divisor))
  nodes['bracket.top'] = createLineNode(
    'bracket.top',
    'division_bracket_top',
    BRACKET_X,
    ORIGIN_Y + 4,
    Math.max(96, dividendDigits.length * COLUMN_SPACING + 12),
    0,
    'visible'
  )
  nodes['bracket.vertical'] = createLineNode(
    'bracket.vertical',
    'division_bracket_vertical',
    BRACKET_X,
    ORIGIN_Y + 6,
    0,
    bracketHeight,
    'visible'
  )

  for (const [index, digit] of dividendDigits.entries()) {
    nodes[`dividend.${index}`] = createTextNode(
      `dividend.${index}`,
      'dividend_digit',
      getDigitX(index),
      DIVIDEND_Y,
      digit
    )
  }

  const quotientStartIndex = dividendDigits.length - quotientDigits.length
  for (const [index, digit] of quotientDigits.entries()) {
    nodes[`quotient.${index}`] = createTextNode(
      `quotient.${index}`,
      'quotient_digit',
      getDigitX(quotientStartIndex + index),
      QUOTIENT_Y,
      ''
    )
    nodes[`quotient.${index}`].meta = { targetValue: digit }
  }

  for (const step of steps) {
    const baseY = STEP_START_Y + step.index * STEP_HEIGHT
    const productDigits = String(step.product).split('')
    const remainderDigits = String(step.remainder).split('')
    const stepWidth = (step.endIndex - step.startIndex + 1) * COLUMN_SPACING

    for (const [digitIndex, digit] of productDigits.entries()) {
      const visualIndex = step.endIndex - productDigits.length + 1 + digitIndex
      nodes[`step.${step.index}.product.${digitIndex}`] = createTextNode(
        `step.${step.index}.product.${digitIndex}`,
        'step_product_digit',
        getDigitX(visualIndex),
        baseY,
        ''
      )
      nodes[`step.${step.index}.product.${digitIndex}`].meta = { targetValue: digit }
    }

    nodes[`step.${step.index}.line`] = createLineNode(
      `step.${step.index}.line`,
      'division_step_line',
      getDigitX(step.startIndex) - 4,
      baseY + 36,
      Math.max(COLUMN_SPACING, stepWidth + 8),
      0,
      ''
    )

    for (const [digitIndex, digit] of remainderDigits.entries()) {
      const visualIndex = step.endIndex - remainderDigits.length + 1 + digitIndex
      nodes[`step.${step.index}.remainder.${digitIndex}`] = createTextNode(
        `step.${step.index}.remainder.${digitIndex}`,
        'step_remainder_digit',
        getDigitX(visualIndex),
        baseY + 46,
        ''
      )
      nodes[`step.${step.index}.remainder.${digitIndex}`].meta = { targetValue: digit }
    }

    if (step.nextDigit !== undefined) {
      nodes[`step.${step.index}.bringDown`] = createTextNode(
        `step.${step.index}.bringDown`,
        'step_bring_down_digit',
        getDigitX(step.endIndex + 1),
        baseY + 46,
        ''
      )
      nodes[`step.${step.index}.bringDown`].meta = { targetValue: step.nextDigit }
    }
  }

  return {
    id: `long-division:${problem.dividend}/${problem.divisor}`,
    kind: 'long-division',
    nodes,
  }
}

function buildLessonSteps(problem: LongDivisionProblem, steps: LongDivisionStepData[]): LessonStep[] {
  const lessonSteps: LessonStep[] = [
    {
      id: 'intro',
      teacherNote: 'Set up',
      speech: `Let’s work through ${problem.dividend} divided by ${problem.divisor}.`,
      actions: [],
      waitFor: 'speech_end',
    },
  ]

  const quotientDigits = String(Math.floor(problem.dividend / problem.divisor)).split('')
  const quotientStartIndex = String(problem.dividend).length - quotientDigits.length

  for (const step of steps) {
    const quotientNodeId = `quotient.${Math.max(0, step.endIndex - quotientStartIndex)}`
    const quotientText = quotientDigits[Math.max(0, step.endIndex - quotientStartIndex)] ?? String(step.quotientDigit)

    lessonSteps.push({
      id: `step_${step.index}_divide`,
      teacherNote: 'Divide',
      speech: `How many times does ${problem.divisor} go into ${step.partialDividend}? It goes ${step.quotientDigit} times.`,
      actions: [
        { type: 'reveal_result', target: quotientNodeId, text: quotientText },
      ],
      waitFor: 'speech_end',
    })

    lessonSteps.push({
      id: `step_${step.index}_multiply`,
      teacherNote: 'Multiply',
      speech: `${step.quotientDigit} times ${problem.divisor} is ${step.product}.`,
      actions: getDigitRevealActions(`step.${step.index}.product`, String(step.product)),
      waitFor: 'speech_end',
    })

    lessonSteps.push({
      id: `step_${step.index}_subtract`,
      teacherNote: 'Subtract',
      speech: `${step.partialDividend} minus ${step.product} is ${step.remainder}.`,
      actions: [
        { type: 'reveal_result', target: `step.${step.index}.line`, text: 'show' },
        ...getDigitRevealActions(`step.${step.index}.remainder`, String(step.remainder)),
      ],
      waitFor: 'speech_end',
    })

    if (step.nextDigit !== undefined) {
      lessonSteps.push({
        id: `step_${step.index}_bring_down`,
        teacherNote: 'Bring down',
        speech: `Bring down the next digit, ${step.nextDigit}, to make ${step.resultDigits}.`,
        actions: [
          { type: 'reveal_result', target: `step.${step.index}.bringDown`, text: step.nextDigit },
        ],
        waitFor: 'speech_end',
      })
    }
  }

  const remainder = problem.dividend % problem.divisor
  lessonSteps.push({
    id: 'summary',
    teacherNote: 'Answer',
    speech: remainder === 0
      ? `So ${problem.dividend} divided by ${problem.divisor} equals ${Math.floor(problem.dividend / problem.divisor)} exactly.`
      : `So ${problem.dividend} divided by ${problem.divisor} equals ${Math.floor(problem.dividend / problem.divisor)} remainder ${remainder}.`,
    actions: [],
    waitFor: 'speech_end',
  })

  return lessonSteps
}

function getDigitRevealActions(prefix: string, value: string) {
  return value.split('').map((digit, index) => ({
    type: 'reveal_result' as const,
    target: `${prefix}.${index}`,
    text: digit,
  }))
}

function createTextNode(id: string, role: string, x: number, y: number, value: string): LessonNode {
  return {
    id,
    role,
    x,
    y,
    width: DIGIT_WIDTH,
    height: DIGIT_HEIGHT,
    value,
  }
}

function createLineNode(
  id: string,
  role: string,
  x: number,
  y: number,
  width: number,
  height: number,
  value: string
): LessonNode {
  return {
    id,
    role,
    x,
    y,
    width,
    height,
    value,
  }
}

function getDigitX(index: number): number {
  return DIVIDEND_START_X + index * COLUMN_SPACING
}
