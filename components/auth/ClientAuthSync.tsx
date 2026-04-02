'use client'

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { setStorageUserId } from '@/lib/storage-user'
import { migrateLocalDataToUser } from '@/lib/db'
import { migrateLegacySettingsToCurrentUser } from '@/lib/security'

export default function ClientAuthSync() {
  const { isLoaded, userId } = useAuth()

  useEffect(() => {
    if (!isLoaded) return

    setStorageUserId(userId ?? null)

    if (userId) {
      migrateLegacySettingsToCurrentUser()
      void migrateLocalDataToUser(userId)
    }
  }, [isLoaded, userId])

  return null
}
