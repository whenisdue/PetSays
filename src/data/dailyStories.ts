import { dailyStoryManifest } from './generated/dailyStoryManifest.ts'
import type { VibeId } from './presets'

export type DailyStory = {
  date: string
  title: string
  vibe: VibeId
  alt: string
  cover: string
  slides: readonly string[]
}

export const dailyStories: readonly DailyStory[] = dailyStoryManifest

export function getLocalDateKey(date: Date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function getDailyStoryForDateKey(dateKey: string): DailyStory | null {
  let selectedStory: DailyStory | null = null

  for (const story of dailyStories) {
    if (story.date > dateKey) break
    selectedStory = story
  }

  return selectedStory
}

export function getDailyStoryForDate(date: Date = new Date()) {
  return getDailyStoryForDateKey(getLocalDateKey(date))
}
