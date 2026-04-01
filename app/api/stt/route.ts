// ─────────────────────────────────────────────
// TutorKanvas — API Route: /api/stt
// Audio → Deepgram transcript.
// Returns 204 if no key — client uses Web Speech API fallback.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const deepgramKey = authHeader.replace('Token ', '').trim()

    if (!deepgramKey) {
      return new NextResponse(null, { status: 204 })
    }

    const audioBlob = await req.blob()
    if (!audioBlob.size) {
      return NextResponse.json({ error: 'No audio provided.' }, { status: 400 })
    }

    const dgRes = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=en',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${deepgramKey}`,
          'Content-Type': audioBlob.type || 'audio/webm',
        },
        body: audioBlob,
      }
    )

    if (!dgRes.ok) {
      return new NextResponse(null, { status: 204 })
    }

    const data = await dgRes.json()
    const transcript =
      data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''

    return NextResponse.json({ transcript })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
