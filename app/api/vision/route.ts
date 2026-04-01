// ─────────────────────────────────────────────
// TutorKanvas — API Route: /api/vision
// Image + prompt → AI canvas response.
// Images are NEVER stored — discarded after response.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/providers'
import { buildVisionPrompt } from '@/lib/prompts'
import type { ProviderConfig, LearnerProfile } from '@/types'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageBase64, providerConfig, profile } = body as {
      imageBase64: string
      providerConfig: ProviderConfig
      profile?: LearnerProfile
    }

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 })
    }

    // Validate image
    const mimeMatch = imageBase64.match(/^data:([^;]+);base64,/)
    const mimeType = mimeMatch?.[1] ?? ''
    if (!ALLOWED_MIME.includes(mimeType)) {
      return NextResponse.json({ error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' }, { status: 400 })
    }

    const base64Data = imageBase64.split(',')[1] ?? ''
    const byteSize = Math.ceil(base64Data.length * 0.75)
    if (byteSize > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large. Max 10MB.' }, { status: 400 })
    }

    if (!providerConfig?.apiKey && process.env.NEXT_PUBLIC_SERVER_KEY_MODE !== 'true') {
      return NextResponse.json({ error: 'No API key provided.' }, { status: 401 })
    }

    const config: ProviderConfig = process.env.NEXT_PUBLIC_SERVER_KEY_MODE === 'true'
      ? { ...providerConfig, apiKey: process.env.LLM_API_KEY ?? '' }
      : providerConfig

    const provider = getProvider(config)
    const prompt = buildVisionPrompt(profile ?? null)

    const result = await provider.vision(imageBase64, prompt)

    // Image is NOT stored — only the structured AI response is returned
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Could not analyse image. Please try again.' }, { status: 500 })
  }
}
