import { useCallback, useEffect, useRef, useState } from 'react'
import type { DailyStory } from '../data/dailyStories'

const SLIDE_TRANSITION_DURATION = 220

type SlideDirection = 'next' | 'previous'

type DailyStoryReaderProps = {
  episode: DailyStory
  isOpen: boolean
  onClose: () => void
  onUpload?: () => void
}

export function DailyStoryReader({ episode, isOpen, onClose, onUpload }: DailyStoryReaderProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const transitionTimeoutRef = useRef<number | null>(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const [slideDirection, setSlideDirection] = useState<SlideDirection>('next')
  const [isTransitioning, setIsTransitioning] = useState(false)

  const startSlideTransition = useCallback((direction: SlideDirection) => {
    if (isTransitioning) return false

    setSlideDirection(direction)
    setIsTransitioning(true)
    transitionTimeoutRef.current = window.setTimeout(() => {
      transitionTimeoutRef.current = null
      setIsTransitioning(false)
    }, SLIDE_TRANSITION_DURATION)
    return true
  }, [isTransitioning])

  const goToPreviousSlide = useCallback(() => {
    if (activeSlide === 0 || !startSlideTransition('previous')) return
    setActiveSlide((current) => Math.max(0, current - 1))
  }, [activeSlide, startSlideTransition])

  const goToNextSlide = useCallback(() => {
    if (activeSlide === episode.slides.length - 1 || !startSlideTransition('next')) return
    setActiveSlide((current) => Math.min(episode.slides.length - 1, current + 1))
  }, [activeSlide, episode.slides.length, startSlideTransition])

  const goToSlide = useCallback((index: number) => {
    if (index < 0 || index >= episode.slides.length || index === activeSlide) return
    const direction: SlideDirection = index > activeSlide ? 'next' : 'previous'
    if (!startSlideTransition(direction)) return
    setActiveSlide(index)
  }, [activeSlide, episode.slides.length, startSlideTransition])

  const closeReader = useCallback(() => {
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current)
      transitionTimeoutRef.current = null
    }
    setIsTransitioning(false)
    setSlideDirection('next')
    setActiveSlide(0)
    onClose()
  }, [onClose])

  useEffect(() => () => {
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current)
    }
  }, [])

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
      if (event.key === 'ArrowLeft') goToPreviousSlide()
      if (event.key === 'ArrowRight') goToNextSlide()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [closeReader, goToNextSlide, goToPreviousSlide, isOpen])

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
        aria-labelledby="daily-reader-context"
      >
        <div className="daily-reader-header">
          <p className="home-kicker" id="daily-reader-context">PETSAYS TODAY</p>
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

        <div
          className={`daily-reader-stage${isTransitioning ? ` is-transitioning is-${slideDirection}` : ''}`}
          aria-live="polite"
        >
          <img
            src={slide}
            alt={episode.alt}
            draggable={false}
          />
          <button
            type="button"
            className="daily-reader-tap-zone daily-reader-tap-zone--prev"
            onClick={goToPreviousSlide}
            disabled={activeSlide === 0}
            aria-label="Previous story slide"
          />
          <button
            type="button"
            className="daily-reader-tap-zone daily-reader-tap-zone--next"
            onClick={goToNextSlide}
            disabled={isLastSlide}
            aria-label="Next story slide"
          />
          <span className="daily-reader-counter">{activeSlide + 1} / {episode.slides.length}</span>
        </div>

        <div className="daily-reader-controls" aria-label="Story controls">
          <button
            type="button"
            className="daily-reader-arrow"
            onClick={goToPreviousSlide}
            disabled={activeSlide === 0}
            aria-label="Previous story slide"
          >
            ←
          </button>
          <div className="daily-reader-dots" aria-label={`Slide ${activeSlide + 1} of ${episode.slides.length}`}>
            {episode.slides.map((_, index) => (
              <button
                key={`${episode.date}-${index}`}
                className={index === activeSlide ? 'is-active' : ''}
                type="button"
                onClick={() => goToSlide(index)}
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
            onClick={goToNextSlide}
            disabled={isLastSlide}
            aria-label="Next story slide"
          >
            →
          </button>
        </div>

        <div className="daily-reader-footer">
          <p>{isLastSlide ? 'That’s today’s episode. Your pet has notes too.' : 'Tap the photo or use the arrows to continue.'}</p>
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
