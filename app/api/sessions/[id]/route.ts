import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import type { TKSession } from '@/types'
import { isDatabaseConfigured } from '@/lib/server/database'
import { deleteSessionRecord, getSessionById, updateSessionRecord } from '@/lib/server/sessions-store'

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
  const session = await getSessionById(userId, id)
  return session
    ? NextResponse.json(session)
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
  const updates = (await req.json()) as Partial<TKSession>
  const updated = await updateSessionRecord(userId, id, updates)
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
  await deleteSessionRecord(userId, id)
  return new NextResponse(null, { status: 204 })
}
