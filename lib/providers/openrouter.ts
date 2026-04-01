// ─────────────────────────────────────────────
// TutorKanvas — LLM Provider: OpenRouter
// Uses the OpenAI SDK with a custom base URL.
// ─────────────────────────────────────────────

import OpenAI from 'openai'
import type { LLMProvider } from './index'
import type { Message, ChatOptions, AICanvasResponse } from '@/types'
import { parseAIResponse } from '@/lib/canvas-actions'

export function createOpenRouterProvider(apiKey: string, model: string): LLMProvider {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://tutorkanvas.com',
      'X-Title': 'TutorKanvas',
    },
    dangerouslyAllowBrowser: true,
  })

  return {
    id: 'openrouter',
    name: 'OpenRouter',

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

export const OPENROUTER_MODELS = [
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', supportsVision: true, recommended: true },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', supportsVision: true },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', supportsVision: true },
  { id: 'openai/gpt-4o', name: 'GPT-4o', supportsVision: true },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Fast)', supportsVision: true },
  { id: 'meta-llama/llama-3.2-11b-vision-instruct:free', name: 'Llama 3.2 Vision (Free)', supportsVision: true },
]
