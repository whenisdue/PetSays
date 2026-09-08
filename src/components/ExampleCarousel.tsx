import { useRef, useState, type UIEvent } from 'react'

type Sample = {
  src: string
  alt: string
  aspect: 'three-four' | 'nine-sixteen'
  size: 'featured' | 'standard'
}

const heroPet = (fileName: string) => `/demo/hero-pets/${fileName}`

const samples: Sample[] = [
  {
    src: heroPet('hero-pet-01.jpg'),
    alt: 'Finished PetSays example featuring a pet with a funny bubble',
    aspect: 'three-four',
    size: 'featured',
  },
  {
    src: heroPet('hero-pet-02.jpg'),
    alt: 'Finished PetSays example featuring a dog with a funny bubble',
    aspect: 'three-four',
    size: 'standard',
  },
  {
    src: heroPet('hero-pet-03.jpg'),
    alt: 'Finished PetSays example featuring a dog with a funny bubble',
    aspect: 'three-four',
    size: 'standard',
  },
  {
    src: heroPet('hero-pet-04.jpg'),
    alt: 'Finished PetSays example featuring a cat with a funny bubble',
    aspect: 'nine-sixteen',
    size: 'standard',
  },
  {
    src: heroPet('hero-pet-05.jpg'),
    alt: 'Finished PetSays example featuring a resting pet with a funny bubble',
    aspect: 'three-four',
    size: 'featured',
  },
  {
    src: heroPet('hero-pet-06.jpg'),
    alt: 'Finished PetSays example featuring a cat with a funny bubble',
    aspect: 'nine-sixteen',
    size: 'standard',
  },
]

function SampleCard({ sample, index }: { sample: Sample; index: number }) {
  return (
    <article className={`sample-card ${sample.size} ${sample.aspect}`}>
      <img
        src={sample.src}
        alt={sample.alt}
        loading={index < 2 ? 'eager' : 'lazy'}
        decoding="async"
      />
    </article>
  )
}

export function ExampleCarousel() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const scrollToIndex = (index: number) => {
    const track = trackRef.current
    const card = track?.children[index] as HTMLElement | undefined
    if (!track || !card) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track.scrollTo({
      left: card.offsetLeft - track.offsetLeft,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
    setActiveIndex(index)
  }

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const track = event.currentTarget
    const trackRect = track.getBoundingClientRect()
    let closestIndex = 0
    let closestDistance = Number.POSITIVE_INFINITY

    Array.from(track.children).forEach((child, index) => {
      const card = child as HTMLElement
      const cardRect = card.getBoundingClientRect()
      const distance = Math.abs(cardRect.left - trackRect.left)

      if (distance < closestDistance) {
        closestIndex = index
        closestDistance = distance
      }
    })

    setActiveIndex(closestIndex)
  }

  return (
    <section
      className="hero-examples"
      aria-label="Finished PetSays examples"
      aria-roledescription="carousel"
    >
      <div className="carousel-heading">
        <div>
          <span className="carousel-kicker">Made with PetSays</span>
          <strong>Same face. Better context.</strong>
        </div>

        <div className="carousel-arrows" aria-label="Carousel controls">
          <button
            type="button"
            onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
            aria-label="Previous example"
            disabled={activeIndex === 0}
          >
            ←
          </button>

          <button
            type="button"
            onClick={() => scrollToIndex(Math.min(samples.length - 1, activeIndex + 1))}
            aria-label="Next example"
            disabled={activeIndex === samples.length - 1}
          >
            →
          </button>
        </div>
      </div>

      <div className="sample-track" ref={trackRef} onScroll={handleScroll}>
        {samples.map((sample, index) => (
          <SampleCard sample={sample} index={index} key={sample.src} />
        ))}
      </div>

      <div className="carousel-progress" aria-hidden="true">
        {samples.map((sample, index) => (
          <span className={index === activeIndex ? 'active' : ''} key={sample.src} />
        ))}
      </div>
    </section>
  )
}
