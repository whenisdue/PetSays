import type { VibeId } from '../data/presets'

type VibeArtProps = {
  id: VibeId
  color: string
}

const sharedProps = {
  className: 'vibe-art-icon',
  viewBox: '0 0 120 72',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function VibeArt({ id, color }: VibeArtProps) {
  const iconProps = { ...sharedProps, style: { color } }

  switch (id) {
    case 'guilty':
      return (
        <svg {...iconProps}>
          <path d="M23 54h34l-5-21H28l-5 21Z" fill="currentColor" opacity=".22" />
          <path d="M27 33h27M23 54h34" />
          <path d="M40 33c-1-8 2-14 8-18" />
          <path d="M42 22c-6 0-10-4-11-9 6-1 11 2 13 7" fill="currentColor" opacity=".72" />
          <path d="M48 18c5-4 10-3 13 1-4 4-9 5-13 3" fill="currentColor" opacity=".72" />
          <path d="m74 51 5-6 5 6 5-6 5 6" />
          <circle cx="82" cy="27" r="3" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'hungry':
      return (
        <svg {...iconProps}>
          <path d="M22 37h45c-2 14-10 23-22 23S25 51 22 37Z" fill="currentColor" opacity=".23" />
          <ellipse cx="44.5" cy="37" rx="22.5" ry="5" fill="currentColor" opacity=".82" />
          <path d="M35 44c5 3 14 3 19 0" />
          <path d="M79 25c2-4 7-4 9 0 4-3 9 0 8 4-1 4-7 5-11 3-4 2-10 1-11-3-1-2 1-4 5-4Z" fill="currentColor" opacity=".78" />
          <path d="M85 22v-5M92 24l3-4" />
        </svg>
      )
    case 'judging':
      return (
        <svg {...iconProps}>
          <path d="M19 25c6-5 13-6 21-2M70 23c8-4 15-3 22 2" />
          <ellipse cx="35" cy="39" rx="16" ry="11" fill="var(--paper, #fffdf8)" />
          <ellipse cx="77" cy="39" rx="16" ry="11" fill="var(--paper, #fffdf8)" />
          <circle cx="42" cy="39" r="4.5" fill="currentColor" stroke="none" />
          <circle cx="84" cy="39" r="4.5" fill="currentColor" stroke="none" />
          <path d="M28 53c6 3 12 3 18 0M70 53c6 3 12 3 18 0" opacity=".72" />
        </svg>
      )
    case 'dramatic':
      return (
        <svg {...iconProps}>
          <path d="M20 27c7-8 16-9 25-3l-2 23c-9 6-17 3-23-5V27Z" fill="currentColor" opacity=".25" />
          <path d="M76 24c9-4 17-1 24 7v15c-7 6-15 7-23 1l-1-23Z" fill="currentColor" opacity=".12" />
          <path d="M29 35c3-3 7-3 10 0M81 35c3-3 7-3 10 0" />
          <circle cx="36" cy="42" r="2.5" fill="currentColor" stroke="none" />
          <path d="M87 42c2 2 2 5 0 7" />
          <path d="M47 16 51 9M60 16l2-8M72 18l5-6" />
          <path d="M48 54c5 4 11 5 17 2" />
        </svg>
      )
    case 'sleepy':
      return (
        <svg {...iconProps}>
          <path d="M39 16a20 20 0 1 0 19 33A22 22 0 0 1 39 16Z" fill="currentColor" opacity=".72" stroke="none" />
          <path d="M29 48c4 3 8 3 12 0" />
          <path d="M68 23h13L68 35h13M82 43h9l-9 9h9" strokeWidth="3.8" />
          <path d="M22 56h12" opacity=".4" />
        </svg>
      )
    case 'excited':
      return (
        <svg {...iconProps}>
          <path d="m34 11 4 12 12 4-12 4-4 12-4-12-12-4 12-4 4-12Z" fill="currentColor" opacity=".72" />
          <circle cx="79" cy="45" r="11" fill="currentColor" opacity=".22" />
          <path d="M68 45h22M79 34v22" opacity=".8" />
          <path d="M95 19v8M99 23h-8" strokeWidth="3.8" />
          <path d="M59 18h-6M56 15v6" />
        </svg>
      )
    case 'suspicious':
      return (
        <svg {...iconProps}>
          <circle cx="42" cy="34" r="17" fill="var(--paper, #fffdf8)" />
          <circle cx="42" cy="34" r="7" fill="currentColor" opacity=".2" />
          <circle cx="42" cy="34" r="3.5" fill="currentColor" stroke="none" />
          <path d="m55 47 13 13" strokeWidth="5" />
          <path d="M83 27c1-5 9-5 10 0 1 4-4 5-5 8v2M88 44h.01" strokeWidth="3.8" />
        </svg>
      )
    case 'chaos':
      return (
        <svg {...iconProps}>
          <path d="M12 49c8-15 11 10 19-5s11 11 20-5 10 10 18-5 11 9 18-5" strokeWidth="4" />
          <path d="m79 17 8 8-8 8" fill="currentColor" opacity=".28" />
          <path d="m25 24 9 7-8 8" opacity=".72" />
          <circle cx="102" cy="47" r="3" fill="currentColor" stroke="none" />
        </svg>
      )
  }
}
