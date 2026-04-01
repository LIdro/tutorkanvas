// ─────────────────────────────────────────────
// TutorKanvas — LLM Provider: Anthropic
// Note: Anthropic uses a different image format.
// ─────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider } from './index'
import type { Message, ChatOptions, AICanvasResponse } from '@/types'
import { parseAIResponse } from '@/lib/canvas-actions'
import { extractBase64Data, getMimeType } from '@/lib/utils'

export function createAnthropicProvider(apiKey: string, model: string): LLMProvider {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  function toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : String(m.content),
      }))
  }

  function getSystemPrompt(messages: Message[]): string {
    return messages.find((m) => m.role === 'system')?.content as string ?? ''
  }

  return {
    id: 'anthropic',
    name: 'Anthropic',

    async chat(messages: Message[], options: ChatOptions = {}): Promise<string> {
      const res = await client.messages.create({
        model,
        system: getSystemPrompt(messages),
        messages: toAnthropicMessages(messages),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
      })
      const block = res.content[0]
      return block?.type === 'text' ? block.text : ''
    },

    async vision(imageBase64: string, prompt: string, options: ChatOptions = {}): Promise<AICanvasResponse> {
      const mimeType = getMimeType(imageBase64) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      const data = extractBase64Data(imageBase64)

      const res = await client.messages.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mimeType, data },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
        temperature: options.temperature ?? 0.5,
        max_tokens: options.maxTokens ?? 3000,
      })
      const block = res.content[0]
      const raw = block?.type === 'text' ? block.text : ''
      return parseAIResponse(raw)
    },

    async *stream(messages: Message[], options: ChatOptions = {}): AsyncIterable<string> {
      const stream = client.messages.stream({
        model,
        system: getSystemPrompt(messages),
        messages: toAnthropicMessages(messages),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
      })
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text
        }
      }
    },
  }
}

export const ANTHROPIC_MODELS = [
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', supportsVision: true, recommended: true },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast)', supportsVision: true },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', supportsVision: true },
]
