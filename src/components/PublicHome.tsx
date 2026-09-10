import type {
  ChangeEventHandler,
  MouseEventHandler,
  RefObject,
} from 'react'
import { HeroDemo, HeroSteps, HeroUploadRail } from './ExampleCarousel'
import { DecorativeSpots } from './DecorativeSpots'
import { PublicSiteFooter, PublicSiteHeader } from './PublicSiteChrome'

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
  return (
    <div className="app-shell">
      <PublicSiteHeader onHome={onHome} />

      <main id="top">
        <section id="make-image" className="intro-hero" aria-labelledby="hero-title">
          <div className="hero-action-panel">
            <DecorativeSpots page="landing" />
            <div className="hero-copy">
              <p className="eyebrow">A free pet thought bubble maker. No signup.</p>
              <h1 id="hero-title" className="hero-title">Make your pet talk.</h1>
              <p className="hero-subtitle">Upload a photo. Pick a vibe. Make it funny.</p>
            </div>
            <HeroUploadRail variant="desktop" />
            <HeroSteps variant="desktop" />
          </div>

          <HeroDemo onUpload={onUpload} />

          <HeroSteps variant="mobile" />

          <input
            ref={fileInputRef}
            id="photo-upload"
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={onFileChange}
            aria-label="Upload a pet photo"
          />
        </section>
        <p className="home-ideas-link">Need a line? <a href="/pet-thought-bubble-ideas/">Browse funny pet thought bubble ideas.</a></p>
      </main>

      <PublicSiteFooter />
    </div>
  )
}
