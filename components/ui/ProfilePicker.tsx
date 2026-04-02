'use client'
// ─────────────────────────────────────────────
// TutorKanvas — ProfilePicker
// "Who's learning today?" modal.
// ─────────────────────────────────────────────

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLearnerProfile } from '@/hooks/useLearnerProfile'

const AGE_RANGE_OPTIONS = [
  { id: '5-7', label: 'Ages 5-7', age: 6, style: 'step-by-step' as const },
  { id: '8-10', label: 'Ages 8-10', age: 9, style: 'visual' as const },
  { id: '11-13', label: 'Ages 11-13', age: 12, style: 'auto' as const },
  { id: '14-18', label: 'Ages 14-18', age: 16, style: 'auto' as const },
]

const AVATAR_COLOURS = [
  'bg-purple-400', 'bg-blue-400', 'bg-green-400',
  'bg-pink-400',   'bg-orange-400',
]

interface Props {
  open: boolean
  onClose: () => void
  /** Called when a profile is selected OR when "Just me" guest is chosen */
  onSelect: (profileId: string | null) => void
}

export default function ProfilePicker({ open, onClose, onSelect }: Props) {
  const { profiles, addProfile } = useLearnerProfile()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAge, setNewAge] = useState('')
  const [newAgeRange, setNewAgeRange] = useState('5-7')

  async function handleAdd() {
    if (!newName.trim()) return
    const selectedRange = AGE_RANGE_OPTIONS.find((option) => option.id === newAgeRange) ?? AGE_RANGE_OPTIONS[0]
    const profile = await addProfile(
      newName.trim(),
      newAge ? parseInt(newAge) : selectedRange.age,
      undefined,
      selectedRange.style
    )
    setNewName(''); setNewAge(''); setNewAgeRange('5-7'); setAdding(false)
    onSelect(profile.id)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-transparent dark:border-gray-700">
        {/* Header */}
        <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-6 text-white text-center">
          <div className="text-5xl mb-2">👋</div>
          <h2 className="text-2xl font-bold">Who's learning today?</h2>
          <p className="text-purple-100 text-sm mt-1">Max will adapt just for you!</p>
        </div>

        <div className="p-5 space-y-3">
          {/* Profiles */}
          {profiles.map((p, i) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="w-full flex items-center gap-4 p-3 rounded-2xl border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-all group"
            >
              <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold', AVATAR_COLOURS[i % AVATAR_COLOURS.length])}>
                {p.name[0].toUpperCase()}
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-gray-800 dark:text-gray-100 group-hover:text-purple-700 dark:group-hover:text-purple-400">{p.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {p.age ? getAgeRangeLabel(p.age) : ''}
                  {p.grade ? ` · Grade ${p.grade}` : ''}
                  {!p.age && !p.grade ? 'No age set' : ''}
                </p>
              </div>
              {p.totalStars > 0 && (
                <span className="text-xs font-semibold text-amber-500 flex items-center gap-0.5 shrink-0">
                  ⭐ {p.totalStars}
                </span>
              )}
              <span className="text-purple-300 group-hover:text-purple-500 text-2xl">›</span>
            </button>
          ))}

          {/* Add new profile */}
          {!adding && profiles.length < 5 && (
            <button onClick={() => setAdding(true)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 text-gray-400 dark:text-gray-500 hover:text-purple-500 transition-all">
              <Plus size={20} />
              <span className="text-sm font-medium">Add a profile</span>
            </button>
          )}

          {/* Inline add form */}
          {adding && (
            <div className="space-y-2 bg-purple-50 dark:bg-purple-950/40 rounded-2xl p-3 border border-purple-100 dark:border-purple-800/30">
              <input type="text" placeholder="Child's name" value={newName}
                onChange={(e) => setNewName(e.target.value)} className="input-field" />
              <input type="number" placeholder="Age (optional)" min={4} max={18} value={newAge}
                onChange={(e) => setNewAge(e.target.value)} className="input-field" />
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                Explanation age range
              </label>
              <select
                value={newAgeRange}
                onChange={(e) => setNewAgeRange(e.target.value)}
                className="input-field"
              >
                {AGE_RANGE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={() => { setAdding(false); setNewName(''); setNewAge(''); setNewAgeRange('5-7') }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleAdd} disabled={!newName.trim()} className="btn-primary flex-1">Add</button>
              </div>
            </div>
          )}

          {/* Guest / skip */}
          <button onClick={() => onSelect(null)}
            className="w-full text-center text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 py-2">
            Continue without a profile →
          </button>
        </div>
      </div>
    </div>
  )
}

function getAgeRangeLabel(age: number): string {
  if (age <= 7) return 'Ages 5-7'
  if (age <= 10) return 'Ages 8-10'
  if (age <= 13) return 'Ages 11-13'
  return 'Ages 14-18'
}
