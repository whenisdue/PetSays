import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import '@fontsource/fredoka/latin-700.css'
import './index.css'
import './App.css'

const root = document.getElementById('root')!
const pagePath = window.location.pathname.replace(/\/+$/, '') || '/'

if (pagePath === '/pet-thought-bubble-ideas') {
  void import('./IdeasPageApp').then(({ IdeasPageApp }) => {
    hydrateRoot(
      root,
      <StrictMode>
        <IdeasPageApp />
      </StrictMode>,
    )
  })
} else if (pagePath === '/privacy' || pagePath === '/terms') {
  void import('./LegalPageApp').then(({ LegalPageApp }) => {
    hydrateRoot(
      root,
      <StrictMode>
        <LegalPageApp page={pagePath === '/privacy' ? 'privacy' : 'terms'} />
      </StrictMode>,
    )
  })
} else {
  void import('./ClientApp').then(({ ClientApp }) => {
    hydrateRoot(
      root,
      <StrictMode>
        <ClientApp />
      </StrictMode>,
    )
  })
}
