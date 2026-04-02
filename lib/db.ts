// ─────────────────────────────────────────────
// TutorKanvas — Shared IndexedDB connection
// All stores are created in a single upgrade transaction so they always
// co-exist regardless of which lib file opens the database first.
// ─────────────────────────────────────────────

import { openDB, type IDBPDatabase } from 'idb'

export const DB_NAME    = 'tutorkanvas'
export const DB_VERSION = 4
export const PROFILES_STORE = 'profiles'
export const SESSIONS_STORE = 'sessions'
export const AI_LOGS_STORE  = 'ai_logs'

let _db: IDBPDatabase | null = null

export async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, txn) {
      // ── profiles store ────────────────────────
      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        const store = db.createObjectStore(PROFILES_STORE, { keyPath: 'id' })
        store.createIndex('userId', 'userId')
      } else {
        const store = txn.objectStore(PROFILES_STORE)
        if (!store.indexNames.contains('userId')) {
          store.createIndex('userId', 'userId')
        }
      }
      // ── sessions store ────────────────────────
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const store = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' })
        store.createIndex('userId', 'userId')
        store.createIndex('profileId', 'profileId')
        store.createIndex('updatedAt', 'updatedAt')
      } else {
        const store = txn.objectStore(SESSIONS_STORE)
        if (!store.indexNames.contains('userId')) {
          store.createIndex('userId', 'userId')
        }
        if (!store.indexNames.contains('profileId')) {
          store.createIndex('profileId', 'profileId')
        }
        if (!store.indexNames.contains('updatedAt')) {
          store.createIndex('updatedAt', 'updatedAt')
        }
      }
      void oldVersion // suppress unused-var lint

      // ── ai_logs store ─────────────────────────
      if (!db.objectStoreNames.contains(AI_LOGS_STORE)) {
        const store = db.createObjectStore(AI_LOGS_STORE, { keyPath: 'id' })
        store.createIndex('sessionId',  'sessionId')
        store.createIndex('profileId',  'profileId')
        store.createIndex('createdAt',  'createdAt')
        store.createIndex('isError',    'isError')
        store.createIndex('responseMode', 'responseMode')
      }
    },
  })
  return _db
}

export async function migrateLocalDataToUser(userId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction([PROFILES_STORE, SESSIONS_STORE], 'readwrite')

  const profiles = await tx.objectStore(PROFILES_STORE).getAll()
  for (const profile of profiles) {
    if (!profile.userId) {
      await tx.objectStore(PROFILES_STORE).put({ ...profile, userId })
    }
  }

  const sessions = await tx.objectStore(SESSIONS_STORE).getAll()
  for (const session of sessions) {
    if (!session.userId) {
      await tx.objectStore(SESSIONS_STORE).put({ ...session, userId })
    }
  }

  await tx.done
}
