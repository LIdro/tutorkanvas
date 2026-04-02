// ─────────────────────────────────────────────
// TutorKanvas — AI Interaction Logger
//
// Every call that goes to an LLM gets a structured log entry written to
// IndexedDB.  The log captures:
//   • the full system prompt
//   • the user input messages
//   • the raw model response
//   • parsed artifacts (canvas actions OR lesson script)
//   • provider / model / latency / token estimate
//   • whether the call produced an error
//
// Images are NEVER stored — only a boolean flag indicating that an image
// was present is kept, matching the privacy guarantee in the vision route.
//
// Public API
// ──────────
//   logInteraction(entry)             → write one log entry
//   getLogs(filters?)                 → paginated summary list (no heavy text)
//   getLog(id)                        → full detail for one entry
//   clearLogs()                       → wipe all log entries
//   exportLogsAsJSON()                → JSON string of all full entries
// ─────────────────────────────────────────────

import { getDB, AI_LOGS_STORE } from './db'
import { generateId, nowISO } from './utils'
import type {
  AIInteractionLog,
  AIInteractionSummary,
  AIResponseMode,
  CanvasAction,
  LessonScript,
} from '@/types'

// ── Max entries kept to avoid unbounded growth ──

const MAX_LOG_ENTRIES = 500

// ── Input shape for logInteraction ─────────────

export interface LogInteractionInput {
  sessionId: string | null
  profileId: string | null
  provider: string
  model: string
  responseMode: AIResponseMode
  systemPrompt: string
  /** User-visible messages only — omit the system message entry */
  inputMessages: Array<{ role: string; content: string }>
  rawResponse: string
  parsedActions?: CanvasAction[] | null
  parsedLessonScript?: LessonScript | null
  topic?: string | null
  latencyMs: number
  isError?: boolean
  errorMessage?: string | null
  hadImage?: boolean
}

// ── Write ───────────────────────────────────────

export async function logInteraction(input: LogInteractionInput): Promise<string> {
  const id = generateId()
  const entry: AIInteractionLog = {
    id,
    createdAt: nowISO(),
    sessionId: input.sessionId,
    profileId: input.profileId,
    provider: input.provider,
    model: input.model,
    responseMode: input.responseMode,
    systemPrompt: input.systemPrompt,
    inputMessages: input.inputMessages,
    rawResponse: input.rawResponse,
    parsedActions: input.parsedActions ?? null,
    parsedLessonScript: input.parsedLessonScript ?? null,
    topic: input.topic ?? null,
    latencyMs: input.latencyMs,
    tokenEstimate: Math.round((input.systemPrompt.length + input.rawResponse.length) / 4),
    isError: input.isError ?? false,
    errorMessage: input.errorMessage ?? null,
    hadImage: input.hadImage ?? false,
  }

  try {
    const db = await getDB()
    await db.put(AI_LOGS_STORE, entry)
    await enforceLogLimit()
  } catch {
    // Logging must never throw — silently ignore storage failures
  }

  return id
}

// ── Read — summaries (fast, no heavy text fields) ──

export interface LogFilters {
  sessionId?: string
  profileId?: string
  responseMode?: AIResponseMode
  isError?: boolean
  /** ISO date string — only entries >= this date */
  since?: string
  limit?: number
}

export async function getLogs(filters: LogFilters = {}): Promise<AIInteractionSummary[]> {
  try {
    const db = await getDB()
    let all: AIInteractionLog[]

    if (filters.sessionId) {
      all = await db.getAllFromIndex(AI_LOGS_STORE, 'sessionId', filters.sessionId)
    } else if (filters.profileId) {
      all = await db.getAllFromIndex(AI_LOGS_STORE, 'profileId', filters.profileId)
    } else {
      all = await db.getAll(AI_LOGS_STORE)
    }

    // Apply remaining filters
    let filtered = all
    if (filters.responseMode !== undefined) {
      filtered = filtered.filter((e) => e.responseMode === filters.responseMode)
    }
    if (filters.isError !== undefined) {
      filtered = filtered.filter((e) => e.isError === filters.isError)
    }
    if (filters.since) {
      filtered = filtered.filter((e) => e.createdAt >= filters.since!)
    }

    // Sort newest first
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    const limit = filters.limit ?? 200
    const page = filtered.slice(0, limit)

    return page.map(toSummary)
  } catch {
    return []
  }
}

// ── Read — single full entry ────────────────────

export async function getLog(id: string): Promise<AIInteractionLog | null> {
  try {
    const db = await getDB()
    return (await db.get(AI_LOGS_STORE, id)) ?? null
  } catch {
    return null
  }
}

// ── Delete ──────────────────────────────────────

export async function clearLogs(): Promise<void> {
  try {
    const db = await getDB()
    await db.clear(AI_LOGS_STORE)
  } catch {
    // Silently ignore
  }
}

// ── Export ──────────────────────────────────────

export async function exportLogsAsJSON(): Promise<string> {
  try {
    const db = await getDB()
    const all: AIInteractionLog[] = await db.getAll(AI_LOGS_STORE)
    all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return JSON.stringify(all, null, 2)
  } catch {
    return '[]'
  }
}

// ── Internal helpers ────────────────────────────

function toSummary(entry: AIInteractionLog): AIInteractionSummary {
  const userMessage = entry.inputMessages.find((m) => m.role === 'user')?.content ?? ''
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    sessionId: entry.sessionId,
    profileId: entry.profileId,
    provider: entry.provider,
    model: entry.model,
    responseMode: entry.responseMode,
    topic: entry.topic,
    latencyMs: entry.latencyMs,
    tokenEstimate: entry.tokenEstimate,
    isError: entry.isError,
    hadImage: entry.hadImage,
    promptPreview: truncate(userMessage, 120),
    responsePreview: truncate(entry.rawResponse, 120),
  }
}

function truncate(text: string, maxLen: number): string {
  if (!text) return ''
  return text.length <= maxLen ? text : text.slice(0, maxLen) + '…'
}

async function enforceLogLimit(): Promise<void> {
  try {
    const db = await getDB()
    const all: AIInteractionLog[] = await db.getAll(AI_LOGS_STORE)
    if (all.length <= MAX_LOG_ENTRIES) return
    // Sort oldest first and delete oldest overshoot
    all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const toDelete = all.slice(0, all.length - MAX_LOG_ENTRIES)
    await Promise.all(toDelete.map((e) => db.delete(AI_LOGS_STORE, e.id)))
  } catch {
    // Silently ignore
  }
}
