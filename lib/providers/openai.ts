// ─────────────────────────────────────────────
// TutorKanvas — LLM Provider: OpenAI
// ─────────────────────────────────────────────

import OpenAI from 'openai'
import type { LLMProvider } from './index'
import type { Message, ChatOptions, AICanvasResponse } from '@/types'
import { parseAIResponse } from '@/lib/canvas-actions'

export function createOpenAIProvider(apiKey: string, model: string): LLMProvider {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })

  return {
    id: 'openai',
    name: 'OpenAI',

    async chat(messages: Message[], options: ChatOptions = {}): Promise<string> {
      const res = await client.chat.completions.create({
        model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
      })
      return res.choices[0]?.message?.content ?? ''
    },

    async vision(imageBase64: string, prompt: string, options: ChatOptions = {}): Promise<AICanvasResponse> {
      const res = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageBase64 } },
            ],
          },
        ],
        temperature: options.temperature ?? 0.5,
        max_tokens: options.maxTokens ?? 3000,
      })
      const raw = res.choices[0]?.message?.content ?? ''
      return parseAIResponse(raw)
    },

    async *stream(messages: Message[], options: ChatOptions = {}): AsyncIterable<string> {
      const stream = await client.chat.completions.create({
        model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream: true,
      })
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content
        if (delta) yield delta
      }
    },
  }
}

export const OPENAI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', supportsVision: true, recommended: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast)', supportsVision: true },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', supportsVision: true },
]
