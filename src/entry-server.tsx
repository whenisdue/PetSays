import { renderToString } from 'react-dom/server'
import { IdeasPageApp } from './IdeasPageApp'
import { LegalPageApp } from './LegalPageApp'
import { PublicHome } from './components/PublicHome'
import { StoriesApp } from './StoriesApp'
import { getLocalDateKey } from './data/dailyStories'
import {
  ideasPageMetadata,
  privacyPageMetadata,
  termsPageMetadata,
} from './publicPageMetadata'

export function renderPublicHome(dailyStoryDateKey = getLocalDateKey()) {
  return renderToString(<PublicHome dailyStoryDateKey={dailyStoryDateKey} />)
}

export function getPublicHomeDateKey() {
  return getLocalDateKey()
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

export function renderPublicStories() {
  return renderToString(<StoriesApp />)
}

export { ideasPageMetadata, privacyPageMetadata, termsPageMetadata }
