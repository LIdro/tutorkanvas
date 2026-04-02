// ─────────────────────────────────────────────
// TutorKanvas — Session Storage (IndexedDB)
// Canvas state + conversation history per session.
// ─────────────────────────────────────────────

import type { TKSession } from '@/types'
import { generateId, nowISO } from './utils'
import { getDB, SESSIONS_STORE } from './db'
import { getStorageUserId } from './storage-user'

const MAX_SESSIONS = 50
let remoteSessionApiAvailable = true

function getCurrentUserId(): string {
  return getStorageUserId() ?? 'anonymous'
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T | null> {
  if (!remoteSessionApiAvailable) return null
  try {
    const res = await fetch(input, init)
    if (res.status === 503) {
      remoteSessionApiAvailable = false
      return null
    }
    if (!res.ok) return null
    if (res.status === 204) return null
    return (await res.json()) as T
  } catch {
    remoteSessionApiAvailable = false
    return null
  }
}

// ── CRUD ──────────────────────────────────────

export async function createSession(profileId: string, name?: string): Promise<TKSession> {
  const session: TKSession = {
    id: generateId(),
    userId: getCurrentUserId(),
    profileId,
    name: name ?? `Session ${new Date().toLocaleDateString()}`,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    canvasState: null,
    messages: [],
    topicsCovered: [],
  }

  const remote = await fetchJson<TKSession>('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  })
  if (remote) return remote

  const db = await getDB()
  await db.put(SESSIONS_STORE, session)
  await enforceSessionLimit(profileId)
  return session
}

export async function getSession(id: string): Promise<TKSession | null> {
  const remote = await fetchJson<TKSession>(`/api/sessions/${id}`)
  if (remote) return remote

  const db = await getDB()
  return (await db.get(SESSIONS_STORE, id)) ?? null
}

export async function getSessionsByProfile(profileId: string): Promise<TKSession[]> {
  const remote = await fetchJson<TKSession[]>(`/api/sessions?profileId=${encodeURIComponent(profileId)}`)
  if (remote) return remote

  const db = await getDB()
  const all = await db.getAllFromIndex(SESSIONS_STORE, 'profileId', profileId)
  return all
    .filter((session) => session.userId === getCurrentUserId())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Returns ALL sessions across all profiles, sorted newest-first. */
export async function getSessions(): Promise<TKSession[]> {
  const remote = await fetchJson<TKSession[]>('/api/sessions')
  if (remote) return remote

  const db = await getDB()
  const all = await db.getAll(SESSIONS_STORE)
  return all
    .filter((session) => session.userId === getCurrentUserId())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function updateSession(id: string, updates: Partial<TKSession>): Promise<void> {
  if (remoteSessionApiAvailable) {
    const remote = await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => {
      remoteSessionApiAvailable = false
      return null
    })
    if (remote?.status === 503) {
      remoteSessionApiAvailable = false
    } else if (remote?.ok) {
      return
    }
  }

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
  if (remoteSessionApiAvailable) {
    const remote = await fetch(`/api/sessions/${id}`, { method: 'DELETE' }).catch(() => {
      remoteSessionApiAvailable = false
      return null
    })
    if (remote?.status === 503) {
      remoteSessionApiAvailable = false
    } else if (remote?.ok) {
      return
    }
  }

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
