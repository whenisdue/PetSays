import type { MouseEventHandler } from 'react'

type PublicSiteHeaderProps = {
  onHome?: MouseEventHandler<HTMLAnchorElement>
  showHomeNav?: boolean
}

export function PublicSiteHeader({ onHome, showHomeNav = false }: PublicSiteHeaderProps) {
  return (
    <header className={showHomeNav ? 'site-header site-header-home' : 'site-header'}>
      <a className="wordmark" href="/" onClick={onHome} aria-label="PetSays home">
        <span>PetSays</span>
      </a>
      {showHomeNav && (
        <nav className="home-nav" aria-label="Homepage">
          <a className="is-active" href="#today">Today</a>
          <a href="#make-your-own">Make Your Own</a>
          <a href="#browse">Browse</a>
        </nav>
      )}
      <span className="header-note">Small tool. Big opinions.</span>
    </header>
  )
}

export function PublicSiteFooter() {
  return (
    <footer className="site-footer">
      <span>PetSays</span>
      <nav className="site-footer-links" aria-label="Legal">
        <a href="/privacy/">Privacy</a>
        <a href="/terms/">Terms</a>
      </nav>
      <span>Small tool. Big opinions.</span>
    </footer>
  )
}
