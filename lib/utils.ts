// ─────────────────────────────────────────────
// TutorKanvas — General Utilities
// ─────────────────────────────────────────────

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ── Tailwind className helper ─────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── PIN Hashing (Web Crypto — no external dep) ─

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(`tk_pin_salt_${pin}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── Unique ID generator ───────────────────────

export function generateId(): string {
  return crypto.randomUUID()
}

// ── ISO date helper ───────────────────────────

export function nowISO(): string {
  return new Date().toISOString()
}

// ── Debounce ──────────────────────────────────

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

// ── Truncate text ─────────────────────────────

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

// ── Image helpers ─────────────────────────────

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function extractBase64Data(dataUrl: string): string {
  // Strip the "data:image/png;base64," prefix
  return dataUrl.split(',')[1] ?? dataUrl
}

export function getMimeType(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);/)
  return match?.[1] ?? 'image/jpeg'
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: 'Please use a JPEG, PNG, WebP, or GIF image.' }
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: 'Image must be smaller than 10MB.' }
  }
  return { valid: true }
}

// ── Star rating ───────────────────────────────

export function scoreToStars(score: number, total: number): 1 | 2 | 3 {
  const pct = total > 0 ? score / total : 0
  if (pct >= 0.85) return 3
  if (pct >= 0.5) return 2
  return 1
}
