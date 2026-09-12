import { useEffect, useState } from 'react'

type Sample = {
  src: string
  alt: string
}

type HeroStep = {
  number: string
  title: string
  detail: string
}

const heroPet = (fileName: string) => `/demo/hero-pets/${fileName}`

const samples: Sample[] = [
  {
    src: heroPet('hero-pet-01.jpg'),
    alt: 'Finished PetSays example featuring pets in costume with funny bubbles',
  },
  {
    src: heroPet('hero-pet-02.jpg'),
    alt: 'Finished PetSays example featuring two dogs with funny bubbles',
  },
  {
    src: heroPet('hero-pet-03.jpg'),
    alt: 'Finished PetSays example featuring two dogs with funny bubbles',
  },
  {
    src: heroPet('hero-pet-04.jpg'),
    alt: 'Finished PetSays example featuring a pet in costume with a funny bubble',
  },
  {
    src: heroPet('hero-pet-05.jpg'),
    alt: 'Finished PetSays example featuring a pet with a funny bubble',
  },
  {
    src: heroPet('hero-pet-06.jpg'),
    alt: 'Finished PetSays example featuring a cat with a funny bubble',
  },
]

const rotationStartDelay = 2900
const rotationInterval = 4800

const heroSteps: HeroStep[] = [
  { number: '01', title: 'Upload', detail: 'Choose the face.' },
  { number: '02', title: 'Pick a vibe', detail: 'Trust your instincts.' },
  { number: '03', title: 'Download', detail: 'Keep the joke.' },
]

export function HeroUploadRail({ variant }: { variant: 'mobile' | 'desktop' }) {
  return (
    <div className={`hero-upload-group hero-upload-group-${variant}`}>
      <label className="upload-card hero-upload-rail" htmlFor="photo-upload">
        <span className="upload-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 15V4m0 0 4 4m-4-4L8 8" />
            <path d="M6.5 13H6a4 4 0 0 0 0 8h12a4 4 0 0 0 0-8h-.5" />
          </svg>
        </span>
        <span className="upload-copy">
          <span className="upload-card-title">Upload a pet photo</span>
          <span className="upload-card-hint">Choose a photo or take one</span>
        </span>
        <span className="upload-arrow" aria-hidden="true">→</span>
      </label>
      <p className="upload-trust">No signup · Free to use</p>
      <a className="stories-home-link" href="/stories">
        <span className="stories-home-link-kicker">Want more?</span>
        <span>Make a 7-slide story</span>
        <span aria-hidden="true">→</span>
      </a>
    </div>
  )
}

export function HeroSteps({ variant }: { variant: 'mobile' | 'desktop' }) {
  return (
    <div className={`hero-steps hero-steps-${variant}`}>
      <span className="hero-steps-kicker">Three tiny moves</span>
      <ol className="hero-steps-grid" aria-label="Three tiny moves">
        {heroSteps.map((step) => (
          <li className="hero-step" key={step.number}>
            <span className="hero-step-number" aria-hidden="true">{step.number}</span>
            <span className="hero-step-copy">
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function HeroDemo({ onUpload }: { onUpload: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = () => setReduceMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', updateMotionPreference)
    return () => mediaQuery.removeEventListener('change', updateMotionPreference)
  }, [])

  useEffect(() => {
    if (reduceMotion) return

    const delay = activeIndex === 0 ? rotationStartDelay : rotationInterval
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % samples.length)
    }, delay)

    return () => window.clearTimeout(timer)
  }, [activeIndex, reduceMotion])

  const moveTo = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + samples.length) % samples.length)
  }

  return (
    <div className="hero-demo" role="group" aria-label="Finished PetSays example">
      <div className="hero-demo-heading">
        <div>
          <span className="carousel-kicker">Made with PetSays</span>
          <strong>Same face. Better context.</strong>
        </div>

        <div className="hero-demo-controls" aria-label="Example controls">
          <button
            type="button"
            onClick={() => moveTo(-1)}
            aria-label="Previous example"
          >
            ←
          </button>

          <button
            type="button"
            onClick={() => moveTo(1)}
            aria-label="Next example"
          >
            →
          </button>
        </div>
      </div>

      <button
        type="button"
        className="hero-demo-upload-target"
        onClick={onUpload}
        aria-label="Upload a pet photo"
      >
        <div className="hero-demo-visual">
          {samples.map((sample, index) => (
            <img
              className={`hero-demo-image ${index === activeIndex ? 'is-active' : ''}`}
              src={sample.src}
              alt={index === activeIndex ? sample.alt : ''}
              aria-hidden={index !== activeIndex}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              key={sample.src}
            />
          ))}
          <div className="hero-demo-progress" aria-hidden="true">
            {samples.map((sample, index) => (
              <span className={index === activeIndex ? 'active' : ''} key={sample.src} />
            ))}
          </div>
        </div>
      </button>

      <HeroUploadRail variant="mobile" />
    </div>
  )
}
