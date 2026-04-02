'use client'

import Link from 'next/link'
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import { isDevAuthBypassClient } from '@/lib/dev-auth'

export default function AuthActions() {
  const bypassEnabled = isDevAuthBypassClient()

  if (bypassEnabled) {
    return (
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-800">
          Local dev auth bypass
        </span>
        <Link
          href="/setup"
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-500"
        >
          Open app
        </Link>
      </div>
    )
  }

  return (
    <>
      <Show when="signed-out">
        <div className="flex items-center gap-3">
          <SignInButton mode="modal">
            <button className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-500">
              Create account
            </button>
          </SignUpButton>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="flex items-center gap-3">
          <Link
            href="/canvas"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Open app
          </Link>
          <UserButton />
        </div>
      </Show>
    </>
  )
}
