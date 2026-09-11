import { renderToString } from 'react-dom/server'
import { IdeasPageApp } from './IdeasPageApp'
import { LegalPageApp } from './LegalPageApp'
import { PublicHome } from './components/PublicHome'
import {
  ideasPageMetadata,
  privacyPageMetadata,
  termsPageMetadata,
} from './publicPageMetadata'

export function renderPublicHome() {
  return renderToString(<PublicHome />)
}

export function renderPublicIdeas() {
  return renderToString(<IdeasPageApp />)
}

export function renderPublicPrivacy() {
  return renderToString(<LegalPageApp page="privacy" />)
}

export function renderPublicTerms() {
  return renderToString(<LegalPageApp page="terms" />)
}

export { ideasPageMetadata, privacyPageMetadata, termsPageMetadata }
