import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { isDevAuthBypassServer } from '@/lib/dev-auth.server'

const isProtectedRoute = createRouteMatcher([
  '/canvas(.*)',
  '/setup(.*)',
])

// When the dev-auth bypass is active we skip clerkMiddleware entirely so
// Clerk never makes outbound JWKS/session network calls, eliminating the
// ~800ms middleware latency that was causing RSC stream chunk races.
const bypassMiddleware = (_req: NextRequest) => NextResponse.next()

const clerkProtectedMiddleware = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export default isDevAuthBypassServer()
  ? bypassMiddleware
  : clerkProtectedMiddleware

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
