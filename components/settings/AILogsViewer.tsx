'use client'
// ─────────────────────────────────────────────
// TutorKanvas — AI Logs Viewer
//
// PIN-gated component (shown inside SettingsPanel).
// Displays a searchable, filterable list of every AI interaction.
// Click an entry to see the full detail: system prompt, user input,
// raw response, parsed artifacts, latency and errors.
// Use the copy buttons to grab one entry or the full session log.
// ─────────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, Download, Trash2, RefreshCw, AlertCircle, CheckCircle, Image, Brain, BookOpen, Copy, CopyCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLogs, getLog, clearLogs, exportLogsAsJSON } from '@/lib/ai-logger'
import type { AIInteractionLog, AIInteractionSummary, AIResponseMode } from '@/types'

// ── Helpers ──────────────────────────────────

/** Returns a human-readable plain-text representation of a full log entry */
function formatEntryAsText(entry: AIInteractionLog): string {
  const lines: string[] = []
  lines.push(`═══════════════════════════════════════`)
  lines.push(`AI Interaction Log — ${entry.id}`)
  lines.push(`Date:     ${entry.createdAt}`)
  lines.push(`Provider: ${entry.provider} / ${entry.model}`)
  lines.push(`Mode:     ${entry.responseMode}`)
  lines.push(`Latency:  ${entry.latencyMs} ms  (~${entry.tokenEstimate} tokens)`)
  if (entry.topic) lines.push(`Topic:    ${entry.topic}`)
  if (entry.hadImage) lines.push(`Image:    yes (not stored)`)
  if (entry.isError) lines.push(`ERROR:    ${entry.errorMessage ?? 'unknown'}`)
  lines.push(``)
  lines.push(`── SYSTEM PROMPT ──────────────────────`)
  lines.push(entry.systemPrompt || '(empty)')
  lines.push(``)
  lines.push(`── USER INPUT ─────────────────────────`)
  for (const m of entry.inputMessages) {
    lines.push(`[${m.role.toUpperCase()}] ${m.content}`)
  }
  lines.push(``)
  lines.push(`── RAW AI RESPONSE ────────────────────`)
  lines.push(entry.rawResponse || '(empty)')
  if (entry.parsedActions && entry.parsedActions.length > 0) {
    lines.push(``)
    lines.push(`── CANVAS ACTIONS (${entry.parsedActions.length}) ──────────────`)
    lines.push(JSON.stringify(entry.parsedActions, null, 2))
  }
  if (entry.parsedLessonScript) {
    lines.push(``)
    lines.push(`── LESSON SCRIPT ──────────────────────`)
    lines.push(`Topic: ${entry.parsedLessonScript.topic}`)
    lines.push(`Scene: ${entry.parsedLessonScript.scene.kind}`)
    for (const [i, step] of entry.parsedLessonScript.steps.entries()) {
      lines.push(``)
      lines.push(`Step ${i + 1} [${step.id}]`)
      lines.push(`  Speech: "${step.speech}"`)
      if (step.actions.length > 0) {
        lines.push(`  Actions: ${JSON.stringify(step.actions, null, 2).split('\n').join('\n  ')}`)
      }
    }
  }
  lines.push(`═══════════════════════════════════════`)
  return lines.join('\n')
}

/** One-shot hook: returns [copied, triggerCopy] */
function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false)
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // Fallback for environments without clipboard API
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])
  return [copied, copy]
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function modeLabel(mode: AIResponseMode): string {
  switch (mode) {
    case 'canvas':       return 'Chat'
    case 'lesson_script': return 'Lesson'
    case 'vision':       return 'Vision'
  }
}

function modeIcon(mode: AIResponseMode) {
  switch (mode) {
    case 'canvas':        return <Brain size={13} className="inline-block mr-1" />
    case 'lesson_script': return <BookOpen size={13} className="inline-block mr-1" />
    case 'vision':        return <Image size={13} className="inline-block mr-1" />
  }
}

function latencyColor(ms: number): string {
  if (ms < 2000) return 'text-green-600 dark:text-green-400'
  if (ms < 5000) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

// ── Sub-component: row-level copy button ────

function CopyEntryButton({ id }: { id: string }) {
  const [copied, copy] = useCopy()
  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    const entry = await getLog(id)
    if (entry) copy(formatEntryAsText(entry))
  }
  return (
    <button
      onClick={(e) => void handleClick(e)}
      title="Copy this entry as plain text"
      className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 transition-colors"
    >
      {copied ? <CopyCheck size={14} className="text-green-500" /> : <Copy size={14} />}
    </button>
  )
}

// ── Sub-component: detail panel ─────────────

function LogDetail({ id }: { id: string }) {
  const [entry, setEntry] = useState<AIInteractionLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, copy] = useCopy()

  useEffect(() => {
    setLoading(true)
    getLog(id).then((e) => {
      setEntry(e)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return <div className="p-4 text-sm text-gray-400 animate-pulse">Loading…</div>
  }
  if (!entry) {
    return <div className="p-4 text-sm text-red-400">Entry not found.</div>
  }

  const stepCount = entry.parsedLessonScript?.steps.length ?? 0
  const actionCount = entry.parsedActions?.length ?? 0

  return (
    <div className="bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-700 p-4 space-y-4 text-sm">

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>🕐 {formatDate(entry.createdAt)}</span>
        <span>⚡ <span className={latencyColor(entry.latencyMs)}>{entry.latencyMs} ms</span></span>
        <span>📝 ~{entry.tokenEstimate} tokens</span>
        <span>🤖 {entry.provider} / {entry.model}</span>
        {entry.topic && <span>📚 {entry.topic}</span>}
        {entry.sessionId && <span className="font-mono text-[10px]">session {entry.sessionId.slice(0, 8)}</span>}
        {/* Copy this entry */}
        <button
          onClick={() => copy(formatEntryAsText(entry))}
          title="Copy this entry as plain text"
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
        >
          {copied ? <CopyCheck size={13} className="text-green-500" /> : <Copy size={13} />}
          <span>{copied ? 'Copied!' : 'Copy entry'}</span>
        </button>
      </div>

      {/* Error badge */}
      {entry.isError && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{entry.errorMessage ?? 'Unknown error'}</span>
        </div>
      )}

      {/* System prompt */}
      <details className="group">
        <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 list-none flex items-center gap-1">
          <ChevronRight size={14} className="group-open:rotate-90 transition-transform" />
          System Prompt
        </summary>
        <pre className="mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap overflow-auto max-h-48">
          {entry.systemPrompt || '(empty)'}
        </pre>
      </details>

      {/* Input messages */}
      <details className="group" open>
        <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 list-none flex items-center gap-1">
          <ChevronRight size={14} className="group-open:rotate-90 transition-transform" />
          User Input {entry.hadImage && <span className="ml-1 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">+ image</span>}
        </summary>
        <div className="mt-2 space-y-2">
          {entry.inputMessages.map((m, i) => (
            <div key={i} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-[10px] uppercase font-semibold tracking-wide text-gray-400 dark:text-gray-500 block mb-1">{m.role}</span>
              <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
        </div>
      </details>

      {/* Raw AI response */}
      <details className="group" open>
        <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 list-none flex items-center gap-1">
          <ChevronRight size={14} className="group-open:rotate-90 transition-transform" />
          Raw AI Response
        </summary>
        <pre className="mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap overflow-auto max-h-64">
          {entry.rawResponse || '(empty)'}
        </pre>
      </details>

      {/* Parsed canvas actions */}
      {entry.parsedActions && entry.parsedActions.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 list-none flex items-center gap-1">
            <ChevronRight size={14} className="group-open:rotate-90 transition-transform" />
            Canvas Actions ({actionCount})
          </summary>
          <pre className="mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap overflow-auto max-h-64">
            {JSON.stringify(entry.parsedActions, null, 2)}
          </pre>
        </details>
      )}

      {/* Parsed lesson script */}
      {entry.parsedLessonScript && (
        <details className="group">
          <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 list-none flex items-center gap-1">
            <ChevronRight size={14} className="group-open:rotate-90 transition-transform" />
            Lesson Script — {stepCount} step{stepCount !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 space-y-3">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
              <p className="text-gray-400 dark:text-gray-500 mb-1">Topic: <span className="text-gray-700 dark:text-gray-300">{entry.parsedLessonScript.topic}</span></p>
              <p className="text-gray-400 dark:text-gray-500 mb-1">Scene kind: <span className="text-gray-700 dark:text-gray-300">{entry.parsedLessonScript.scene.kind}</span></p>
              <p className="text-gray-400 dark:text-gray-500">Lesson id: <span className="font-mono text-gray-700 dark:text-gray-300">{entry.parsedLessonScript.lessonId}</span></p>
            </div>
            {entry.parsedLessonScript.steps.map((step, i) => (
              <div key={step.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-xs space-y-1">
                <p className="font-semibold text-gray-700 dark:text-gray-300">Step {i + 1} — <span className="font-mono font-normal text-gray-400">{step.id}</span></p>
                <p className="text-gray-600 dark:text-gray-400 italic">"{step.speech}"</p>
                <p className="text-gray-400 dark:text-gray-500">{step.actions.length} action{step.actions.length !== 1 ? 's' : ''}
                  {step.waitFor && <> · waits for <strong>{step.waitFor}</strong></>}
                </p>
                {step.actions.length > 0 && (
                  <pre className="mt-1 bg-gray-50 dark:bg-gray-900 rounded p-2 overflow-auto max-h-32 text-[11px] text-gray-500 dark:text-gray-400">
                    {JSON.stringify(step.actions, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────

export default function AILogsViewer() {
  const [summaries, setSummaries] = useState<AIInteractionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<AIResponseMode | 'all'>('all')
  const [filterError, setFilterError] = useState<boolean | null>(null)
  const [search, setSearch] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [copiedAll, copyAll] = useCopy()

  const load = useCallback(async () => {
    setLoading(true)
    const logs = await getLogs({
      responseMode: filterMode === 'all' ? undefined : filterMode,
      isError: filterError ?? undefined,
      limit: 200,
    })
    setSummaries(logs)
    setLoading(false)
  }, [filterMode, filterError])

  useEffect(() => { void load() }, [load])

  const filtered = search.trim()
    ? summaries.filter((s) =>
        s.promptPreview.toLowerCase().includes(search.toLowerCase()) ||
        s.responsePreview.toLowerCase().includes(search.toLowerCase()) ||
        (s.topic ?? '').toLowerCase().includes(search.toLowerCase()) ||
        s.model.toLowerCase().includes(search.toLowerCase()),
      )
    : summaries

  async function handleExport() {
    const json = await exportLogsAsJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tutorkanvas-ai-logs-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCopyAll() {
    // Fetch full entries for the currently visible (filtered) summaries
    const full = await Promise.all(filtered.map((s) => getLog(s.id)))
    const text = full
      .filter((e): e is AIInteractionLog => e !== null)
      .map(formatEntryAsText)
      .join('\n\n')
    copyAll(text || '(no logs)')
  }

  async function handleClear() {
    await clearLogs()
    setSummaries([])
    setConfirmClear(false)
    setExpandedId(null)
  }

  return (
    <div className="space-y-4">
      {/* Header / controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search prompts, responses, topics…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <button
          onClick={() => void load()}
          title="Refresh"
          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
        >
          <RefreshCw size={15} />
        </button>
        <button
          onClick={() => void handleExport()}
          title="Export all logs as JSON"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm text-gray-600 dark:text-gray-400"
        >
          <Download size={14} /> Export
        </button>
        <button
          onClick={() => void handleCopyAll()}
          title="Copy visible logs as plain text"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm text-gray-600 dark:text-gray-400"
        >
          {copiedAll ? <CopyCheck size={14} className="text-green-500" /> : <Copy size={14} />}
          {copiedAll ? 'Copied!' : 'Copy all'}
        </button>
        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            title="Clear all logs"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-sm text-red-600 dark:text-red-400"
          >
            <Trash2 size={14} /> Clear
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={handleClear} className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-sm">Yes, clear</button>
            <button onClick={() => setConfirmClear(false)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">Cancel</button>
          </div>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(['all', 'canvas', 'lesson_script', 'vision'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setFilterMode(m)}
            className={cn(
              'px-2.5 py-1 rounded-full border transition-colors',
              filterMode === m
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
            )}
          >
            {m === 'all' ? 'All' : modeLabel(m as AIResponseMode)}
          </button>
        ))}
        <button
          onClick={() => setFilterError(filterError === true ? null : true)}
          className={cn(
            'px-2.5 py-1 rounded-full border transition-colors',
            filterError === true
              ? 'bg-red-600 border-red-600 text-white'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
          )}
        >
          Errors only
        </button>
      </div>

      {/* Stats bar */}
      {!loading && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}
          {filtered.length !== summaries.length && ` (filtered from ${summaries.length})`}
        </p>
      )}

      {/* Log list */}
      {loading ? (
        <div className="text-sm text-gray-400 animate-pulse py-4">Loading logs…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">
          {summaries.length === 0
            ? 'No AI interactions logged yet. Ask the AI a question to see it here.'
            : 'No entries match your filter.'}
        </div>
      ) : (
        <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((s) => (
            <div
              key={s.id}
              className={cn(
                'relative rounded-xl border transition-colors',
                s.isError
                  ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50',
              )}
            >
              {/* Row */}
              <button
                className="w-full text-left px-4 py-3 flex items-start gap-3"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                {/* Mode icon */}
                <span className={cn(
                  'mt-0.5 shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium',
                  s.responseMode === 'vision'        && 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
                  s.responseMode === 'lesson_script' && 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
                  s.responseMode === 'canvas'        && 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
                )}>
                  {modeIcon(s.responseMode)}{modeLabel(s.responseMode)}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate font-medium">
                    {s.promptPreview || <span className="italic text-gray-400">(no prompt)</span>}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                    {s.responsePreview || '(empty response)'}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                    <span>{formatDate(s.createdAt)}</span>
                    <span className={latencyColor(s.latencyMs)}>{s.latencyMs} ms</span>
                    <span>~{s.tokenEstimate} tok</span>
                    {s.topic && <span className="truncate max-w-[100px]">{s.topic}</span>}
                    {s.hadImage && <Image size={11} className="text-blue-400" />}
                    {s.isError
                      ? <AlertCircle size={11} className="text-red-500" />
                      : <CheckCircle size={11} className="text-green-500" />
                    }
                  </div>
                </div>

                {/* Chevron */}
                <span className="mt-1 text-gray-400 dark:text-gray-500 shrink-0">
                  {expandedId === s.id
                    ? <ChevronDown size={16} />
                    : <ChevronRight size={16} />
                  }
                </span>
              </button>

              {/* Copy button sits outside the expand button to avoid double-click conflict */}
              <div className="absolute right-10 top-3">
                <CopyEntryButton id={s.id} />
              </div>

              {/* Expanded detail */}
              {expandedId === s.id && <LogDetail id={s.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
