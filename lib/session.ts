// ─────────────────────────────────────────────
// TutorKanvas — Session Storage (IndexedDB)
// Canvas state + conversation history per session.
// ─────────────────────────────────────────────

import type { TKSession } from '@/types'
import { generateId, nowISO } from './utils'
import { getDB, SESSIONS_STORE } from './db'

const MAX_SESSIONS = 50

// ── CRUD ──────────────────────────────────────

export async function createSession(profileId: string, name?: string): Promise<TKSession> {
  const session: TKSession = {
    id: generateId(),
    profileId,
    name: name ?? `Session ${new Date().toLocaleDateString()}`,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    canvasState: null,
    messages: [],
    topicsCovered: [],
  }
  const db = await getDB()
  await db.put(SESSIONS_STORE, session)
  await enforceSessionLimit(profileId)
  return session
}

export async function getSession(id: string): Promise<TKSession | null> {
  const db = await getDB()
  return (await db.get(SESSIONS_STORE, id)) ?? null
}

export async function getSessionsByProfile(profileId: string): Promise<TKSession[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex(SESSIONS_STORE, 'profileId', profileId)
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Returns ALL sessions across all profiles, sorted newest-first. */
export async function getSessions(): Promise<TKSession[]> {
  const db = await getDB()
  const all = await db.getAll(SESSIONS_STORE)
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function updateSession(id: string, updates: Partial<TKSession>): Promise<void> {
  const db = await getDB()
  const existing = await db.get(SESSIONS_STORE, id)
  if (!existing) return
  await db.put(SESSIONS_STORE, { ...existing, ...updates, updatedAt: nowISO() })
}

export async function saveCanvasState(sessionId: string, canvasState: unknown): Promise<void> {
  await updateSession(sessionId, { canvasState })
}

export async function appendMessage(sessionId: string, message: { role: 'user' | 'assistant' | 'system'; content: string }): Promise<void> {
  const session = await getSession(sessionId)
  if (!session) return
  await updateSession(sessionId, {
    messages: [...session.messages, message],
  })
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(SESSIONS_STORE, id)
}

export async function renameSession(id: string, name: string): Promise<void> {
  await updateSession(id, { name })
}

// ── Session Limit Enforcement ─────────────────

async function enforceSessionLimit(profileId: string): Promise<void> {
  const sessions = await getSessionsByProfile(profileId)
  if (sessions.length <= MAX_SESSIONS) return
  // Delete oldest sessions beyond limit
  const toDelete = sessions.slice(MAX_SESSIONS)
  const db = await getDB()
  await Promise.all(toDelete.map((s) => db.delete(SESSIONS_STORE, s.id)))
}

export async function getSessionCount(profileId: string): Promise<number> {
  const sessions = await getSessionsByProfile(profileId)
  return sessions.length
}

export async function isNearSessionLimit(profileId: string): Promise<boolean> {
  const count = await getSessionCount(profileId)
  return count >= MAX_SESSIONS - 5
}
