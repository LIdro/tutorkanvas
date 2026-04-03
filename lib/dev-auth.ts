// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SAFE auth helpers — no server-only imports here.
// Server-side helpers (getServerAuthUserId, isDevAuthBypassServer) live in
// lib/dev-auth.server.ts so the bundler never pulls @clerk/nextjs/server into
// the client bundle.
// ─────────────────────────────────────────────────────────────────────────────

export const DEV_BYPASS_USER_ID = 'dev-local-user'

function hasClientClerkConfig(): boolean {
  return typeof process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === 'string' &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.trim().length > 0
}

export function isDevAuthBypassClient(): boolean {
  return process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true' || !hasClientClerkConfig()
}

export function getEffectiveUserId(userId: string | null | undefined, bypassEnabled: boolean): string | null {
  if (userId) return userId
  return bypassEnabled ? DEV_BYPASS_USER_ID : null
}

/**
 * Safe wrapper around Clerk's `useAuth()` that returns stub values when the
 * dev-auth bypass is active (i.e. ClerkProvider is not in the tree).
 *
 * Rules of hooks: this must be called unconditionally — but internally it
 * delegates to the real hook only when Clerk is present.
 */
export function useAuthSafe(): { isLoaded: boolean; userId: string | null } {
  const bypass = isDevAuthBypassClient()
  if (bypass) {
    return { isLoaded: true, userId: DEV_BYPASS_USER_ID }
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAuth } = require('@clerk/nextjs') as typeof import('@clerk/nextjs')
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const auth = useAuth()
  return { isLoaded: auth.isLoaded, userId: auth.userId ?? null }
}
