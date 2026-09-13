import { stories, type Story } from '../data/stories'
import type { VibeId } from '../data/presets'

const lastStoryIdByVibe = new Map<VibeId, string>()

export function getStoriesForVibe(vibeId: VibeId): Story[] {
  return stories.filter((story) => story.vibeId === vibeId)
}

export function getRandomStory(vibeId: VibeId): Story {
  const vibeStories = getStoriesForVibe(vibeId)
  if (vibeStories.length === 0) {
    throw new Error(`No PetSays Stories found for vibe: ${vibeId}`)
  }

  const previousStoryId = lastStoryIdByVibe.get(vibeId)
  const availableStories =
    vibeStories.length > 1
      ? vibeStories.filter((story) => story.id !== previousStoryId)
      : vibeStories
  const nextStory =
    availableStories[Math.floor(Math.random() * availableStories.length)] ??
    vibeStories[0]

  lastStoryIdByVibe.set(vibeId, nextStory.id)
  return nextStory
}

export function getRandomStoryLine(vibeId: VibeId, excludedLines: string[] = []) {
  const vibeLines = getStoriesForVibe(vibeId).flatMap((story) => story.slides)
  const availableLines = vibeLines.filter((line) => !excludedLines.includes(line))
  const lines = availableLines.length > 0 ? availableLines : vibeLines
  return lines[Math.floor(Math.random() * lines.length)] ?? ''
}
