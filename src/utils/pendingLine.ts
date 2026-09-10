import { getThoughtBubbleIdea, type ThoughtBubbleIdea } from '../data/thoughtBubbleIdeas'
import { vibes, type VibeId } from '../data/presets'

const pendingLineStorageKey = 'petsays:pending-line:v1'

export type PendingLine = Pick<ThoughtBubbleIdea, 'id' | 'text' | 'vibeId'>

const isVibeId = (value: unknown): value is VibeId =>
  typeof value === 'string' && vibes.some((vibe) => vibe.id === value)

const toPendingLine = (value: unknown): PendingLine | null => {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.text !== 'string' ||
    !isVibeId(candidate.vibeId)
  ) return null

  const idea = getThoughtBubbleIdea(candidate.id)
  if (!idea || idea.text !== candidate.text || idea.vibeId !== candidate.vibeId) return null

  return {
    id: idea.id,
    text: idea.text,
    vibeId: idea.vibeId,
  }
}

export function savePendingLine(line: PendingLine) {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.setItem(pendingLineStorageKey, JSON.stringify(line))
  } catch {
    // A blocked or unavailable sessionStorage should not prevent normal navigation.
  }
}

export function readPendingLine(): PendingLine | null {
  if (typeof window === 'undefined') return null

  try {
    const rawValue = window.sessionStorage.getItem(pendingLineStorageKey)
    if (!rawValue) return null

    const line = toPendingLine(JSON.parse(rawValue))
    if (!line) window.sessionStorage.removeItem(pendingLineStorageKey)
    return line
  } catch {
    return null
  }
}

export function clearPendingLine() {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.removeItem(pendingLineStorageKey)
  } catch {
    // Ignore storage cleanup failures; the in-memory handoff still proceeds.
  }
}
