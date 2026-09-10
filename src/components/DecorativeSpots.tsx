type DecorativePage = 'landing' | 'picker' | 'result'

export function DecorativeSpots({ page }: { page: DecorativePage }) {
  return (
    <div className={`vibe-atmosphere vibe-atmosphere-${page}`} aria-hidden="true">
      <span className="vibe-spot vibe-spot-mint" />
      <span className="vibe-spot vibe-spot-lilac" />
      <span className="vibe-spot vibe-spot-peach" />
      <span className="vibe-spot vibe-spot-sun" />
      <span className="vibe-spot vibe-spot-sky" />
      <span className="vibe-spot vibe-spot-coral" />
    </div>
  )
}
