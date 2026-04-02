import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-4 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <SignUp />
    </main>
  )
}
