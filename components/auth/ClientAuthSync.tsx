'use client'

import { useEffect } from 'react'
import { setStorageUserId } from '@/lib/storage-user'
import { migrateLocalDataToUser } from '@/lib/db'
import { migrateLegacySettingsToCurrentUser } from '@/lib/security'
import { getEffectiveUserId, isDevAuthBypassClient, DEV_BYPASS_USER_ID } from '@/lib/dev-auth'

// useAuth() must only be called when ClerkProvider is in the tree.
// We dynamically import a thin wrapper so the hook is tree-shaken
// away entirely when the bypass is active.
function ClerkAuthSync() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAuth } = require('@clerk/nextjs') as typeof import('@clerk/nextjs')
  const { isLoaded, userId } = useAuth()

  useEffect(() => {
    if (!isLoaded) return
    const effectiveUserId = getEffectiveUserId(userId, false)
    setStorageUserId(effectiveUserId)
    if (effectiveUserId) {
      migrateLegacySettingsToCurrentUser()
      void migrateLocalDataToUser(effectiveUserId)
    }
  }, [isLoaded, userId])

  return null
}

function DevAuthSync() {
  useEffect(() => {
    // Bypass mode: immediately seed storage with the dev user id.
    setStorageUserId(DEV_BYPASS_USER_ID)
    migrateLegacySettingsToCurrentUser()
    void migrateLocalDataToUser(DEV_BYPASS_USER_ID)
  }, [])

  return null
}

export default function ClientAuthSync() {
  const bypassEnabled = isDevAuthBypassClient()
  return bypassEnabled ? <DevAuthSync /> : <ClerkAuthSync />
}
