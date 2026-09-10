import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import '@fontsource/fredoka/latin-700.css'
import './index.css'
import './App.css'
import { ClientApp } from './ClientApp'

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <ClientApp />
  </StrictMode>,
)
