import type { VibeId } from './presets'

export type ThoughtBubbleIdea = {
  id: string
  vibeId: VibeId
  text: string
}

export const thoughtBubbleVibeOrder: VibeId[] = [
  'hungry',
  'guilty',
  'judging',
  'dramatic',
  'sleepy',
  'suspicious',
  'excited',
  'chaos',
]

export const thoughtBubbleVibeNotes: Record<VibeId, string> = {
  hungry: 'When the food is late.',
  guilty: 'When the evidence is questionable.',
  judging: 'When the human needs notes.',
  dramatic: 'When everything is a crisis.',
  sleepy: 'When the nap is the plan.',
  suspicious: 'When something feels off.',
  excited: 'When the zoomies begin.',
  chaos: 'When there was technically a plan.',
}

export const thoughtBubbleIdeas: ThoughtBubbleIdea[] = [
  { id: 'hungry-wrapper', vibeId: 'hungry', text: 'I heard a wrapper from three rooms away.' },
  { id: 'hungry-snack-emotion', vibeId: 'hungry', text: 'Your snack seems emotionally available.' },
  { id: 'hungry-taste-testing', vibeId: 'hungry', text: 'I am available for taste testing.' },
  { id: 'hungry-one-bite', vibeId: 'hungry', text: 'One bite. Maybe seven.' },

  { id: 'guilty-plant', vibeId: 'guilty', text: 'I can explain, but the plant cannot.' },
  { id: 'guilty-arrived', vibeId: 'guilty', text: 'That was like that when I arrived.' },
  { id: 'guilty-cushion', vibeId: 'guilty', text: 'I regret nothing. Maybe the cushion.' },
  { id: 'guilty-circumstantial', vibeId: 'guilty', text: 'The evidence feels extremely circumstantial.' },

  { id: 'judging-tuesday', vibeId: 'judging', text: 'Interesting choice for a Tuesday.' },
  { id: 'judging-outfit', vibeId: 'judging', text: 'I have notes about this outfit.' },
  { id: 'judging-snack-technique', vibeId: 'judging', text: 'We need to discuss your snack technique.' },
  { id: 'judging-supportive', vibeId: 'judging', text: 'I am trying to be supportive.' },

  { id: 'dramatic-treats', vibeId: 'dramatic', text: 'Tell my treats I loved them.' },
  { id: 'dramatic-door', vibeId: 'dramatic', text: 'The door closed. I will never recover.' },
  { id: 'dramatic-burden', vibeId: 'dramatic', text: 'Nobody understands the burden of being me.' },
  { id: 'dramatic-changes', vibeId: 'dramatic', text: 'This changes everything.' },

  { id: 'sleepy-sun', vibeId: 'sleepy', text: 'Wake me if the sun moves.' },
  { id: 'sleepy-schedule', vibeId: 'sleepy', text: 'My schedule is fully booked with naps.' },
  { id: 'sleepy-existence', vibeId: 'sleepy', text: 'Please lower the volume of existence.' },
  { id: 'sleepy-resting', vibeId: 'sleepy', text: 'I was just resting my eyes.' },

  { id: 'suspicious-fridge', vibeId: 'suspicious', text: 'Why did the fridge make that noise?' },
  { id: 'suspicious-bag', vibeId: 'suspicious', text: 'I have questions about this bag.' },
  { id: 'suspicious-trap', vibeId: 'suspicious', text: 'That sounds like a trap.' },
  { id: 'suspicious-tone', vibeId: 'suspicious', text: 'I know that tone.' },

  { id: 'excited-walk', vibeId: 'excited', text: 'I have detected a possible walk.' },
  { id: 'excited-treat', vibeId: 'excited', text: 'The good news is probably a treat.' },
  { id: 'excited-outside', vibeId: 'excited', text: 'Did you say outside?!' },
  { id: 'excited-chill', vibeId: 'excited', text: 'I have zero chill.' },

  { id: 'chaos-momentum', vibeId: 'chaos', text: 'No plan, just momentum.' },
  { id: 'chaos-phase-two', vibeId: 'chaos', text: 'The zoomies have entered phase two.' },
  { id: 'chaos-curious', vibeId: 'chaos', text: 'I touched it to see what happened.' },
  { id: 'chaos-new-plan', vibeId: 'chaos', text: 'Okay, new plan!' },
]

export const getThoughtBubbleIdeasForVibe = (vibeId: VibeId) =>
  thoughtBubbleIdeas.filter((idea) => idea.vibeId === vibeId)

export const getThoughtBubbleIdea = (id: string) =>
  thoughtBubbleIdeas.find((idea) => idea.id === id)
