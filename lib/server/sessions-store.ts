import 'server-only'

import type { TKSession, Message } from '@/types'
import { ensureDatabase, getSql } from './database'

type SessionRow = {
  id: string
  user_id: string
  profile_id: string
  name: string
  created_at: string
  updated_at: string
  canvas_state: unknown
  messages: Message[]
  topics_covered: string[]
}

function mapSession(row: SessionRow): TKSession {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canvasState: row.canvas_state ?? null,
    messages: row.messages ?? [],
    topicsCovered: row.topics_covered ?? [],
  }
}

function toJsonValue(value: unknown) {
  return (value ?? null) as Parameters<ReturnType<typeof getSql>['json']>[0]
}

export async function listSessions(userId: string, profileId?: string): Promise<TKSession[]> {
  await ensureDatabase()
  const sql = getSql()
  const rows = profileId
    ? await sql<SessionRow[]>`
        select id, user_id, profile_id, name, created_at, updated_at, canvas_state, messages, topics_covered
        from learner_sessions
        where user_id = ${userId} and profile_id = ${profileId}
        order by updated_at desc
      `
    : await sql<SessionRow[]>`
        select id, user_id, profile_id, name, created_at, updated_at, canvas_state, messages, topics_covered
        from learner_sessions
        where user_id = ${userId}
        order by updated_at desc
      `

  return rows.map(mapSession)
}

export async function getSessionById(userId: string, id: string): Promise<TKSession | null> {
  await ensureDatabase()
  const sql = getSql()
  const rows = await sql<SessionRow[]>`
    select id, user_id, profile_id, name, created_at, updated_at, canvas_state, messages, topics_covered
    from learner_sessions
    where user_id = ${userId} and id = ${id}
    limit 1
  `

  return rows[0] ? mapSession(rows[0]) : null
}

export async function createSessionRecord(session: TKSession): Promise<TKSession> {
  await ensureDatabase()
  const sql = getSql()

  await sql`
    insert into learner_sessions (
      id, user_id, profile_id, name, created_at, updated_at, canvas_state, messages, topics_covered
    ) values (
      ${session.id}, ${session.userId}, ${session.profileId}, ${session.name},
      ${session.createdAt}, ${session.updatedAt}, ${sql.json(toJsonValue(session.canvasState))},
      ${sql.json(toJsonValue(session.messages))}, ${sql.json(toJsonValue(session.topicsCovered))}
    )
  `

  return session
}

export async function updateSessionRecord(userId: string, id: string, updates: Partial<TKSession>): Promise<TKSession | null> {
  const existing = await getSessionById(userId, id)
  if (!existing) return null

  const nextSession: TKSession = {
    ...existing,
    ...updates,
    id: existing.id,
    userId: existing.userId,
    updatedAt: updates.updatedAt ?? new Date().toISOString(),
  }

  await ensureDatabase()
  const sql = getSql()
  await sql`
    update learner_sessions
    set
      profile_id = ${nextSession.profileId},
      name = ${nextSession.name},
      created_at = ${nextSession.createdAt},
      updated_at = ${nextSession.updatedAt},
      canvas_state = ${sql.json(toJsonValue(nextSession.canvasState))},
      messages = ${sql.json(toJsonValue(nextSession.messages))},
      topics_covered = ${sql.json(toJsonValue(nextSession.topicsCovered))}
    where user_id = ${userId} and id = ${id}
  `

  return nextSession
}

export async function deleteSessionRecord(userId: string, id: string): Promise<void> {
  await ensureDatabase()
  const sql = getSql()
  await sql`delete from learner_sessions where user_id = ${userId} and id = ${id}`
}
