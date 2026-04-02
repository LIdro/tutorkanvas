import { NextResponse } from 'next/server'
import type { TKSession } from '@/types'
import { isDatabaseConfigured } from '@/lib/server/database'
import { deleteSessionRecord, getSessionById, updateSessionRecord } from '@/lib/server/sessions-store'
import { getServerAuthUserId } from '@/lib/dev-auth.server'

type Context = {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Context) {
  const effectiveUserId = await getServerAuthUserId()
  if (!effectiveUserId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const { id } = await params
  const session = await getSessionById(effectiveUserId, id)
  return session
    ? NextResponse.json(session)
    : NextResponse.json({ error: 'Not found.' }, { status: 404 })
}

export async function PATCH(req: Request, { params }: Context) {
  const effectiveUserId = await getServerAuthUserId()
  if (!effectiveUserId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const { id } = await params
  const updates = (await req.json()) as Partial<TKSession>
  const updated = await updateSessionRecord(effectiveUserId, id, updates)
  return updated
    ? NextResponse.json(updated)
    : NextResponse.json({ error: 'Not found.' }, { status: 404 })
}

export async function DELETE(_req: Request, { params }: Context) {
  const effectiveUserId = await getServerAuthUserId()
  if (!effectiveUserId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const { id } = await params
  await deleteSessionRecord(effectiveUserId, id)
  return new NextResponse(null, { status: 204 })
}
