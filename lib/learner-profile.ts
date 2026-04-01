// ─────────────────────────────────────────────
// TutorKanvas — Learner Profile (IndexedDB)
// All data stays on the user's device.
// ─────────────────────────────────────────────

import type { LearnerProfile } from '@/types'
import { generateId, nowISO } from './utils'
import { getDB, PROFILES_STORE } from './db'

// ── CRUD ──────────────────────────────────────

export async function createProfile(name: string, age?: number, grade?: string): Promise<LearnerProfile> {
  const profile: LearnerProfile = {
    id: generateId(),
    name,
    age,
    grade,
    avatar: '🧒',
    topicsAttempted: {},
    topicStars: {},
    commonErrors: [],
    preferredStyle: 'auto',
    sessionCount: 0,
    lastActive: nowISO(),
    totalStars: 0,
    aiNotes: [],
  }
  const db = await getDB()
  await db.put(PROFILES_STORE, profile)
  return profile
}

export async function getProfile(id: string): Promise<LearnerProfile | null> {
  const db = await getDB()
  return (await db.get(PROFILES_STORE, id)) ?? null
}

export async function getAllProfiles(): Promise<LearnerProfile[]> {
  const db = await getDB()
  return db.getAll(PROFILES_STORE)
}

export async function updateProfile(id: string, updates: Partial<LearnerProfile>): Promise<void> {
  const db = await getDB()
  const existing = await db.get(PROFILES_STORE, id)
  if (!existing) return
  await db.put(PROFILES_STORE, { ...existing, ...updates })
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(PROFILES_STORE, id)
}

// ── Learning Data Updates ─────────────────────

export async function recordTopicAttempt(profileId: string, topic: string): Promise<void> {
  const profile = await getProfile(profileId)
  if (!profile) return
  const current = profile.topicsAttempted[topic] ?? 0
  await updateProfile(profileId, {
    topicsAttempted: { ...profile.topicsAttempted, [topic]: current + 1 },
    lastActive: nowISO(),
  })
}

export async function recordStars(profileId: string, topic: string, stars: 1 | 2 | 3): Promise<void> {
  const profile = await getProfile(profileId)
  if (!profile) return
  const prev = profile.topicStars[topic] ?? 0
  const best = Math.max(prev, stars) as 1 | 2 | 3
  await updateProfile(profileId, {
    topicStars: { ...profile.topicStars, [topic]: best },
    totalStars: profile.totalStars + stars,
  })
}

/**
 * Award stars without a specific topic — used by game components that
 * only know the star count, not the topic (e.g. TimedMath).
 */
export async function addStars(profileId: string, stars: number): Promise<void> {
  if (stars <= 0) return
  const profile = await getProfile(profileId)
  if (!profile) return
  await updateProfile(profileId, {
    totalStars: profile.totalStars + Math.round(stars),
  })
}

export async function addAINote(profileId: string, note: string): Promise<void> {
  const profile = await getProfile(profileId)
  if (!profile) return
  const notes = [...profile.aiNotes, note].slice(-10) // keep last 10
  await updateProfile(profileId, { aiNotes: notes })
}

export async function incrementSessionCount(profileId: string): Promise<void> {
  const profile = await getProfile(profileId)
  if (!profile) return
  await updateProfile(profileId, {
    sessionCount: profile.sessionCount + 1,
    lastActive: nowISO(),
  })
}
