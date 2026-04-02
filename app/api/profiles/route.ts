import { NextResponse } from 'next/server'
import type { LearnerProfile } from '@/types'
import { isDatabaseConfigured } from '@/lib/server/database'
import { createProfileRecord, listProfiles } from '@/lib/server/profiles-store'
import { getServerAuthUserId } from '@/lib/dev-auth.server'

export async function GET() {
  const effectiveUserId = await getServerAuthUserId()
  if (!effectiveUserId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const profiles = await listProfiles(effectiveUserId)
  return NextResponse.json(profiles)
}

export async function POST(req: Request) {
  const effectiveUserId = await getServerAuthUserId()
  if (!effectiveUserId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const profile = (await req.json()) as LearnerProfile
  if (!profile?.id || !profile?.name) {
    return NextResponse.json({ error: 'Invalid profile.' }, { status: 400 })
  }

  const saved = await createProfileRecord({ ...profile, userId: effectiveUserId })
  return NextResponse.json(saved, { status: 201 })
}
