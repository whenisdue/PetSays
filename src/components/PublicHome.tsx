import { useCallback, useMemo, useState, type ChangeEventHandler, type CSSProperties, type MouseEventHandler, type RefObject } from 'react'
import { DailyStoryReader } from './DailyStoryReader'
import { PublicSiteFooter, PublicSiteHeader } from './PublicSiteChrome'
import { vibeHighlights } from '../data/dailyEpisodes'
import { dailyStories, getDailyStoryForDate, getDailyStoryForDateKey, getLocalDateKey, type DailyStory } from '../data/dailyStories'
import { getVibe } from '../data/presets'

type PublicHomeProps = {
  fileInputRef?: RefObject<HTMLInputElement | null>
  onFileChange?: ChangeEventHandler<HTMLInputElement>
  onHome?: MouseEventHandler<HTMLAnchorElement>
  onUpload?: () => void
  dailyStoryDateKey?: string
}

const noop = () => undefined
const storyDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function formatStoryDate(dateKey: string) {
  return storyDateFormatter.format(new Date(`${dateKey}T00:00:00Z`))
}

function getTomorrowDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return getLocalDateKey(new Date(year, month - 1, day + 1))
}

export function PublicHome({
  fileInputRef,
  onFileChange,
  onHome,
  onUpload = noop,
  dailyStoryDateKey,
}: PublicHomeProps) {
  const todayDateKey = dailyStoryDateKey ?? getLocalDateKey()
  const featuredStory = useMemo(
    () => dailyStoryDateKey
      ? getDailyStoryForDateKey(dailyStoryDateKey)
      : getDailyStoryForDate(),
    [dailyStoryDateKey],
  )
  const tomorrowStory = useMemo(
    () => dailyStories.find((story) => story.date === getTomorrowDateKey(todayDateKey)) ?? null,
    [todayDateKey],
  )
  const [readerStory, setReaderStory] = useState<DailyStory | null>(null)
  const closeReader = useCallback(() => setReaderStory(null), [])

  const recentStories = useMemo(
    () => featuredStory
      ? dailyStories
        .filter((story) => story.date < featuredStory.date)
        .sort((left, right) => right.date.localeCompare(left.date))
      : [],
    [featuredStory],
  )
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
                <h1 id="today-title">{featuredStory?.title ?? 'A story is on its way.'}</h1>
                <p className="today-subtitle">A fresh PetSays episode. New every day.</p>
              </div>
              <div className="today-actions">
                <button
                  type="button"
                  className="today-cta"
                  onClick={() => featuredStory && setReaderStory(featuredStory)}
                  disabled={!featuredStory}
                >
                  <span>Read today’s story</span>
                  <span aria-hidden="true">→</span>
                </button>
                <p className="today-freshness"><span aria-hidden="true">▣</span> New every day · Come back tomorrow</p>
              </div>
              {tomorrowStory && (
                <aside className="today-tomorrow" aria-label="Tomorrow on PetSays">
                  <p className="today-tomorrow-kicker">TOMORROW ON PETSAYS</p>
                  <strong className="today-tomorrow-title">{tomorrowStory.title}</strong>
                  <p className="today-tomorrow-note">A new tiny episode tomorrow. <span aria-hidden="true">→</span></p>
                </aside>
              )}
            </div>

            <div className="today-featured">
              <div className="today-featured-image">
                {featuredStory ? (
                  <>
                    <img
                      src={featuredStory.cover}
                      alt={featuredStory.alt}
                      width="1200"
                      height="1500"
                      fetchPriority="high"
                    />
                    <span className="today-stamp" aria-hidden="true">Today’s<br />PetSays</span>
                  </>
                ) : (
                  <p className="today-featured-empty">Today’s story is on its way.</p>
                )}
              </div>
            </div>

            {recentStories.length > 0 && (
              <section id="more-from-petsays" className="today-more" aria-labelledby="more-title">
                <div className="today-more-heading">
                  <div>
                    <p className="home-kicker">MORE FROM PETSAYS</p>
                    <h2 id="more-title">Previous PetSays Today episodes</h2>
                  </div>
                </div>

                {recentStories.length > 0 ? (
                  <div className="today-more-list" aria-label="Previous PetSays Today episodes">
                    {recentStories.map((story) => {
                      const vibe = getVibe(story.vibe)

                      return (
                        <button
                          key={story.date}
                          type="button"
                          className="today-more-card"
                          onClick={() => setReaderStory(story)}
                          aria-label={`Read ${story.title}`}
                        >
                          <span className="today-more-card-image">
                            <img src={story.cover} alt={story.alt} loading="lazy" width="640" height="420" />
                          </span>
                          <span className="today-more-card-copy">
                            <span className="today-more-card-vibe">{vibe.label}</span>
                            <strong>{story.title}</strong>
                            <time dateTime={story.date}>{formatStoryDate(story.date)}</time>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="today-more-empty" role="status">No earlier stories in this vibe yet.</p>
                )}
              </section>
            )}
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

            <a className="maker-story-link" href="/stories">
              <span className="maker-story-copy">
                <strong>Make a pet story</strong>
                <small>Turn one photo into 3–7 funny slides.</small>
              </span>
              <span className="maker-story-arrow" aria-hidden="true">→</span>
            </a>

            <p className="maker-home-trust">No signup · Free to use</p>

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
            <a className="home-quiet-link" href="/pet-thought-bubble-ideas/">
              See all vibes <span aria-hidden="true">→</span>
            </a>
          </div>

          <div className="vibe-highlights" role="list" aria-label="PetSays vibes">
            {vibeHighlights.map((highlight) => {
              const vibe = getVibe(highlight.id)
              return (
                <a
                  key={highlight.id}
                  className="vibe-highlight"
                  href={`/pet-thought-bubble-ideas/#ideas-${highlight.id}`}
                  style={{ '--vibe-tint': vibe.tint } as CSSProperties}
                >
                  <img src={highlight.image} alt="" loading="lazy" width="180" height="180" />
                  <span className="vibe-highlight-copy">
                    <strong>{vibe.label}</strong>
                    <small>{highlight.description}</small>
                  </span>
                  <span className="vibe-highlight-arrow" aria-hidden="true">→</span>
                </a>
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
      {readerStory && (
        <DailyStoryReader
          episode={readerStory}
          isOpen
          onClose={closeReader}
          onUpload={onUpload}
        />
      )}
    </div>
  )
}
