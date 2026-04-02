// ─────────────────────────────────────────────
// Tests: lib/ai-logger.ts
// Uses fake-indexeddb (auto-loaded in setup.ts)
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import {
  logInteraction,
  getLogs,
  getLog,
  clearLogs,
  exportLogsAsJSON,
} from '@/lib/ai-logger'
import type { LogInteractionInput } from '@/lib/ai-logger'

// ── Fixtures ─────────────────────────────────

function makeInput(overrides: Partial<LogInteractionInput> = {}): LogInteractionInput {
  return {
    sessionId: 'session-abc',
    profileId: 'profile-xyz',
    provider: 'openrouter',
    model: 'gpt-4o',
    responseMode: 'canvas',
    systemPrompt: 'You are a helpful tutor.',
    inputMessages: [{ role: 'user', content: 'What is 12 × 7?' }],
    rawResponse: '{"message":"12 × 7 = 84","actions":[],"topic":"multiplication"}',
    parsedActions: [],
    parsedLessonScript: null,
    topic: 'multiplication',
    latencyMs: 1234,
    isError: false,
    errorMessage: null,
    hadImage: false,
    ...overrides,
  }
}

// ── Reset between tests ───────────────────────

beforeEach(async () => {
  await clearLogs()
})

// ── logInteraction ────────────────────────────

describe('logInteraction', () => {
  it('returns a non-empty id string', async () => {
    const id = await logInteraction(makeInput())
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('persists the entry so getLog can retrieve it', async () => {
    const id = await logInteraction(makeInput())
    const entry = await getLog(id)
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe(id)
  })

  it('stores all scalar fields correctly', async () => {
    const input = makeInput({ latencyMs: 999, provider: 'anthropic', model: 'claude-3-5-sonnet' })
    const id = await logInteraction(input)
    const entry = await getLog(id)
    expect(entry!.provider).toBe('anthropic')
    expect(entry!.model).toBe('claude-3-5-sonnet')
    expect(entry!.latencyMs).toBe(999)
    expect(entry!.isError).toBe(false)
    expect(entry!.hadImage).toBe(false)
  })

  it('calculates a positive tokenEstimate', async () => {
    const id = await logInteraction(makeInput())
    const entry = await getLog(id)
    expect(entry!.tokenEstimate).toBeGreaterThan(0)
  })

  it('sets isError and errorMessage for error entries', async () => {
    const id = await logInteraction(makeInput({ isError: true, errorMessage: 'Timeout' }))
    const entry = await getLog(id)
    expect(entry!.isError).toBe(true)
    expect(entry!.errorMessage).toBe('Timeout')
  })

  it('handles vision mode with hadImage flag', async () => {
    const id = await logInteraction(makeInput({ responseMode: 'vision', hadImage: true }))
    const entry = await getLog(id)
    expect(entry!.responseMode).toBe('vision')
    expect(entry!.hadImage).toBe(true)
  })

  it('handles lesson_script mode with parsedLessonScript', async () => {
    const script = {
      lessonId: 'ls-1',
      topic: 'subtraction',
      scene: { id: 'scene-1', kind: 'vertical-subtraction' as const, nodes: {} },
      steps: [
        { id: 'step-1', speech: 'Let us subtract.', actions: [], waitFor: 'speech_end' as const },
      ],
    }
    const id = await logInteraction(makeInput({ responseMode: 'lesson_script', parsedLessonScript: script }))
    const entry = await getLog(id)
    expect(entry!.responseMode).toBe('lesson_script')
    expect(entry!.parsedLessonScript!.lessonId).toBe('ls-1')
    expect(entry!.parsedLessonScript!.steps).toHaveLength(1)
  })
})

// ── getLogs ───────────────────────────────────

describe('getLogs', () => {
  it('returns empty array when no logs exist', async () => {
    const logs = await getLogs()
    expect(logs).toEqual([])
  })

  it('returns a summary for each logged entry', async () => {
    await logInteraction(makeInput())
    await logInteraction(makeInput({ topic: 'division' }))
    const logs = await getLogs()
    expect(logs).toHaveLength(2)
  })

  it('summaries do not include systemPrompt or rawResponse', async () => {
    await logInteraction(makeInput())
    const logs = await getLogs()
    expect((logs[0] as unknown as Record<string, unknown>).systemPrompt).toBeUndefined()
    expect((logs[0] as unknown as Record<string, unknown>).rawResponse).toBeUndefined()
  })

  it('summary contains promptPreview and responsePreview', async () => {
    await logInteraction(makeInput())
    const logs = await getLogs()
    expect(typeof logs[0].promptPreview).toBe('string')
    expect(typeof logs[0].responsePreview).toBe('string')
  })

  it('filters by sessionId', async () => {
    await logInteraction(makeInput({ sessionId: 'session-A' }))
    await logInteraction(makeInput({ sessionId: 'session-B' }))
    const logs = await getLogs({ sessionId: 'session-A' })
    expect(logs).toHaveLength(1)
    expect(logs[0].sessionId).toBe('session-A')
  })

  it('filters by profileId', async () => {
    await logInteraction(makeInput({ profileId: 'profile-1' }))
    await logInteraction(makeInput({ profileId: 'profile-2' }))
    const logs = await getLogs({ profileId: 'profile-2' })
    expect(logs).toHaveLength(1)
    expect(logs[0].profileId).toBe('profile-2')
  })

  it('filters by responseMode', async () => {
    await logInteraction(makeInput({ responseMode: 'canvas' }))
    await logInteraction(makeInput({ responseMode: 'vision' }))
    const logs = await getLogs({ responseMode: 'vision' })
    expect(logs).toHaveLength(1)
    expect(logs[0].responseMode).toBe('vision')
  })

  it('filters errors only', async () => {
    await logInteraction(makeInput({ isError: false }))
    await logInteraction(makeInput({ isError: true, errorMessage: 'boom' }))
    const logs = await getLogs({ isError: true })
    expect(logs).toHaveLength(1)
    expect(logs[0].isError).toBe(true)
  })

  it('respects limit', async () => {
    await logInteraction(makeInput())
    await logInteraction(makeInput())
    await logInteraction(makeInput())
    const logs = await getLogs({ limit: 2 })
    expect(logs).toHaveLength(2)
  })

  it('returns entries sorted newest-first', async () => {
    const id1 = await logInteraction(makeInput())
    await new Promise((r) => setTimeout(r, 5)) // small delay to ensure different createdAt
    const id2 = await logInteraction(makeInput())
    const logs = await getLogs()
    expect(logs[0].id).toBe(id2)
    expect(logs[1].id).toBe(id1)
  })
})

// ── getLog ────────────────────────────────────

describe('getLog', () => {
  it('returns null for a non-existent id', async () => {
    const entry = await getLog('does-not-exist')
    expect(entry).toBeNull()
  })

  it('returns full entry including systemPrompt', async () => {
    const id = await logInteraction(makeInput({ systemPrompt: 'TOP SECRET PROMPT' }))
    const entry = await getLog(id)
    expect(entry!.systemPrompt).toBe('TOP SECRET PROMPT')
  })
})

// ── clearLogs ─────────────────────────────────

describe('clearLogs', () => {
  it('removes all entries', async () => {
    await logInteraction(makeInput())
    await logInteraction(makeInput())
    await clearLogs()
    const logs = await getLogs()
    expect(logs).toHaveLength(0)
  })

  it('does not throw when store is already empty', async () => {
    await expect(clearLogs()).resolves.toBeUndefined()
  })
})

// ── exportLogsAsJSON ──────────────────────────

describe('exportLogsAsJSON', () => {
  it('returns "[]" when no logs exist', async () => {
    const json = await exportLogsAsJSON()
    expect(json).toBe('[]')
  })

  it('returns valid JSON that parses to an array', async () => {
    await logInteraction(makeInput())
    const json = await exportLogsAsJSON()
    const parsed = JSON.parse(json)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(1)
  })

  it('exported entries contain all required fields', async () => {
    await logInteraction(makeInput({ topic: 'fractions', latencyMs: 777 }))
    const json = await exportLogsAsJSON()
    const [entry] = JSON.parse(json)
    expect(entry).toHaveProperty('id')
    expect(entry).toHaveProperty('createdAt')
    expect(entry).toHaveProperty('systemPrompt')
    expect(entry).toHaveProperty('rawResponse')
    expect(entry).toHaveProperty('inputMessages')
    expect(entry.topic).toBe('fractions')
    expect(entry.latencyMs).toBe(777)
  })

  it('exported entries are sorted oldest-first', async () => {
    const id1 = await logInteraction(makeInput())
    await new Promise((r) => setTimeout(r, 5))
    const id2 = await logInteraction(makeInput())
    const json = await exportLogsAsJSON()
    const [first, second] = JSON.parse(json)
    expect(first.id).toBe(id1)
    expect(second.id).toBe(id2)
  })
})
