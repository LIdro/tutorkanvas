'use client'

const STORAGE_USER_KEY = 'tk_active_user_id'

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function getStorageUserId(): string | null {
  if (!isBrowser()) return null
  const userId = window.localStorage.getItem(STORAGE_USER_KEY)
  return userId?.trim() ? userId : null
}

export function setStorageUserId(userId: string | null): void {
  if (!isBrowser()) return

  if (userId?.trim()) {
    window.localStorage.setItem(STORAGE_USER_KEY, userId)
  } else {
    window.localStorage.removeItem(STORAGE_USER_KEY)
  }

  window.dispatchEvent(new Event('tk-storage-user-changed'))
}
