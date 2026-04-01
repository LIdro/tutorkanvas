'use client'
// ─────────────────────────────────────────────
// TutorKanvas — SessionPicker
// Slide-in drawer listing saved sessions from
// IndexedDB. Users can resume or delete sessions.
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { X, Trash2, RotateCcw, Clock, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSessions, deleteSession } from '@/lib/session'
import type { TKSession } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  /** Called when the user picks a session to resume */
  onResume: (session: TKSession) => void
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day:   'numeric',
      hour:  '2-digit',
      minute:'2-digit',
    })
  } catch {
    return iso
  }
}

export default function SessionPicker({ open, onClose, onResume }: Props) {
  const [sessions, setSessions] = useState<TKSession[]>([])
  const [loading,  setLoading]  = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getSessions()
      .then(setSessions)
      .finally(() => setLoading(false))
  }, [open])

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setDeleting(id)
    await deleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
    setDeleting(null)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <aside className="relative w-full max-w-sm h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-700 animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-purple-500" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Past sessions</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            aria-label="Close session picker"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
              Loading sessions…
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <div className="text-4xl">📭</div>
              <p className="text-gray-400 dark:text-gray-500 text-sm">No sessions saved yet.</p>
              <p className="text-gray-300 dark:text-gray-600 text-xs">Start drawing to create one!</p>
            </div>
          )}

          {!loading && sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => { onResume(s); onClose() }}
              className="w-full text-left p-3 rounded-2xl border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-all group relative"
            >
              {/* Session name */}
              <p className="font-semibold text-gray-800 dark:text-gray-100 group-hover:text-purple-700 dark:group-hover:text-purple-400 pr-8 truncate">
                {s.name}
              </p>

              {/* Meta row */}
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {formatDate(s.updatedAt)}
                </span>
                {s.messages.length > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare size={11} />
                    {s.messages.length} msg{s.messages.length !== 1 ? 's' : ''}
                  </span>
                )}
                {s.topicsCovered.length > 0 && (
                  <span className="hidden sm:block truncate max-w-[120px]">
                    {s.topicsCovered.slice(0, 2).join(', ')}
                    {s.topicsCovered.length > 2 ? '…' : ''}
                  </span>
                )}
              </div>

              {/* Resume icon */}
              <RotateCcw
                size={14}
                className="absolute right-8 top-1/2 -translate-y-1/2 text-purple-300 group-hover:text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"
              />

              {/* Delete button */}
              <button
                onClick={(e) => handleDelete(e, s.id)}
                disabled={deleting === s.id}
                className={cn(
                  'absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg',
                  'text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40',
                  'transition-colors opacity-0 group-hover:opacity-100',
                  deleting === s.id && 'opacity-50 pointer-events-none'
                )}
                aria-label="Delete session"
              >
                <Trash2 size={13} />
              </button>
            </button>
          ))}
        </div>

        {/* Footer */}
        {sessions.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} stored locally
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}
