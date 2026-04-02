// ─────────────────────────────────────────────
// TutorKanvas — API Route: /api/chat
// Sanitizing proxy for text chat.
// Keys are sent in Authorization header from client.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/providers'
import { buildLessonPlannerPrompt, buildSystemPrompt } from '@/lib/prompts'
import type { ProviderConfig, Message, LearnerProfile } from '@/types'
import { getServerAuthUserId } from '@/lib/dev-auth.server'

export async function POST(req: NextRequest) {
  try {
    const effectiveUserId = await getServerAuthUserId()
    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await req.json()
    const { messages, providerConfig, profile, responseMode } = body as {
      messages: Message[]
      providerConfig: ProviderConfig
      profile?: LearnerProfile
      responseMode?: 'canvas' | 'lesson_script'
    }

    if (!providerConfig?.apiKey && process.env.NEXT_PUBLIC_SERVER_KEY_MODE !== 'true') {
      return NextResponse.json({ error: 'No API key provided.' }, { status: 401 })
    }

    // In server-key mode, override with env key
    const config: ProviderConfig = process.env.NEXT_PUBLIC_SERVER_KEY_MODE === 'true'
      ? { ...providerConfig, apiKey: process.env.LLM_API_KEY ?? '' }
      : providerConfig

    const provider = getProvider(config)
    const systemPrompt = responseMode === 'lesson_script'
      ? buildLessonPlannerPrompt(profile ?? null)
      : buildSystemPrompt(profile ?? null)
    const fullMessages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ]

    // Return a single SSE payload using the provider's non-streaming chat path.
    // This is more reliable across providers/models than token streaming.
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const text = await provider.chat(fullMessages)
          if (!text.trim()) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI returned an empty response.' })}\n\n`))
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: text })}\n\n`))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          console.error('[api/chat] Provider chat failed:', err)
          const msg = err instanceof Error ? err.message : 'AI error'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[api/chat] Invalid request:', err)
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
