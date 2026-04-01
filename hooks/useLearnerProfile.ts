'use client'
// ─────────────────────────────────────────────
// TutorKanvas — useLearnerProfile Hook
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import {
  getAllProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  recordTopicAttempt,
  recordStars,
  addAINote,
  incrementSessionCount,
} from '@/lib/learner-profile'
import { getActiveProfileId, saveActiveProfileId } from '@/lib/security'
import type { LearnerProfile } from '@/types'

export function useLearnerProfile() {
  const [profiles, setProfiles] = useState<LearnerProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<LearnerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    const all = await getAllProfiles()
    setProfiles(all)

    const activeId = getActiveProfileId()
    if (activeId) {
      const p = await getProfile(activeId)
      setActiveProfile(p)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadProfiles() }, [loadProfiles])

  const selectProfile = useCallback(async (id: string) => {
    saveActiveProfileId(id)
    const p = await getProfile(id)
    setActiveProfile(p)
    if (p) await incrementSessionCount(id)
  }, [])

  const addProfile = useCallback(async (name: string, age?: number, grade?: string) => {
    const p = await createProfile(name, age, grade)
    await loadProfiles()
    return p
  }, [loadProfiles])

  const editProfile = useCallback(async (id: string, updates: Partial<LearnerProfile>) => {
    await updateProfile(id, updates)
    await loadProfiles()
  }, [loadProfiles])

  const removeProfile = useCallback(async (id: string) => {
    await deleteProfile(id)
    if (activeProfile?.id === id) {
      setActiveProfile(null)
      saveActiveProfileId('')
    }
    await loadProfiles()
  }, [activeProfile, loadProfiles])

  const logTopicAttempt = useCallback(async (topic: string) => {
    if (!activeProfile) return
    await recordTopicAttempt(activeProfile.id, topic)
    await loadProfiles()
  }, [activeProfile, loadProfiles])

  const logStars = useCallback(async (topic: string, stars: 1 | 2 | 3) => {
    if (!activeProfile) return
    await recordStars(activeProfile.id, topic, stars)
    await loadProfiles()
  }, [activeProfile, loadProfiles])

  const logAINote = useCallback(async (note: string) => {
    if (!activeProfile) return
    await addAINote(activeProfile.id, note)
    await loadProfiles()
  }, [activeProfile, loadProfiles])

  return {
    profiles,
    activeProfile,
    loading,
    selectProfile,
    addProfile,
    editProfile,
    removeProfile,
    logTopicAttempt,
    logStars,
    logAINote,
    refresh: loadProfiles,
  }
}
