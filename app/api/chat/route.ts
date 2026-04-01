// ─────────────────────────────────────────────
// TutorKanvas — API Route: /api/chat
// Sanitizing proxy for text chat.
// Keys are sent in Authorization header from client.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/providers'
import { buildSystemPrompt } from '@/lib/prompts'
import type { ProviderConfig, Message, LearnerProfile } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, providerConfig, profile } = body as {
      messages: Message[]
      providerConfig: ProviderConfig
      profile?: LearnerProfile
    }

    if (!providerConfig?.apiKey && process.env.NEXT_PUBLIC_SERVER_KEY_MODE !== 'true') {
      return NextResponse.json({ error: 'No API key provided.' }, { status: 401 })
    }

    // In server-key mode, override with env key
    const config: ProviderConfig = process.env.NEXT_PUBLIC_SERVER_KEY_MODE === 'true'
      ? { ...providerConfig, apiKey: process.env.LLM_API_KEY ?? '' }
      : providerConfig

    const provider = getProvider(config)
    const systemPrompt = buildSystemPrompt(profile ?? null)
    const fullMessages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ]

    // Stream response back as text/event-stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of provider.stream(fullMessages)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
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
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
