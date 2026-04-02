import type { LearnerProfile, LessonNode, LessonScene, LessonScript, LessonStep } from '@/types'

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
  useConcreteDemo: boolean
  concreteShareCount: number
  useRapidConcreteDemo: boolean
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
const DEMO_PANEL_X = 48
const DEMO_PANEL_WIDTH = BRACKET_X - DEMO_PANEL_X - 28
const DEMO_GROUP_Y_OFFSET = 6
const MAX_CONCRETE_DIVISOR = 5
const MAX_CONCRETE_QUOTIENT = 8
const MAX_CONCRETE_SHARE_COUNT = 40

interface LongDivisionTeachingProfile {
  shouldPreferConcreteDemo: boolean
  forceConcreteDemo: boolean
  maxConcreteDivisor: number
  maxConcreteQuotient: number
  maxConcreteShareCount: number
}

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

export function buildLongDivisionLessonScript(problem: LongDivisionProblem, profile: LearnerProfile | null = null): LessonScript | null {
  if (!Number.isFinite(problem.dividend) || !Number.isFinite(problem.divisor)) return null
  if (problem.dividend < 0 || problem.divisor <= 0) return null

  const teachingProfile = getTeachingProfile(profile)
  const steps = solveLongDivision(problem.dividend, problem.divisor, teachingProfile)
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

function solveLongDivision(
  dividend: number,
  divisor: number,
  teachingProfile: LongDivisionTeachingProfile
): LongDivisionStepData[] {
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
      useConcreteDemo: shouldUseConcreteDemo({
        divisor,
        quotientDigit,
        product,
        teachingProfile,
      }),
      concreteShareCount: product,
      useRapidConcreteDemo: product >= 20 || quotientDigit >= 7,
    })

    quotientStarted = true
    carryDigits = String(remainder)
  }

  return steps
}

function shouldUseConcreteDemo(input: {
  divisor: number
  quotientDigit: number
  product: number
  teachingProfile: LongDivisionTeachingProfile
}): boolean {
  const { divisor, quotientDigit, product, teachingProfile } = input

  if (!teachingProfile.shouldPreferConcreteDemo) {
    return (
      divisor <= MAX_CONCRETE_DIVISOR &&
      quotientDigit <= MAX_CONCRETE_QUOTIENT &&
      product <= MAX_CONCRETE_SHARE_COUNT
    )
  }

  if (teachingProfile.forceConcreteDemo) {
    return quotientDigit >= 0 && product >= 0
  }

  return (
    divisor <= teachingProfile.maxConcreteDivisor &&
    quotientDigit <= teachingProfile.maxConcreteQuotient &&
    product <= teachingProfile.maxConcreteShareCount
  )
}

function getTeachingProfile(profile: LearnerProfile | null): LongDivisionTeachingProfile {
  if (!profile) {
    return {
      shouldPreferConcreteDemo: true,
      forceConcreteDemo: false,
      maxConcreteDivisor: 9,
      maxConcreteQuotient: 10,
      maxConcreteShareCount: 60,
    }
  }

  const isYoungLearner =
    (typeof profile.age === 'number' && profile.age <= 7) ||
    profile.preferredStyle === 'step-by-step'

  if (isYoungLearner) {
    return {
      shouldPreferConcreteDemo: true,
      forceConcreteDemo: true,
      maxConcreteDivisor: Number.POSITIVE_INFINITY,
      maxConcreteQuotient: Number.POSITIVE_INFINITY,
      maxConcreteShareCount: Number.POSITIVE_INFINITY,
    }
  }

  if (profile.preferredStyle === 'visual') {
    return {
      shouldPreferConcreteDemo: true,
      forceConcreteDemo: false,
      maxConcreteDivisor: 7,
      maxConcreteQuotient: 9,
      maxConcreteShareCount: 45,
    }
  }

  return {
    shouldPreferConcreteDemo: false,
    forceConcreteDemo: false,
    maxConcreteDivisor: MAX_CONCRETE_DIVISOR,
    maxConcreteQuotient: MAX_CONCRETE_QUOTIENT,
    maxConcreteShareCount: MAX_CONCRETE_SHARE_COUNT,
  }
}

function buildLongDivisionScene(problem: LongDivisionProblem, steps: LongDivisionStepData[]): LessonScene {
  const nodes: Record<string, LessonNode> = {}
  const dividendDigits = String(problem.dividend).split('')
  const quotientDigits = String(Math.floor(problem.dividend / problem.divisor)).split('')
  const stepBaseYs: number[] = []
  let nextBaseY = STEP_START_Y

  for (const step of steps) {
    stepBaseYs[step.index] = nextBaseY
    nextBaseY += getStepHeight(problem.divisor, step)
  }

  const bracketHeight = nextBaseY - ORIGIN_Y + 14

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
    const baseY = stepBaseYs[step.index]
    const productDigits = String(step.product).split('')
    const remainderDigits = String(step.remainder).split('')
    const stepWidth = (step.endIndex - step.startIndex + 1) * COLUMN_SPACING
    const demoLayout = step.useConcreteDemo ? getConcreteDemoLayout(problem.divisor, step.quotientDigit, baseY) : null

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
      nodes[`step.${step.index}.remainder.${digitIndex}`].meta = {
        targetValue: digit,
        color: step.remainder > 0 ? 'yellow' : 'white',
      }
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

    if (step.useConcreteDemo && demoLayout) {
      nodes[`step.${step.index}.panel`] = createLineNode(
        `step.${step.index}.panel`,
        'demo_panel_border',
        DEMO_PANEL_X,
        demoLayout.panelY,
        DEMO_PANEL_WIDTH,
        demoLayout.panelHeight,
        ''
      )

      const tallySlots = Math.max(1, step.quotientDigit)
      for (let groupIndex = 0; groupIndex < problem.divisor; groupIndex += 1) {
        const groupColumn = groupIndex % demoLayout.groupColumns
        const groupRow = Math.floor(groupIndex / demoLayout.groupColumns)
        const groupX = demoLayout.panelX + groupColumn * demoLayout.cellWidth + demoLayout.groupInsetX
        const groupY = demoLayout.panelY + 14 + groupRow * demoLayout.rowHeight + DEMO_GROUP_Y_OFFSET
        nodes[`step.${step.index}.group.${groupIndex}.circle`] = {
          id: `step.${step.index}.group.${groupIndex}.circle`,
          role: 'demo_group_circle',
          x: groupX,
          y: groupY,
          width: demoLayout.groupSize,
          height: demoLayout.groupSize,
          value: '',
        }

        for (let slotIndex = 0; slotIndex < tallySlots; slotIndex += 1) {
          const columnOffset = (slotIndex % demoLayout.tallyColumns) * demoLayout.tallyColumnGap
          const rowIndex = Math.floor(slotIndex / demoLayout.tallyColumns)
          nodes[`step.${step.index}.group.${groupIndex}.slot.${slotIndex}`] = createTextNode(
            `step.${step.index}.group.${groupIndex}.slot.${slotIndex}`,
            'demo_group_tally',
            groupX + demoLayout.tallyStartX + columnOffset,
            groupY + demoLayout.groupSize + 14 + rowIndex * demoLayout.tallyRowGap,
            ''
          )
        }
      }
    }
  }

  const summaryAnswerY = nextBaseY + 18
  const summaryAnswerText = problem.dividend % problem.divisor === 0
    ? `${problem.dividend} ÷ ${problem.divisor} = ${Math.floor(problem.dividend / problem.divisor)}`
    : `${problem.dividend} ÷ ${problem.divisor} = ${Math.floor(problem.dividend / problem.divisor)} r ${problem.dividend % problem.divisor}`
  nodes['summary.answer'] = {
    id: 'summary.answer',
    role: 'final_answer_text',
    x: BRACKET_X + 22,
    y: summaryAnswerY,
    width: 280,
    height: DIGIT_HEIGHT,
    value: '',
    meta: { targetValue: summaryAnswerText, color: 'yellow' },
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
    const firstDigit = String(problem.dividend)[0]

    if (step.index === 0 && step.startIndex < step.endIndex) {
      lessonSteps.push({
        id: `step_${step.index}_check_first_digit`,
        teacherNote: 'Check first digit',
        speech: `${firstDigit} is smaller than ${problem.divisor}, so we cannot divide yet. We take the next digit and make ${step.partialDividend}.`,
        actions: [],
        waitFor: 'speech_end',
      })
    }

    if (step.useConcreteDemo) {
      lessonSteps.push({
        id: `step_${step.index}_concrete_intro`,
        teacherNote: 'Share equally',
        speech: step.concreteShareCount === step.partialDividend
          ? `We start with ${step.partialDividend}. We want to share it into ${problem.divisor} equal groups.`
          : `We cannot share all ${step.partialDividend} equally, so we share ${step.concreteShareCount} into ${problem.divisor} equal groups first.`,
        actions: [],
        waitFor: 'speech_end',
      })

      if (step.useRapidConcreteDemo) {
        lessonSteps.push({
          id: `step_${step.index}_share_fast`,
          teacherNote: 'Share equally',
          speech: `If we share ${step.concreteShareCount} equally by ${problem.divisor}, as we can do here in this working, then each group gets ${step.quotientDigit}.`,
          actions: buildConcreteRevealActions(step.index, problem.divisor, step.quotientDigit),
          waitFor: 'speech_end',
        })
      } else {
        for (let count = 0; count < step.concreteShareCount; count += 1) {
          const groupIndex = count % problem.divisor
          const slotIndex = Math.floor(count / problem.divisor)
          lessonSteps.push({
            id: `step_${step.index}_share_${count}`,
            teacherNote: 'Share equally',
            speech: `${countWord(count + 1)}.`,
            actions: [
              { type: 'reveal_result', target: `step.${step.index}.group.${groupIndex}.slot.${slotIndex}`, text: '|' },
            ],
            waitFor: 'speech_end',
          })
        }
      }

      lessonSteps.push({
        id: `step_${step.index}_count_groups`,
        teacherNote: 'Count each group',
        speech: step.remainder === 0
          ? `Now each group has ${step.quotientDigit}. That means ${step.partialDividend} divided by ${problem.divisor} is ${step.quotientDigit}.`
          : `Now each group has ${step.quotientDigit}, and ${step.remainder} is left over. So we write ${step.quotientDigit} and keep ${step.remainder} as the remainder for this step.`,
        actions: [
          { type: 'reveal_result', target: quotientNodeId, text: quotientText },
        ],
        waitFor: 'speech_end',
      })
    } else {
      lessonSteps.push({
        id: `step_${step.index}_divide`,
        teacherNote: 'Divide',
        speech: `Now we ask how many times ${problem.divisor} can go into ${step.partialDividend}. It goes ${step.quotientDigit} times.`,
        actions: [
          { type: 'reveal_result', target: quotientNodeId, text: quotientText },
        ],
        waitFor: 'speech_end',
      })
    }

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
      speech: step.remainder === 0
        ? `${step.partialDividend} minus ${step.product} is ${step.remainder}.`
        : `${step.partialDividend} minus ${step.product} is ${step.remainder}. This remainder is important, so we keep it for the next part.`,
      actions: [
        { type: 'reveal_result', target: `step.${step.index}.line`, text: 'show' },
        ...getDigitRevealActions(`step.${step.index}.remainder`, String(step.remainder)),
        ...(step.remainder > 0
          ? getHighlightActions(`step.${step.index}.remainder`, String(step.remainder), 'yellow')
          : []),
      ],
      waitFor: 'speech_end',
    })

    if (step.nextDigit !== undefined) {
      lessonSteps.push({
        id: `step_${step.index}_bring_down`,
        teacherNote: 'Bring down',
        speech: step.remainder > 0
          ? `We keep that remainder ${step.remainder}, then bring down the next digit, ${step.nextDigit}, to make ${step.resultDigits}.`
          : `Bring down the next digit, ${step.nextDigit}, to make ${step.resultDigits}.`,
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
    actions: [
      { type: 'reveal_result', target: 'summary.answer', text: getSummaryAnswerText(problem) },
      { type: 'highlight_symbol', target: 'summary.answer', style: 'circle', color: 'yellow' },
    ],
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

function getHighlightActions(prefix: string, value: string, color: string) {
  return value.split('').map((_, index) => ({
    type: 'highlight_symbol' as const,
    target: `${prefix}.${index}`,
    style: 'glow' as const,
    color,
  }))
}

function buildConcreteRevealActions(stepIndex: number, divisor: number, quotientDigit: number) {
  const actions: LessonStep['actions'] = []
  for (let groupIndex = 0; groupIndex < divisor; groupIndex += 1) {
    for (let slotIndex = 0; slotIndex < quotientDigit; slotIndex += 1) {
      actions.push({
        type: 'reveal_result',
        target: `step.${stepIndex}.group.${groupIndex}.slot.${slotIndex}`,
        text: '|',
      })
    }
  }
  return actions
}

function getStepHeight(divisor: number, step: LongDivisionStepData): number {
  if (!step.useConcreteDemo) return STEP_HEIGHT
  return Math.max(STEP_HEIGHT, getConcreteDemoLayout(divisor, step.quotientDigit, 0).panelHeight + 36)
}

function getConcreteDemoLayout(divisor: number, quotientDigit: number, baseY: number) {
  const groupColumns = Math.min(3, Math.max(1, divisor))
  const groupRows = Math.ceil(divisor / groupColumns)
  const cellWidth = Math.floor(DEMO_PANEL_WIDTH / groupColumns)
  const tallyColumns = quotientDigit >= 8 ? 3 : quotientDigit >= 4 ? 2 : 1
  const tallyRows = Math.max(1, Math.ceil(Math.max(1, quotientDigit) / tallyColumns))
  const groupSize = Math.max(28, Math.min(46, cellWidth - 28))
  const tallyColumnGap = tallyColumns === 1 ? 0 : Math.max(12, Math.floor(groupSize / 3))
  const tallyRowGap = quotientDigit >= 8 ? 18 : quotientDigit >= 5 ? 20 : 24
  const rowHeight = groupSize + 22 + tallyRows * tallyRowGap + 10

  return {
    panelX: DEMO_PANEL_X,
    panelY: baseY - 12,
    panelHeight: groupRows * rowHeight + 10,
    groupColumns,
    cellWidth,
    groupSize,
    groupInsetX: Math.floor((cellWidth - groupSize) / 2),
    tallyColumns,
    tallyColumnGap,
    tallyRowGap,
    tallyStartX: Math.floor(groupSize / 2) - Math.floor((tallyColumns - 1) * tallyColumnGap / 2) - 2,
    rowHeight,
  }
}

function getSummaryAnswerText(problem: LongDivisionProblem) {
  const quotient = Math.floor(problem.dividend / problem.divisor)
  const remainder = problem.dividend % problem.divisor
  return remainder === 0
    ? `${problem.dividend} ÷ ${problem.divisor} = ${quotient}`
    : `${problem.dividend} ÷ ${problem.divisor} = ${quotient} r ${remainder}`
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

function countWord(value: number): string {
  const words = [
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
  ]

  return words[value - 1] ?? String(value)
}
