// ─────────────────────────────────────────────
// TutorKanvas — API Route: /api/tts
// Text → Deepgram Aura audio stream.
// Returns 204 (no content) if no Deepgram key — client falls back to Web Speech.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, voice } = body as { text: string; voice?: string }

    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided.' }, { status: 400 })
    }

    // Key from Authorization header (client sends it directly — never logged here)
    const authHeader = req.headers.get('Authorization') ?? ''
    const deepgramKey = authHeader.replace('Token ', '').trim()

    if (!deepgramKey) {
      // Signal to client: use browser TTS fallback
      return new NextResponse(null, { status: 204 })
    }

    const selectedVoice = voice ?? 'aura-asteria-en'
    const deepgramUrl = `https://api.deepgram.com/v1/speak?model=${selectedVoice}`

    const dgRes = await fetch(deepgramUrl, {
      method: 'POST',
      headers: {
        Authorization: `Token ${deepgramKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!dgRes.ok) {
      return new NextResponse(null, { status: 204 }) // fallback gracefully
    }

    // Stream audio back to client
    return new Response(dgRes.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new NextResponse(null, { status: 204 }) // always fallback, never error to child
  }
}
