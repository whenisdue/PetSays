import { StrictMode, type ReactNode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '@fontsource/fredoka/latin-700.css'
import './index.css'
import './App.css'

const root = document.getElementById('root')!
const pagePath = window.location.pathname.replace(/\/+$/, '') || '/'
const dailyStoryDateKey = document.querySelector('meta[name="petsays-daily-date"]')?.getAttribute('content') ?? undefined

function mountApp(app: ReactNode, shouldHydrate = true) {
  if (shouldHydrate && root.hasChildNodes()) {
    hydrateRoot(root, app)
  } else {
    createRoot(root).render(app)
  }
}

if (pagePath === '/pet-thought-bubble-ideas') {
  void import('./IdeasPageApp').then(({ IdeasPageApp }) => {
    mountApp(
      <StrictMode>
        <IdeasPageApp />
      </StrictMode>,
    )
  })
} else if (pagePath === '/privacy' || pagePath === '/terms') {
  void import('./LegalPageApp').then(({ LegalPageApp }) => {
    mountApp(
      <StrictMode>
        <LegalPageApp page={pagePath === '/privacy' ? 'privacy' : 'terms'} />
      </StrictMode>,
    )
  })
} else if (pagePath === '/stories') {
  void import('./StoriesApp').then(({ StoriesApp }) => {
    mountApp(
      <StrictMode>
        <StoriesApp />
      </StrictMode>,
      false,
    )
  })
} else {
  void import('./ClientApp').then(({ ClientApp }) => {
    mountApp(
      <StrictMode>
        <ClientApp dailyStoryDateKey={dailyStoryDateKey} />
      </StrictMode>,
    )
  })
}
