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
})

describe('speech normalization', () => {
  it('reads multi-digit numbers as words', () => {
    expect(normalizeNumbersForSpeech('12 goes into 300 25 times')).toBe('twelve goes into three hundred twenty five times')
  })
})
