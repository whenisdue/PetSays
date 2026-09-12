import type { VibeId } from './presets'

export type DailyEpisode = {
  id: string
  title: string
  image: string
  alt: string
  slides: string[]
  vibeId: VibeId
  editorialLabel?: 'PETSAYS PICK' | 'FAVORITE' | 'CLASSIC'
}

export type VibeHighlight = {
  id: VibeId
  description: string
  image: string
}

// A small, authored launch library is enough to make the daily experience feel
// alive without pretending that PetSays is a social feed.
export const dailyEpisodes: DailyEpisode[] = [
  {
    id: 'breakfast-investigation',
    title: 'The Breakfast Investigation',
    image: '/demo/pet-golden.jpg',
    alt: 'Golden retriever holding a flower and looking very serious',
    vibeId: 'hungry',
    editorialLabel: 'PETSAYS PICK',
    slides: [
      "I'd like to report a problem.",
      'My breakfast appears to be missing.',
      'I checked every bowl in the house.',
      'This feels like an avoidable crisis.',
      "I'll be waiting by the kitchen.",
    ],
  },
  {
    id: 'missing-evidence',
    title: 'The Missing Evidence',
    image: '/demo/pet-pug.jpg',
    alt: 'Black pug in a cozy sweater looking up with wide eyes',
    vibeId: 'guilty',
    editorialLabel: 'FAVORITE',
    slides: [
      'Before you get mad…',
      'The evidence is not where you left it.',
      'I may have moved it somewhere safe.',
      'The safe place was my stomach.',
      'I regret nothing. Except being caught.',
    ],
  },
  {
    id: 'closed-door-tragedy',
    title: 'A Whole Production',
    image: '/demo/pet-cat-window.jpg',
    alt: 'White cat with wide eyes making a dramatic face',
    vibeId: 'dramatic',
    editorialLabel: 'CLASSIC',
    slides: [
      'This is the worst day of my life.',
      'The door is closed.',
      'Between me and everything I love.',
      'I may never see that rug again.',
      'Open it immediately.',
    ],
  },
  {
    id: 'doorway-investigation',
    title: 'The Doorway Investigation',
    image: '/demo/pet-tabby.jpg',
    alt: 'Tabby cat staring intensely into the camera',
    vibeId: 'suspicious',
    slides: [
      'Nobody touch that door.',
      'It opened without explanation.',
      'You acted normal. That was suspicious.',
      'I have questions for the hallway.',
      'I will be watching from here.',
    ],
  },
  {
    id: 'outfit-review',
    title: 'A Very Personal Review',
    image: '/demo/pet-cat-gray.jpg',
    alt: 'Long-haired tabby cat sitting upright on a stair',
    vibeId: 'judging',
    editorialLabel: 'CLASSIC',
    slides: [
      'Interesting choice.',
      'Was that outfit intentional?',
      'It is very confident.',
      'Not necessarily correct.',
      'But I will be seen with you.',
    ],
  },
  {
    id: 'small-decision-big-consequences',
    title: 'One Small Decision',
    image: '/demo/pet-dog-close.jpg',
    alt: 'Corgi puppy looking thoughtfully at the camera',
    vibeId: 'chaos',
    editorialLabel: 'FAVORITE',
    slides: [
      'I made a small decision.',
      'It involved the hallway.',
      'And a little momentum.',
      'The furniture also participated.',
      'I would do it again.',
    ],
  },
]

export const vibeHighlights: VibeHighlight[] = [
  { id: 'judging', description: 'Because someone has to.', image: '/demo/pet-cat-gray.jpg' },
  { id: 'guilty', description: 'I can explain.', image: '/demo/pet-pug.jpg' },
  { id: 'hungry', description: 'Is it snack time yet?', image: '/demo/pet-golden.jpg' },
  { id: 'dramatic', description: 'A whole production.', image: '/demo/pet-cat-window.jpg' },
  { id: 'suspicious', description: "I'm watching you.", image: '/demo/pet-tabby.jpg' },
  { id: 'chaos', description: 'Normal is boring.', image: '/demo/pet-dog-close.jpg' },
]

const launchDate = new Date(2026, 8, 12)
const millisecondsPerLocalDay = 24 * 60 * 60 * 1000

export function getLocalDayIndex(date: Date = new Date()) {
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const launchDay = new Date(
    launchDate.getFullYear(),
    launchDate.getMonth(),
    launchDate.getDate(),
  )

  return Math.floor((localDate.getTime() - launchDay.getTime()) / millisecondsPerLocalDay)
}

export function getFeaturedDailyEpisode(date: Date = new Date()) {
  const index = ((getLocalDayIndex(date) % dailyEpisodes.length) + dailyEpisodes.length) % dailyEpisodes.length
  return dailyEpisodes[index]
}
