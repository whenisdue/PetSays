import { renderToString } from 'react-dom/server'
import { PublicHome } from './components/PublicHome'

export function renderPublicHome() {
  return renderToString(<PublicHome />)
}
