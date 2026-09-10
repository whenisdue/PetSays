import type { MouseEventHandler } from 'react'

export function PublicSiteHeader({ onHome }: { onHome?: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <header className="site-header">
      <a className="wordmark" href="/" onClick={onHome} aria-label="PetSays home">
        <span>PetSays</span>
      </a>
      <span className="header-note">Small tool. Big opinions.</span>
    </header>
  )
}

export function PublicSiteFooter() {
  return (
    <footer className="site-footer">
      <span>PetSays</span>
      <span>Small tool. Big opinions.</span>
    </footer>
  )
}
