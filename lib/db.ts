// ─────────────────────────────────────────────
// TutorKanvas — Shared IndexedDB connection
// All stores are created in a single upgrade transaction so they always
// co-exist regardless of which lib file opens the database first.
// ─────────────────────────────────────────────

import { openDB, type IDBPDatabase } from 'idb'

export const DB_NAME    = 'tutorkanvas'
export const DB_VERSION = 2          // bumped so upgrade runs on stale v1 DBs
export const PROFILES_STORE = 'profiles'
export const SESSIONS_STORE = 'sessions'

let _db: IDBPDatabase | null = null

export async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // ── profiles store ────────────────────────
      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        db.createObjectStore(PROFILES_STORE, { keyPath: 'id' })
      }
      // ── sessions store ────────────────────────
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const store = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' })
        store.createIndex('profileId', 'profileId')
        store.createIndex('updatedAt', 'updatedAt')
      }
      void oldVersion // suppress unused-var lint
    },
  })
  return _db
}
