// ─────────────────────────────────────────────────────────────────────────────
// SERVER-ONLY auth helpers.
// Never import this file from a Client Component — it pulls in @clerk/nextjs/server
// which carries a `server-only` guard and Node.js-only modules (async_hooks, etc.).
//
// Client components should import from lib/dev-auth.ts instead.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'

import { DEV_BYPASS_USER_ID } from './dev-auth'

export function isDevAuthBypassServer(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === 'true'
}

/**
 * Server-side auth helper for API routes and middleware.
 *
 * When the dev-auth bypass is active, Clerk's middleware never ran, so
 * calling `auth()` from `@clerk/nextjs/server` would throw
 * "auth() was called but Clerk can't detect usage of clerkMiddleware()".
 *
 * This function short-circuits to the bypass user id without ever touching
 * Clerk.  In production it calls the real `auth()` and returns the user id.
 *
 * Usage in API routes:
 *   import { getServerAuthUserId } from '@/lib/dev-auth.server'
 *   const effectiveUserId = await getServerAuthUserId()
 *   if (!effectiveUserId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
 */
export async function getServerAuthUserId(): Promise<string | null> {
  if (isDevAuthBypassServer()) {
    return DEV_BYPASS_USER_ID
  }
  const { auth } = await import('@clerk/nextjs/server')
  const { userId } = await auth()
  return userId ?? null
}
