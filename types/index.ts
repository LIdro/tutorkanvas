// ─────────────────────────────────────────────
// TutorKanvas — Shared Type Definitions
// ─────────────────────────────────────────────

// ── LLM Providers ────────────────────────────

export type ProviderID =
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'ollama'

export interface ProviderConfig {
  id: ProviderID
  name: string
  baseUrl?: string          // for Ollama custom endpoint
  apiKey: string
  model: string
}

export interface ModelOption {
  id: string
  name: string
  supportsVision: boolean
  recommended?: boolean
}

// ── Messages ─────────────────────────────────

export type MessageRole = 'system' | 'user' | 'assistant'

export interface Message {
  role: MessageRole
  content: string | MessageContent[]
}

export interface MessageContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

// ── Canvas Actions ────────────────────────────

export type TextStyle = {
  fontSize?: 'sm' | 'md' | 'lg' | 'xl'
  color?: string
  bold?: boolean
}

export type ShapeType = 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'numberLine'

export interface ShapeProps {
  width?: number
  height?: number
  color?: string
  label?: string
}

export interface CardContent {
  title?: string
  body: string
  type: 'explanation' | 'hint' | 'summary' | 'error'
}

export type GameType = 'fill-in-blank' | 'multiple-choice' | 'timed-math'

export interface GameConfig {
  type: GameType
  question: string
  answer: string | number
  options?: Array<{ id: string; text: string } | string>  // for multiple-choice
  hint?: string               // optional hint shown after wrong answers
  timeLimit?: number          // seconds, for timed-math
  topic: string
  difficulty: 1 | 2 | 3
}

export type CanvasAction =
  | { type: 'add_text'; x: number; y: number; content: string; style?: TextStyle }
  | { type: 'add_shape'; shape: ShapeType; x: number; y: number; props: ShapeProps }
  | { type: 'add_card'; x: number; y: number; content: CardContent }
  | { type: 'add_game'; x: number; y: number; game: GameConfig }
  | { type: 'speak'; text: string }
  | { type: 'suggest_game'; game: GameConfig }

export interface AICanvasResponse {
  message: string                 // plain text for TTS / display
  actions: CanvasAction[]        // what to render on canvas
  topic?: string                  // detected topic e.g. "long division"
  suggestGame?: boolean
  gameConfig?: GameConfig
}

// ── Learner Profile ───────────────────────────

export type ExplanationStyle = 'visual' | 'step-by-step' | 'story' | 'auto'

export interface LearnerProfile {
  id: string
  name: string
  age?: number
  grade?: string
  avatar?: string               // emoji avatar
  topicsAttempted: Record<string, number>
  topicStars: Record<string, number>     // topic → best star rating
  commonErrors: string[]
  preferredStyle: ExplanationStyle
  sessionCount: number
  lastActive: string            // ISO date string
  totalStars: number
  aiNotes: string[]             // AI-generated observations (last 10)
}

// ── Session ───────────────────────────────────

export interface TKSession {
  id: string
  profileId: string
  name: string
  createdAt: string
  updatedAt: string
  canvasState: unknown          // tldraw snapshot
  messages: Message[]           // conversation history
  topicsCovered: string[]
}

// ── Feature Flags ─────────────────────────────

export interface FeatureFlags {
  aiTutor: boolean
  visionAnalysis: boolean
  voiceInputBrowser: boolean
  voiceOutputBrowser: boolean
  voiceInputDeepgram: boolean
  voiceOutputDeepgram: boolean
  aiCanvasWrite: boolean
  aiGames: boolean
  serverKeyMode: boolean
}

// ── App Settings (stored in localStorage) ────

export interface AppSettings {
  providerConfig: ProviderConfig | null
  deepgramKey: string | null
  deepgramVoice: string
  parentPinHash: string | null
  activeProfileId: string | null
  voiceEnabled: boolean
  hasCompletedSetup: boolean
}
