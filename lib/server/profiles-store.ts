import 'server-only'

import type { LearnerProfile } from '@/types'
import { ensureDatabase, getSql } from './database'

type ProfileRow = {
  id: string
  user_id: string
  name: string
  age: number | null
  grade: string | null
  avatar: string | null
  topics_attempted: Record<string, number>
  topic_stars: Record<string, number>
  common_errors: string[]
  preferred_style: LearnerProfile['preferredStyle']
  session_count: number
  last_active: string
  total_stars: number
  ai_notes: string[]
}

function mapProfile(row: ProfileRow): LearnerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    age: row.age ?? undefined,
    grade: row.grade ?? undefined,
    avatar: row.avatar ?? undefined,
    topicsAttempted: row.topics_attempted ?? {},
    topicStars: row.topic_stars ?? {},
    commonErrors: row.common_errors ?? [],
    preferredStyle: row.preferred_style ?? 'auto',
    sessionCount: row.session_count ?? 0,
    lastActive: row.last_active,
    totalStars: row.total_stars ?? 0,
    aiNotes: row.ai_notes ?? [],
  }
}

export async function listProfiles(userId: string): Promise<LearnerProfile[]> {
  await ensureDatabase()
  const sql = getSql()
  const rows = await sql<ProfileRow[]>`
    select
      id, user_id, name, age, grade, avatar,
      topics_attempted, topic_stars, common_errors,
      preferred_style, session_count, last_active,
      total_stars, ai_notes
    from learner_profiles
    where user_id = ${userId}
    order by updated_at desc, created_at desc
  `

  return rows.map(mapProfile)
}

export async function getProfileById(userId: string, id: string): Promise<LearnerProfile | null> {
  await ensureDatabase()
  const sql = getSql()
  const rows = await sql<ProfileRow[]>`
    select
      id, user_id, name, age, grade, avatar,
      topics_attempted, topic_stars, common_errors,
      preferred_style, session_count, last_active,
      total_stars, ai_notes
    from learner_profiles
    where user_id = ${userId} and id = ${id}
    limit 1
  `

  return rows[0] ? mapProfile(rows[0]) : null
}

export async function createProfileRecord(profile: LearnerProfile): Promise<LearnerProfile> {
  await ensureDatabase()
  const sql = getSql()

  await sql`
    insert into learner_profiles (
      id, user_id, name, age, grade, avatar,
      topics_attempted, topic_stars, common_errors,
      preferred_style, session_count, last_active,
      total_stars, ai_notes
    ) values (
      ${profile.id}, ${profile.userId}, ${profile.name}, ${profile.age ?? null}, ${profile.grade ?? null}, ${profile.avatar ?? null},
      ${sql.json(profile.topicsAttempted)}, ${sql.json(profile.topicStars)}, ${sql.json(profile.commonErrors)},
      ${profile.preferredStyle}, ${profile.sessionCount}, ${profile.lastActive},
      ${profile.totalStars}, ${sql.json(profile.aiNotes)}
    )
  `

  return profile
}

export async function updateProfileRecord(userId: string, id: string, updates: Partial<LearnerProfile>): Promise<LearnerProfile | null> {
  const existing = await getProfileById(userId, id)
  if (!existing) return null

  const nextProfile: LearnerProfile = {
    ...existing,
    ...updates,
    id: existing.id,
    userId: existing.userId,
  }

  await ensureDatabase()
  const sql = getSql()
  await sql`
    update learner_profiles
    set
      name = ${nextProfile.name},
      age = ${nextProfile.age ?? null},
      grade = ${nextProfile.grade ?? null},
      avatar = ${nextProfile.avatar ?? null},
      topics_attempted = ${sql.json(nextProfile.topicsAttempted)},
      topic_stars = ${sql.json(nextProfile.topicStars)},
      common_errors = ${sql.json(nextProfile.commonErrors)},
      preferred_style = ${nextProfile.preferredStyle},
      session_count = ${nextProfile.sessionCount},
      last_active = ${nextProfile.lastActive},
      total_stars = ${nextProfile.totalStars},
      ai_notes = ${sql.json(nextProfile.aiNotes)},
      updated_at = now()
    where user_id = ${userId} and id = ${id}
  `

  return nextProfile
}

export async function deleteProfileRecord(userId: string, id: string): Promise<void> {
  await ensureDatabase()
  const sql = getSql()
  await sql`delete from learner_profiles where user_id = ${userId} and id = ${id}`
  await sql`delete from learner_sessions where user_id = ${userId} and profile_id = ${id}`
}
