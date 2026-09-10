import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { getVibe, type VibeId } from '../data/presets'
import {
  getThoughtBubbleIdeasForVibe,
  thoughtBubbleVibeNotes,
  thoughtBubbleVibeOrder,
  type ThoughtBubbleIdea,
} from '../data/thoughtBubbleIdeas'
import { savePendingLine } from '../utils/pendingLine'
import { PublicSiteFooter, PublicSiteHeader } from './PublicSiteChrome'

const exampleImages = [
  {
    src: '/demo/hero-pets/hero-pet-05.jpg',
    alt: 'Finished PetSays example of a dog thinking I expected better.',
    caption: 'Judging, but with excellent posture.',
    eager: true,
  },
  {
    src: '/demo/hero-pets/hero-pet-06.jpg',
    alt: 'Finished PetSays example of a cat thinking I have questions.',
    caption: 'Suspicious is a lifestyle.',
    eager: false,
  },
  {
    src: '/demo/hero-pets/hero-pet-03.jpg',
    alt: 'Finished PetSays example of a golden dog thinking We’re going WHERE?',
    caption: 'Excited before the details arrive.',
    eager: false,
  },
  {
    src: '/demo/hero-pets/hero-pet-04.jpg',
    alt: 'Finished PetSays example of a dog thinking I haven’t eaten in minutes.',
    caption: 'Hungry, in a very calm way.',
    eager: false,
  },
]

function IdeaCard({
  idea,
  copied,
  onCopy,
}: {
  idea: ThoughtBubbleIdea
  copied: boolean
  onCopy: (idea: ThoughtBubbleIdea) => void
}) {
  const vibe = getVibe(idea.vibeId)

  return (
    <article
      className="idea-card"
      style={{ '--idea-accent': vibe.color, '--idea-tint': vibe.tint } as CSSProperties}
    >
      <p className="idea-line">{idea.text}</p>
      <div className="idea-card-actions">
        <a
          className="idea-use-link"
          href="/#make-image"
          onClick={() => savePendingLine(idea)}
        >
          Use this line
        </a>
        <button
          type="button"
          className="idea-copy-button"
          onClick={() => onCopy(idea)}
          aria-label={`${copied ? 'Copied' : 'Copy'} line: ${idea.text}`}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </article>
  )
}

export function PetThoughtBubbleIdeasPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [openVibeId, setOpenVibeId] = useState<VibeId | null>('hungry')
  const copyResetTimerRef = useRef<number | null>(null)
  const vibeSectionRefs = useRef<Partial<Record<VibeId, HTMLElement | null>>>({})

  const openVibe = useCallback((vibeId: VibeId, shouldScroll = false) => {
    setOpenVibeId(vibeId)

    if (!shouldScroll) return

    window.requestAnimationFrame(() => {
      vibeSectionRefs.current[vibeId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }, [])

  const toggleVibe = useCallback((vibeId: VibeId) => {
    setOpenVibeId((current) => current === vibeId ? null : vibeId)
  }, [])

  const handleCopy = useCallback(async (idea: ThoughtBubbleIdea) => {
    if (!navigator.clipboard?.writeText) return

    try {
      await navigator.clipboard.writeText(idea.text)
      setCopiedId(idea.id)
      if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current)
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedId((current) => current === idea.id ? null : current)
      }, 1400)
    } catch {
      setCopiedId(null)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current)
    }
  }, [])

  return (
    <div className="app-shell ideas-page">
      <PublicSiteHeader />

      <main id="top" className="ideas-main">
        <section className="ideas-intro" aria-labelledby="ideas-title">
          <div className="ideas-intro-copy">
            <p className="eyebrow">Pet thought bubble ideas</p>
            <h1 id="ideas-title">Funny things your pet could be thinking</h1>
            <p className="ideas-intro-text">
              Your pet already has the expression. Pick a short, made-up thought that matches the mood—hungry, guilty, dramatic, sleepy, suspicious, or somewhere in between.
            </p>
            <a className="ideas-primary-cta" href="/#make-image">Make an image with PetSays <span aria-hidden="true">→</span></a>
          </div>

          <figure className="ideas-lead-example">
            <img
              src={exampleImages[0].src}
              alt={exampleImages[0].alt}
              width="1672"
              height="941"
              loading="eager"
              decoding="async"
            />
            <figcaption>{exampleImages[0].caption}</figcaption>
          </figure>
        </section>

        <nav className="ideas-vibe-nav" aria-label="Browse thought bubble ideas by vibe">
          <span className="ideas-nav-label">Browse by mood</span>
          <div className="ideas-vibe-chips">
            {thoughtBubbleVibeOrder.map((vibeId) => (
              <a
                href={`#ideas-${vibeId}`}
                key={vibeId}
                onClick={(event) => {
                  event.preventDefault()
                  openVibe(vibeId, true)
                }}
              >
                {getVibe(vibeId).label}
              </a>
            ))}
          </div>
        </nav>

        <section className="ideas-collection" aria-labelledby="collection-title">
          <div className="ideas-section-heading">
            <div>
              <p className="eyebrow">32 lines, eight moods</p>
              <h2 id="collection-title">Find the thought that fits the photo</h2>
            </div>
            <p>Use one as-is, copy it for later, or make it yours.</p>
          </div>

          <div className="ideas-vibe-sections">
            {thoughtBubbleVibeOrder.map((vibeId) => {
              const vibe = getVibe(vibeId)
              const ideas = getThoughtBubbleIdeasForVibe(vibeId)

              return (
                <section
                  ref={(node) => { vibeSectionRefs.current[vibeId] = node }}
                  className={openVibeId === vibeId ? 'ideas-vibe-section is-open' : 'ideas-vibe-section'}
                  id={`ideas-${vibeId}`}
                  key={vibeId}
                  aria-labelledby={`ideas-${vibeId}-title`}
                >
                  <div className="ideas-vibe-heading">
                    <div>
                      <p className="eyebrow">{vibe.label}</p>
                      <h3 id={`ideas-${vibeId}-title`}>{thoughtBubbleVibeNotes[vibeId]}</h3>
                    </div>
                    <button
                      type="button"
                      className="ideas-vibe-toggle"
                      aria-expanded={openVibeId === vibeId}
                      aria-controls={`ideas-${vibeId}-panel`}
                      aria-label={`${openVibeId === vibeId ? 'Collapse' : 'Expand'} ${vibe.label} ideas`}
                      onClick={() => toggleVibe(vibeId)}
                    >
                      <span className="ideas-vibe-count">{ideas.length} ideas</span>
                      <span className="ideas-vibe-indicator" aria-hidden="true">{openVibeId === vibeId ? '↑' : '↓'}</span>
                    </button>
                  </div>
                  <div
                    id={`ideas-${vibeId}-panel`}
                    className="ideas-vibe-panel"
                    hidden={openVibeId !== vibeId}
                  >
                    <div className="ideas-card-grid">
                      {ideas.map((idea) => (
                        <IdeaCard
                          idea={idea}
                          copied={copiedId === idea.id}
                          onCopy={handleCopy}
                          key={idea.id}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
        </section>

        <section className="ideas-examples" aria-labelledby="examples-title">
          <div className="ideas-section-heading">
            <div>
              <p className="eyebrow">Made with PetSays</p>
              <h2 id="examples-title">A line is better when you can see it.</h2>
            </div>
            <p>These are finished thought bubbles made from ordinary pet photos.</p>
          </div>
          <div className="ideas-example-grid">
            {exampleImages.slice(1).map((example) => (
              <figure className="ideas-example-card" key={example.src}>
                <img
                  src={example.src}
                  alt={example.alt}
                  width="1672"
                  height="941"
                  loading={example.eager ? 'eager' : 'lazy'}
                  decoding="async"
                />
                <figcaption>{example.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="ideas-tips" aria-labelledby="tips-title">
          <div className="ideas-section-heading">
            <div>
              <p className="eyebrow">Quick rules for a good bubble</p>
              <h2 id="tips-title">Keep the joke short.</h2>
            </div>
          </div>
          <ol>
            <li><strong>Match the face.</strong> A serious stare can carry a very unserious line.</li>
            <li><strong>Choose one idea.</strong> Short lines read better inside a thought bubble.</li>
            <li><strong>Leave room for the photo.</strong> The best joke still lets the pet be the star.</li>
          </ol>
        </section>

        <section className="ideas-how-it-works" aria-labelledby="how-title">
          <div className="ideas-section-heading">
            <div>
              <p className="eyebrow">How PetSays works</p>
              <h2 id="how-title">From photo to opinion in three tiny moves.</h2>
            </div>
          </div>
          <ol className="ideas-how-steps">
            <li><span>01</span><strong>Upload a photo</strong><small>Choose the face with something to say.</small></li>
            <li><span>02</span><strong>Pick a line</strong><small>Start with a vibe or use one from this page.</small></li>
            <li><span>03</span><strong>Download the joke</strong><small>Adjust the bubble, then save or share it.</small></li>
          </ol>
        </section>

        <section className="ideas-final-cta" aria-labelledby="final-cta-title">
          <p className="eyebrow">Ready when your pet is</p>
          <h2 id="final-cta-title">Give that expression a thought bubble.</h2>
          <a className="ideas-primary-cta" href="/#make-image">Make an image with PetSays <span aria-hidden="true">→</span></a>
          <p>No signup. Just upload a photo and make it funny.</p>
        </section>
      </main>

      <PublicSiteFooter />

      <span className="visually-hidden" aria-live="polite">
        {copiedId ? 'Line copied.' : ''}
      </span>
    </div>
  )
}
