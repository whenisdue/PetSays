import { useCallback, useMemo, useState, type ChangeEventHandler, type CSSProperties, type MouseEventHandler, type RefObject } from 'react'
import { BubbleGraphic } from './BubbleGraphic'
import { DailyStoryReader } from './DailyStoryReader'
import { PublicSiteFooter, PublicSiteHeader } from './PublicSiteChrome'
import {
  dailyEpisodes,
  getFeaturedDailyEpisode,
  vibeHighlights,
  type DailyEpisode,
} from '../data/dailyEpisodes'
import { getVibe, type VibeId } from '../data/presets'

type PublicHomeProps = {
  fileInputRef?: RefObject<HTMLInputElement | null>
  onFileChange?: ChangeEventHandler<HTMLInputElement>
  onHome?: MouseEventHandler<HTMLAnchorElement>
  onUpload?: () => void
}

const noop = () => undefined
export function PublicHome({
  fileInputRef,
  onFileChange,
  onHome,
  onUpload = noop,
}: PublicHomeProps) {
  const [featuredEpisode] = useState<DailyEpisode>(() => getFeaturedDailyEpisode())
  const [isReaderOpen, setIsReaderOpen] = useState(false)
  const [activeVibeId, setActiveVibeId] = useState<VibeId | null>(null)
  const closeReader = useCallback(() => setIsReaderOpen(false), [])

  const visibleEpisodes = useMemo(
    () => activeVibeId
      ? dailyEpisodes.filter((episode) => episode.vibeId === activeVibeId)
      : dailyEpisodes,
    [activeVibeId],
  )
  const activeVibe = activeVibeId ? getVibe(activeVibeId) : null

  const scrollToMore = () => {
    window.requestAnimationFrame(() => {
      document.getElementById('more-from-petsays')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handleVibeClick = (vibeId: VibeId) => {
    setActiveVibeId((current) => current === vibeId ? null : vibeId)
    scrollToMore()
  }

  return (
    <div className="app-shell home-shell">
      <PublicSiteHeader onHome={onHome} showHomeNav />

      <main id="top" className="home-main">
        <section className="home-hero" aria-label="PetSays Today and Make Your Own">
          <section id="today" className="today-panel" aria-labelledby="today-title">
            <div className="home-panel-spots" aria-hidden="true">
              <span className="home-spot home-spot-sun" />
              <span className="home-spot home-spot-peach" />
            </div>

            <div className="today-copy-column">
              <div className="today-copy">
                <p className="home-kicker">PETSAYS TODAY</p>
                <h1 id="today-title">{featuredEpisode.title}</h1>
                <p className="today-subtitle">A fresh PetSays episode. New every day.</p>
              </div>
              <div className="today-actions">
                <button type="button" className="today-cta" onClick={() => setIsReaderOpen(true)}>
                  <span>Read today’s story</span>
                  <span aria-hidden="true">→</span>
                </button>
                <p className="today-freshness"><span aria-hidden="true">▣</span> New every day · Come back tomorrow</p>
              </div>
            </div>

            <div className="today-featured">
              <div className="today-featured-image">
                <img
                  src={featuredEpisode.image}
                  alt={featuredEpisode.alt}
                  width="1200"
                  height="1500"
                  fetchPriority="high"
                />
                <div className="today-featured-bubble" aria-hidden="true">
                  <BubbleGraphic kind="thought" text={featuredEpisode.slides[0]} />
                </div>
                <span className="today-stamp" aria-hidden="true">Today’s<br />PetSays</span>
              </div>
            </div>

            <div className="today-preview" aria-label={`${featuredEpisode.slides.length}-part story preview`}>
              <div className="mobile-story-progress">
                <span className="mobile-story-dots" aria-hidden="true">
                  {featuredEpisode.slides.map((_, index) => (
                    <span key={`${featuredEpisode.id}-progress-${index}`} className={index === 0 ? 'is-active' : undefined} />
                  ))}
                </span>
                <span className="mobile-story-progress-copy">
                  <strong>{featuredEpisode.slides.length}-part story</strong>
                  <small>Episode 1 of {featuredEpisode.slides.length}</small>
                </span>
              </div>
              <div className="preview-cards">
                {featuredEpisode.slides.map((line, index) => (
                  <div
                    key={`${featuredEpisode.id}-${index}`}
                    className={`preview-card preview-card-${index + 1} ${index > 1 ? 'is-locked' : ''}`}
                    aria-hidden="true"
                  >
                    <img src={featuredEpisode.image} alt="" loading="lazy" width="240" height="150" />
                    <span className="preview-number">{index + 1}</span>
                    {index < 2 ? (
                      <span className="preview-line">{line}</span>
                    ) : (
                      <span className="preview-lock">●</span>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="preview-count" onClick={() => setIsReaderOpen(true)}>
                <strong>{featuredEpisode.slides.length}-part<br />story</strong>
                <span>+{featuredEpisode.slides.length - 1} more <span aria-hidden="true">→</span></span>
              </button>
            </div>
          </section>

          <section id="make-your-own" className="maker-home-panel" aria-labelledby="make-title">
            <div className="maker-panel-orbit" aria-hidden="true" />
            <p className="home-kicker">MAKE YOUR OWN</p>
            <h2 id="make-title">Make your<br />pet talk.</h2>
            <p className="maker-home-subtitle">Upload a photo. Pick a vibe. Make it funny.</p>

            <button type="button" className="home-upload-cta" onClick={onUpload}>
              <span className="home-upload-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M12 15V4m0 0 4 4m-4-4L8 8" />
                  <path d="M6.5 13H6a4 4 0 0 0 0 8h12a4 4 0 0 0 0-8h-.5" />
                </svg>
              </span>
              <span className="home-upload-copy">
                <strong>Upload a pet photo</strong>
                <small>Choose a photo or take one</small>
              </span>
              <span className="home-upload-arrow" aria-hidden="true">→</span>
            </button>
            <p className="maker-home-trust">No signup · Free to use</p>

            <ol className="maker-steps" aria-label="How PetSays works">
              <li>
                <strong>01</strong>
                <span><b>Upload</b><small>Choose the face.</small></span>
              </li>
              <li>
                <strong>02</strong>
                <span><b>Pick a vibe</b><small>Trust your instincts.</small></span>
              </li>
              <li>
                <strong>03</strong>
                <span><b>Download</b><small>Keep the joke.</small></span>
              </li>
            </ol>

            <a className="maker-story-link" href="/stories">
              <span>Make a 7-slide story</span>
              <span aria-hidden="true">→</span>
            </a>
          </section>
        </section>

        <input
          ref={fileInputRef}
          id="photo-upload"
          className="visually-hidden"
          type="file"
          accept="image/*"
          onChange={onFileChange}
          aria-label="Upload a pet photo"
        />

        <section id="browse" className="home-section home-browse" aria-labelledby="browse-title">
          <div className="home-section-heading">
            <div>
              <p className="home-kicker">BROWSE BY VIBE</p>
              <div className="home-heading-row">
                <h2 id="browse-title">Browse by vibe</h2>
                <p className="home-section-support">Pick a mood. Find your next laugh.</p>
              </div>
            </div>
            <button type="button" className="home-quiet-link" onClick={() => {
              setActiveVibeId(null)
              scrollToMore()
            }}>
              See all vibes <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="vibe-highlights" role="list" aria-label="PetSays vibes">
            {vibeHighlights.map((highlight) => {
              const vibe = getVibe(highlight.id)
              const isActive = activeVibeId === highlight.id

              return (
                <button
                  key={highlight.id}
                  type="button"
                  className={`vibe-highlight ${isActive ? 'is-active' : ''}`}
                  onClick={() => handleVibeClick(highlight.id)}
                  aria-pressed={isActive}
                  style={{ '--vibe-tint': vibe.tint } as CSSProperties}
                >
                  <img src={highlight.image} alt="" loading="lazy" width="180" height="180" />
                  <span className="vibe-highlight-copy">
                    <strong>{vibe.label}</strong>
                    <small>{highlight.description}</small>
                  </span>
                  <span className="vibe-highlight-arrow" aria-hidden="true">→</span>
                </button>
              )
            })}
          </div>
        </section>

        <section id="more-from-petsays" className="home-section home-more" aria-labelledby="more-title">
          <div className="home-section-heading">
            <div>
              <p className="home-kicker">MORE FROM PETSAYS</p>
              <div className="home-heading-row">
                <h2 id="more-title">More from PetSays</h2>
                <p className="home-section-support">Handpicked pet thoughts for your daily dose of joy.</p>
              </div>
            </div>
            {activeVibe && (
              <button type="button" className="home-quiet-link" onClick={() => setActiveVibeId(null)}>
                Clear {activeVibe.label} <span aria-hidden="true">×</span>
              </button>
            )}
          </div>

          <div className="editorial-grid">
            {visibleEpisodes.map((episode) => {
              const vibe = getVibe(episode.vibeId)

              return (
                <article className="editorial-card" key={episode.id}>
                  <div className="editorial-image">
                    <img src={episode.image} alt={episode.alt} loading="lazy" width="640" height="420" />
                    {episode.editorialLabel && <span className="editorial-label">{episode.editorialLabel}</span>}
                    <div className="editorial-bubble" aria-hidden="true">
                      <BubbleGraphic kind="thought" text={episode.slides[0]} />
                    </div>
                  </div>
                  <div className="editorial-card-copy">
                    <span>{vibe.label}</span>
                    <h3>{episode.title}</h3>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <p className="home-ideas-link">
          <span className="home-ideas-icon" aria-hidden="true">💡</span>
          <strong>Need a line?</strong>
          <a href="/pet-thought-bubble-ideas/">Browse funny pet thought bubble ideas <span aria-hidden="true">→</span></a>
          <span className="home-ideas-helper">Stuck? We’ve got you.</span>
        </p>
      </main>

      <PublicSiteFooter />
      <DailyStoryReader
        episode={featuredEpisode}
        isOpen={isReaderOpen}
        onClose={closeReader}
        onUpload={onUpload}
      />
    </div>
  )
}
