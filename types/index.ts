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

// ── Lesson Script / Demonstration Runtime ─────

export type LessonSceneKind =
  | 'vertical-subtraction'
  | 'vertical-addition'
  | 'long-division'
  | 'fractions'

export type LessonPlacement =
  | 'center'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'

export interface LessonNode {
  id: string
  role: string
  shapeId?: string
  x: number
  y: number
  width: number
  height: number
  value?: string
  meta?: Record<string, string | number | boolean | null>
}

export interface LessonScene {
  id: string
  kind: LessonSceneKind
  nodes: Record<string, LessonNode>
}

export type DemonstrationAction =
  | { type: 'place_problem'; problem: string; operation?: 'addition' | 'subtraction' | 'multiplication' | 'division' }
  | { type: 'highlight_symbol'; target: string; style?: 'circle' | 'glow'; color?: string }
  | { type: 'focus_column'; column: 'ones' | 'tens' | 'hundreds' | 'thousands'; zoom?: number }
  | { type: 'cross_out'; target: string }
  | { type: 'write_annotation'; target: string; text: string; placement?: LessonPlacement; color?: string }
  | { type: 'borrow_from_column'; from: 'tens' | 'hundreds' | 'thousands'; to: 'ones' | 'tens' | 'hundreds' }
  | { type: 'carry_to_column'; from: 'ones' | 'tens' | 'hundreds'; to: 'tens' | 'hundreds' | 'thousands'; value?: string }
  | { type: 'reveal_result'; target: string; text: string }
  | { type: 'ask_check_question'; prompt: string }
  | { type: 'pause'; durationMs: number }

export interface LessonStep {
  id: string
  speech: string
  teacherNote?: string
  actions: DemonstrationAction[]
  focusTargets?: string[]
  waitFor?: 'speech_end' | 'actions_end' | 'user'
}

export interface LessonScript {
  lessonId: string
  topic: string
  scene: LessonScene
  steps: LessonStep[]
}

// ── Canvas Engine / Persistence ──────────────

export type CanvasEngineKind = 'tldraw' | 'excalidraw'

export interface CanvasRuntimeMetadata {
  semanticNodeId?: string
  runtimeRole?: string
  transient?: boolean
  programmaticSource?: 'lesson' | 'chalk' | 'ai' | 'system'
  tags?: string[]
}

export interface CanvasSnapshotEnvelope {
  version: 1
  engine: CanvasEngineKind
  scene: unknown
  files?: Record<string, unknown> | null
  session?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  legacy?: {
    sourceEngine: CanvasEngineKind
    originalSnapshot: unknown
  } | null
}

// ── Learner Profile ───────────────────────────

export type ExplanationStyle = 'visual' | 'step-by-step' | 'story' | 'auto'

export interface LearnerProfile {
  id: string
  userId: string
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
  userId: string
  profileId: string
  name: string
  createdAt: string
  updatedAt: string
  canvasState: CanvasSnapshotEnvelope | unknown
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
  excalidrawCanvas: boolean
}

// ── AI Interaction Logging ────────────────────

export type AIResponseMode = 'canvas' | 'lesson_script' | 'vision'

export interface AIInteractionLog {
  /** Unique log entry id */
  id: string
  /** Wall-clock timestamp (ISO 8601) */
  createdAt: string
  /** Session the interaction belonged to */
  sessionId: string | null
  /** Learner profile active at the time */
  profileId: string | null
  /** Provider id e.g. 'openrouter' */
  provider: string
  /** Model string e.g. 'gpt-4o' */
  model: string
  /** Whether this was a chat, lesson_script, or vision call */
  responseMode: AIResponseMode
  /** The full system prompt sent to the model */
  systemPrompt: string
  /** User-facing messages array (without the system prompt entry) */
  inputMessages: Array<{ role: string; content: string }>
  /** Raw text response returned by the model */
  rawResponse: string
  /** Parsed canvas actions (for canvas/vision modes) */
  parsedActions: CanvasAction[] | null
  /** Parsed lesson script (for lesson_script mode) */
  parsedLessonScript: LessonScript | null
  /** Topic detected in the AI response */
  topic: string | null
  /** Round-trip latency in milliseconds */
  latencyMs: number
  /** Rough token estimate (chars / 4) */
  tokenEstimate: number
  /** Whether the call resulted in an error */
  isError: boolean
  /** Error message if isError is true */
  errorMessage: string | null
  /** Whether a vision image was attached (image data is never stored) */
  hadImage: boolean
}

/** Lightweight summary used in the list view — no large text fields */
export interface AIInteractionSummary {
  id: string
  createdAt: string
  sessionId: string | null
  profileId: string | null
  provider: string
  model: string
  responseMode: AIResponseMode
  topic: string | null
  latencyMs: number
  tokenEstimate: number
  isError: boolean
  hadImage: boolean
  /** First 120 chars of the user prompt */
  promptPreview: string
  /** First 120 chars of the raw response */
  responsePreview: string
}

// ── App Settings (stored in localStorage) ────

export interface AppSettings {
  providerConfig: ProviderConfig | null
  deepgramKey: string | null
  deepgramVoice: string
  parentPinHash: string | null
  activeProfileId: string | null
  voiceEnabled: boolean
  narrationRate: number
  explanationStepPauseMs: number
  hasCompletedSetup: boolean
}
