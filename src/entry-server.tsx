import { renderToString } from 'react-dom/server'
import { IdeasPageApp } from './IdeasPageApp'
import { PublicHome } from './components/PublicHome'
import { ideasPageMetadata } from './publicPageMetadata'

export function renderPublicHome() {
  return renderToString(<PublicHome />)
}

export function renderPublicIdeas() {
  return renderToString(<IdeasPageApp />)
}

export { ideasPageMetadata }
