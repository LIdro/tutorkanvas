import { NextResponse } from 'next/server'
import type { TKSession } from '@/types'
import { isDatabaseConfigured } from '@/lib/server/database'
import { createSessionRecord, listSessions } from '@/lib/server/sessions-store'
import { getServerAuthUserId } from '@/lib/dev-auth.server'

export async function GET(req: Request) {
  const effectiveUserId = await getServerAuthUserId()
  if (!effectiveUserId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const profileId = searchParams.get('profileId') ?? undefined
  const sessions = await listSessions(effectiveUserId, profileId)
  return NextResponse.json(sessions)
}

export async function POST(req: Request) {
  const effectiveUserId = await getServerAuthUserId()
  if (!effectiveUserId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const session = (await req.json()) as TKSession
  if (!session?.id || !session?.profileId) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 400 })
  }

  const saved = await createSessionRecord({ ...session, userId: effectiveUserId })
  return NextResponse.json(saved, { status: 201 })
}
