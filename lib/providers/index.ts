// ─────────────────────────────────────────────
// TutorKanvas — LLM Provider Factory & Interface
// ─────────────────────────────────────────────

import type { ProviderConfig, Message, ChatOptions, AICanvasResponse, ModelOption, ProviderID } from '@/types'
import { createOpenRouterProvider, OPENROUTER_MODELS } from './openrouter'
import { createOpenAIProvider, OPENAI_MODELS } from './openai'
import { createAnthropicProvider, ANTHROPIC_MODELS } from './anthropic'
import { createGoogleProvider, GOOGLE_MODELS } from './google'
import { createOllamaProvider, OLLAMA_MODELS } from './ollama'

// ── Provider Interface ────────────────────────

export interface LLMProvider {
  id: ProviderID
  name: string
  chat(messages: Message[], options?: ChatOptions): Promise<string>
  vision(imageBase64: string, prompt: string, options?: ChatOptions): Promise<AICanvasResponse>
  stream(messages: Message[], options?: ChatOptions): AsyncIterable<string>
}

// ── Factory ───────────────────────────────────

export function getProvider(config: ProviderConfig): LLMProvider {
  switch (config.id) {
    case 'openrouter':
      return createOpenRouterProvider(config.apiKey, config.model)
    case 'openai':
      return createOpenAIProvider(config.apiKey, config.model)
    case 'anthropic':
      return createAnthropicProvider(config.apiKey, config.model)
    case 'google':
      return createGoogleProvider(config.apiKey, config.model)
    case 'ollama':
      return createOllamaProvider(config.baseUrl ?? 'http://localhost:11434', config.model)
    default:
      throw new Error(`Unknown provider: ${(config as ProviderConfig).id}`)
  }
}

// ── Provider Metadata ─────────────────────────

export interface ProviderMeta {
  id: ProviderID
  name: string
  description: string
  keyLabel: string
  keyPlaceholder: string
  keyHelpUrl: string
  models: ModelOption[]
  recommended?: boolean
  advanced?: boolean
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access 100s of AI models with one key. Free tier available.',
    keyLabel: 'OpenRouter API Key',
    keyPlaceholder: 'sk-or-v1-...',
    keyHelpUrl: 'https://openrouter.ai/keys',
    models: OPENROUTER_MODELS,
    recommended: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o — powerful vision and reasoning.',
    keyLabel: 'OpenAI API Key',
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    models: OPENAI_MODELS,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude — excellent at step-by-step explanations.',
    keyLabel: 'Anthropic API Key',
    keyPlaceholder: 'sk-ant-...',
    keyHelpUrl: 'https://console.anthropic.com/keys',
    models: ANTHROPIC_MODELS,
  },
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini — fast, multimodal, and affordable.',
    keyLabel: 'Google AI API Key',
    keyPlaceholder: 'AIza...',
    keyHelpUrl: 'https://aistudio.google.com/app/apikey',
    models: GOOGLE_MODELS,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Run AI completely offline on your own machine.',
    keyLabel: 'Ollama Server URL',
    keyPlaceholder: 'http://localhost:11434',
    keyHelpUrl: 'https://ollama.com',
    models: OLLAMA_MODELS,
    advanced: true,
  },
]

export function getProviderMeta(id: ProviderID): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]!
}

export function getDefaultModel(id: ProviderID): string {
  const meta = getProviderMeta(id)
  return meta.models.find((m) => m.recommended)?.id ?? meta.models[0]?.id ?? ''
}
