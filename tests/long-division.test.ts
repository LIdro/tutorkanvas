import { describe, expect, it } from 'vitest'
import { buildLongDivisionLessonScript, extractLongDivisionProblem, shouldUseLocalLongDivision } from '@/lib/long-division'
import { normalizeNumbersForSpeech } from '@/hooks/useVoice'
import type { LearnerProfile } from '@/types'

describe('long division planner', () => {
  it('detects long division prompts', () => {
    expect(extractLongDivisionProblem('Show me 300 divided by 12')).toEqual({
      dividend: 300,
      divisor: 12,
    })
    expect(extractLongDivisionProblem('How do I divide 250 by 5 step by step?')).toEqual({
      dividend: 250,
      divisor: 5,
    })
    expect(extractLongDivisionProblem('Divide 100 by five with long division.')).toEqual({
      dividend: 100,
      divisor: 5,
    })
    expect(extractLongDivisionProblem('Work through 410 ÷ 2')).toEqual({
      dividend: 410,
      divisor: 2,
    })
    expect(shouldUseLocalLongDivision('Teach me long division of 300 by 12')).toBe(true)
  })

  it('builds a deterministic lesson script for long division', () => {
    const script = buildLongDivisionLessonScript({ dividend: 300, divisor: 12 })

    expect(script?.scene.kind).toBe('long-division')
    expect(script?.scene.nodes.divisor.value).toBe('12')
    expect(script?.scene.nodes['dividend.0'].value).toBe('3')
    expect(script?.steps.some((step) => step.teacherNote === 'Divide')).toBe(true)
    expect(script?.steps.some((step) => step.teacherNote === 'Bring down')).toBe(true)
  })

  it('uses concrete sharing steps for small division problems', () => {
    const script = buildLongDivisionLessonScript({ dividend: 66, divisor: 2 })

    expect(script?.scene.nodes['step.0.group.0.circle']).toBeDefined()
    expect(script?.steps.some((step) => step.id.includes('share_'))).toBe(true)
    expect(script?.steps.some((step) => step.teacherNote === 'Count each group')).toBe(true)
  })

  it('uses concrete sharing for small remainder problems too', () => {
    const script = buildLongDivisionLessonScript({ dividend: 36, divisor: 5 })

    expect(script?.scene.nodes['step.0.group.0.circle']).toBeDefined()
    expect(script?.steps.some((step) => step.speech.includes('left over'))).toBe(true)
  })

  it('uses the concrete sharing path by default for school-age single-digit divisors', () => {
    const script = buildLongDivisionLessonScript({ dividend: 45, divisor: 5 })

    expect(script?.scene.nodes['step.0.group.0.circle']).toBeDefined()
    expect(script?.steps.some((step) => step.id.includes('share_fast'))).toBe(true)
  })

  it('uses the concrete sharing path for regular profiles on 29 divided by 3', () => {
    const regularLearner: LearnerProfile = {
      id: 'profile-regular',
      userId: 'user-1',
      name: 'Sam',
      age: 9,
      avatar: '🧒',
      grade: '4',
      topicsAttempted: {},
      topicStars: {},
      commonErrors: [],
      preferredStyle: 'auto',
      sessionCount: 0,
      lastActive: new Date().toISOString(),
      totalStars: 0,
      aiNotes: [],
    }

    const script = buildLongDivisionLessonScript({ dividend: 29, divisor: 3 }, regularLearner)

    expect(script?.scene.nodes['step.0.group.0.circle']).toBeDefined()
    expect(script?.steps.some((step) => step.id.includes('share_fast'))).toBe(true)
    expect(script?.steps.find((step) => step.id.includes('share_fast'))?.actions).toContainEqual({
      type: 'reveal_result',
      target: 'step.0.group.0.chunk.0',
      text: '|||||',
    })
    expect(script?.steps.find((step) => step.id.includes('share_fast'))?.actions).toContainEqual({
      type: 'reveal_result',
      target: 'step.0.group.0.chunk.1',
      text: '||||',
    })
  })

  it('uses the concrete sharing path for younger learners on larger simple division steps', () => {
    const youngLearner: LearnerProfile = {
      id: 'profile-young',
      userId: 'user-1',
      name: 'Juniper',
      age: 6,
      avatar: '🧒',
      grade: '1',
      topicsAttempted: {},
      topicStars: {},
      commonErrors: [],
      preferredStyle: 'step-by-step',
      sessionCount: 0,
      lastActive: new Date().toISOString(),
      totalStars: 0,
      aiNotes: [],
    }

    const script = buildLongDivisionLessonScript({ dividend: 50, divisor: 7 }, youngLearner)

    expect(script?.scene.nodes['step.0.group.0.circle']).toBeDefined()
    expect(script?.steps.some((step) => step.id.includes('share_'))).toBe(true)
  })

  it('keeps using the concrete sharing path for younger learners with larger divisors', () => {
    const youngLearner: LearnerProfile = {
      id: 'profile-young-large',
      userId: 'user-1',
      name: 'Juniper',
      age: 6,
      avatar: '🧒',
      grade: '1',
      topicsAttempted: {},
      topicStars: {},
      commonErrors: [],
      preferredStyle: 'step-by-step',
      sessionCount: 0,
      lastActive: new Date().toISOString(),
      totalStars: 0,
      aiNotes: [],
    }

    const script = buildLongDivisionLessonScript({ dividend: 84, divisor: 7 }, youngLearner)

    expect(script?.scene.nodes['step.0.group.6.circle']).toBeDefined()
    expect(script?.steps.some((step) => step.id.includes('share_'))).toBe(true)
  })

  it('explains when the first digit is too small and reveals a prominent final answer', () => {
    const script = buildLongDivisionLessonScript({ dividend: 45, divisor: 7 })

    expect(script?.steps.some((step) => step.id.includes('check_first_digit'))).toBe(true)
    expect(script?.scene.nodes['summary.answer']).toBeDefined()
    expect(script?.steps.find((step) => step.id === 'summary')?.actions.some((action) => action.type === 'reveal_result')).toBe(true)
  })
})

describe('speech normalization', () => {
  it('reads multi-digit numbers as words', () => {
    expect(normalizeNumbersForSpeech('12 goes into 300 25 times')).toBe('twelve goes into three hundred twenty five times')
  })
})
