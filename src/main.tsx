import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import '@fontsource/fredoka/latin-700.css'
import './index.css'
import './App.css'
import { ClientApp } from './ClientApp'

const root = document.getElementById('root')!
const isIdeasPage = window.location.pathname.replace(/\/+$/, '') === '/pet-thought-bubble-ideas'

if (isIdeasPage) {
  void import('./IdeasPageApp').then(({ IdeasPageApp }) => {
    hydrateRoot(
      root,
      <StrictMode>
        <IdeasPageApp />
      </StrictMode>,
    )
  })
} else {
  hydrateRoot(
    root,
    <StrictMode>
      <ClientApp />
    </StrictMode>,
  )
}
