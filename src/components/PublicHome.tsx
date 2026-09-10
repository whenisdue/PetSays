import type {
  ChangeEventHandler,
  MouseEventHandler,
  RefObject,
} from 'react'
import { HeroDemo, HeroSteps, HeroUploadRail } from './ExampleCarousel'
import { DecorativeSpots } from './DecorativeSpots'

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
      <header className="site-header">
        <a className="wordmark" href="/" onClick={onHome} aria-label="PetSays home">
          <span>PetSays</span>
        </a>
        <span className="header-note">Small tool. Big opinions.</span>
      </header>

      <main id="top">
        <section className="intro-hero" aria-labelledby="hero-title">
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
      </main>

      <footer className="site-footer">
        <span>PetSays</span>
        <span>Small tool. Big opinions.</span>
      </footer>
    </div>
  )
}
