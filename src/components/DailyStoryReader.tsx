import { useCallback, useEffect, useRef, useState } from 'react'
import { BubbleGraphic } from './BubbleGraphic'
import type { DailyEpisode } from '../data/dailyEpisodes'

type DailyStoryReaderProps = {
  episode: DailyEpisode
  isOpen: boolean
  onClose: () => void
  onUpload?: () => void
}

export function DailyStoryReader({ episode, isOpen, onClose, onUpload }: DailyStoryReaderProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [activeSlide, setActiveSlide] = useState(0)

  const closeReader = useCallback(() => {
    setActiveSlide(0)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeReader()
      if (event.key === 'ArrowLeft') setActiveSlide((current) => Math.max(0, current - 1))
      if (event.key === 'ArrowRight') setActiveSlide((current) => Math.min(episode.slides.length - 1, current + 1))
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [closeReader, episode.slides.length, isOpen])

  if (!isOpen) return null

  const slide = episode.slides[activeSlide]
  const isLastSlide = activeSlide === episode.slides.length - 1

  return (
    <div className="daily-reader-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeReader()
    }}>
      <section
        className="daily-reader"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-reader-title"
      >
        <div className="daily-reader-header">
          <div>
            <p className="home-kicker">PETSAYS TODAY</p>
            <h2 id="daily-reader-title">{episode.title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="daily-reader-close"
            type="button"
            onClick={closeReader}
            aria-label="Close today’s story"
          >
            ×
          </button>
        </div>

        <div className="daily-reader-stage" aria-live="polite">
          <img src={episode.image} alt={episode.alt} />
          <div className="daily-reader-bubble">
            <BubbleGraphic kind="thought" text={slide} />
          </div>
          <span className="daily-reader-counter">{activeSlide + 1} / {episode.slides.length}</span>
        </div>

        <div className="daily-reader-controls" aria-label="Story controls">
          <button
            type="button"
            className="daily-reader-arrow"
            onClick={() => setActiveSlide((current) => Math.max(0, current - 1))}
            disabled={activeSlide === 0}
            aria-label="Previous story slide"
          >
            ←
          </button>
          <div className="daily-reader-dots" aria-label={`Slide ${activeSlide + 1} of ${episode.slides.length}`}>
            {episode.slides.map((_, index) => (
              <button
                key={`${episode.id}-${index}`}
                className={index === activeSlide ? 'is-active' : ''}
                type="button"
                onClick={() => setActiveSlide(index)}
                aria-label={`Go to story slide ${index + 1}`}
                aria-current={index === activeSlide ? 'step' : undefined}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="daily-reader-arrow"
            onClick={() => setActiveSlide((current) => Math.min(episode.slides.length - 1, current + 1))}
            disabled={isLastSlide}
            aria-label="Next story slide"
          >
            →
          </button>
        </div>

        <div className="daily-reader-footer">
          <p>{isLastSlide ? 'That’s today’s episode. Your pet has notes too.' : 'A little more context is coming.'}</p>
          {isLastSlide && onUpload && (
            <button type="button" className="daily-reader-create" onClick={() => {
              closeReader()
              onUpload()
            }}>
              Make one with your pet →
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
