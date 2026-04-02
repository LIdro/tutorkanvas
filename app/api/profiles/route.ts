import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import type { LearnerProfile } from '@/types'
import { isDatabaseConfigured } from '@/lib/server/database'
import { createProfileRecord, listProfiles } from '@/lib/server/profiles-store'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const profiles = await listProfiles(userId)
  return NextResponse.json(profiles)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const profile = (await req.json()) as LearnerProfile
  if (!profile?.id || !profile?.name) {
    return NextResponse.json({ error: 'Invalid profile.' }, { status: 400 })
  }

  const saved = await createProfileRecord({ ...profile, userId })
  return NextResponse.json(saved, { status: 201 })
}
