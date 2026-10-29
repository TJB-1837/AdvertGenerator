import { renderToString } from 'react-dom/server'
import { PublicSite } from './pages/PublicSite'

export function render(path) {
  return renderToString(<PublicSite path={path} />)
}
