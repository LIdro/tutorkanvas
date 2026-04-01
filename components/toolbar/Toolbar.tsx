'use client'
// ─────────────────────────────────────────────
// TutorKanvas — Top Toolbar
// Canvas tool passthrough + session/settings controls.
// ─────────────────────────────────────────────

import { Settings, FilePlus, Download, Trash2, History } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  onNewSession: () => void
  onExportPng: () => void
  onClearCanvas: () => void
  onOpenSettings: () => void
  onOpenSessions: () => void
  sessionName?: string
  hasChanges?: boolean
}

export default function Toolbar({
  onNewSession,
  onExportPng,
  onClearCanvas,
  onOpenSettings,
  onOpenSessions,
  sessionName,
  hasChanges,
}: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-20 h-14 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-3">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-2xl">📐</span>
        <span className="font-bold text-purple-700 dark:text-purple-400 text-base hidden sm:block">TutorKanvas</span>
      </div>

      {/* Session name */}
      {sessionName && (
        <p className={cn(
          'text-sm text-gray-500 dark:text-gray-400 truncate max-w-[160px] sm:max-w-xs',
          hasChanges && 'italic'
        )}>
          {sessionName}{hasChanges ? ' *' : ''}
        </p>
      )}

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <ToolbarBtn title="Session history" onClick={onOpenSessions}>
          <History size={18} />
        </ToolbarBtn>
        <ToolbarBtn title="New session" onClick={onNewSession}>
          <FilePlus size={18} />
        </ToolbarBtn>
        <ToolbarBtn title="Export as PNG" onClick={onExportPng}>
          <Download size={18} />
        </ToolbarBtn>
        <ToolbarBtn title="Clear canvas" onClick={onClearCanvas} danger>
          <Trash2 size={18} />
        </ToolbarBtn>
        <ToolbarBtn title="Settings" onClick={onOpenSettings}>
          <Settings size={18} />
        </ToolbarBtn>
      </div>
    </header>
  )
}

function ToolbarBtn({ children, title, onClick, danger }: {
  children: React.ReactNode
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'p-2 rounded-xl transition-colors',
        danger
          ? 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
          : 'text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40'
      )}
    >
      {children}
    </button>
  )
}
