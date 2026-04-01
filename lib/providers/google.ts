// ─────────────────────────────────────────────
// TutorKanvas — LLM Provider: Google AI
// ─────────────────────────────────────────────

import {
  GoogleGenerativeAI,
  type Content,
  type Part,
} from '@google/generative-ai'
import type { LLMProvider } from './index'
import type { Message, ChatOptions, AICanvasResponse } from '@/types'
import { parseAIResponse } from '@/lib/canvas-actions'
import { extractBase64Data, getMimeType } from '@/lib/utils'

export function createGoogleProvider(apiKey: string, model: string): LLMProvider {
  const genAI = new GoogleGenerativeAI(apiKey)

  function toGoogleContents(messages: Message[]): Content[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
      }))
  }

  return {
    id: 'google',
    name: 'Google AI',

    async chat(messages: Message[], options: ChatOptions = {}): Promise<string> {
      const genModel = genAI.getGenerativeModel({
        model,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
      })
      const systemMsg = messages.find((m) => m.role === 'system')
      const history = toGoogleContents(messages.slice(0, -1))
      const lastMsg = messages[messages.length - 1]
      const chat = genModel.startChat({
        history,
        systemInstruction: systemMsg?.content as string,
      })
      const result = await chat.sendMessage(lastMsg?.content as string ?? '')
      return result.response.text()
    },

    async vision(imageBase64: string, prompt: string, options: ChatOptions = {}): Promise<AICanvasResponse> {
      const genModel = genAI.getGenerativeModel({
        model,
        generationConfig: {
          temperature: options.temperature ?? 0.5,
          maxOutputTokens: options.maxTokens ?? 3000,
        },
      })
      const mimeType = getMimeType(imageBase64)
      const data = extractBase64Data(imageBase64)
      const parts: Part[] = [
        { text: prompt },
        { inlineData: { mimeType, data } },
      ]
      const result = await genModel.generateContent(parts)
      const raw = result.response.text()
      return parseAIResponse(raw)
    },

    async *stream(messages: Message[], options: ChatOptions = {}): AsyncIterable<string> {
      const genModel = genAI.getGenerativeModel({
        model,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
      })
      const systemMsg = messages.find((m) => m.role === 'system')
      const history = toGoogleContents(messages.slice(0, -1))
      const lastMsg = messages[messages.length - 1]
      const chat = genModel.startChat({
        history,
        systemInstruction: systemMsg?.content as string,
      })
      const result = await chat.sendMessageStream(lastMsg?.content as string ?? '')
      for await (const chunk of result.stream) {
        yield chunk.text()
      }
    },
  }
}

export const GOOGLE_MODELS = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', supportsVision: true, recommended: true },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', supportsVision: true },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', supportsVision: true },
]
