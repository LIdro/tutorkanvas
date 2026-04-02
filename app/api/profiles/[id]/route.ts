import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import type { LearnerProfile } from '@/types'
import { isDatabaseConfigured } from '@/lib/server/database'
import { deleteProfileRecord, getProfileById, updateProfileRecord } from '@/lib/server/profiles-store'

type Context = {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Context) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const { id } = await params
  const profile = await getProfileById(userId, id)
  return profile
    ? NextResponse.json(profile)
    : NextResponse.json({ error: 'Not found.' }, { status: 404 })
}

export async function PATCH(req: Request, { params }: Context) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const { id } = await params
  const updates = (await req.json()) as Partial<LearnerProfile>
  const updated = await updateProfileRecord(userId, id, updates)
  return updated
    ? NextResponse.json(updated)
    : NextResponse.json({ error: 'Not found.' }, { status: 404 })
}

export async function DELETE(_req: Request, { params }: Context) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const { id } = await params
  await deleteProfileRecord(userId, id)
  return new NextResponse(null, { status: 204 })
}
