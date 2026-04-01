// ─────────────────────────────────────────────
// TutorKanvas — LLM Provider: Ollama (local)
// Advanced option for privacy-conscious users.
// ─────────────────────────────────────────────

import type { LLMProvider } from './index'
import type { Message, ChatOptions, AICanvasResponse } from '@/types'
import { parseAIResponse } from '@/lib/canvas-actions'
import { extractBase64Data } from '@/lib/utils'

export function createOllamaProvider(baseUrl: string, model: string): LLMProvider {
  const url = baseUrl.replace(/\/$/, '') // strip trailing slash

  return {
    id: 'ollama',
    name: 'Ollama (Local)',

    async chat(messages: Message[], options: ChatOptions = {}): Promise<string> {
      const res = await fetch(`${url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          })),
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens ?? 2048,
          },
          stream: false,
        }),
      })
      if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`)
      const data = await res.json()
      return data?.message?.content ?? ''
    },

    async vision(imageBase64: string, prompt: string, options: ChatOptions = {}): Promise<AICanvasResponse> {
      const imageData = extractBase64Data(imageBase64)
      const res = await fetch(`${url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
              images: [imageData],
            },
          ],
          options: {
            temperature: options.temperature ?? 0.5,
            num_predict: options.maxTokens ?? 3000,
          },
          stream: false,
        }),
      })
      if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`)
      const data = await res.json()
      return parseAIResponse(data?.message?.content ?? '')
    },

    async *stream(messages: Message[], options: ChatOptions = {}): AsyncIterable<string> {
      const res = await fetch(`${url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          })),
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens ?? 2048,
          },
          stream: true,
        }),
      })
      if (!res.ok || !res.body) throw new Error(`Ollama error: ${res.statusText}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const obj = JSON.parse(line)
            const delta = obj?.message?.content
            if (delta) yield delta
          } catch {
            // skip malformed lines
          }
        }
      }
    },
  }
}

export const OLLAMA_MODELS = [
  { id: 'llava', name: 'LLaVA (Vision)', supportsVision: true, recommended: true },
  { id: 'llava:13b', name: 'LLaVA 13B (Vision)', supportsVision: true },
  { id: 'llama3.2-vision', name: 'Llama 3.2 Vision', supportsVision: true },
  { id: 'mistral', name: 'Mistral (Text only)', supportsVision: false },
]
