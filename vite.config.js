import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { publicRoutes } from './src/lib/public-content.js'
import { renderHead } from './src/lib/seo.js'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'

const privatePage = { title: 'Your Workspace | Adrafteo', description: 'Sign in to your personal Adrafteo workspace.', noindex: true }
const missingPage = { title: 'Page Not Found | Adrafteo', description: 'This page could not be found.', noindex: true }

export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: Boolean(process.env.PORT),
  },
  plugins: [react(), {
    name: 'public-page-metadata',
    apply: 'serve',
    transformIndexHtml(html, context) {
      const path = new URL(context.path, 'http://localhost').pathname.replace(/\/+$/, '') || '/'
      return html.replace('<!--page-head-->', renderHead(path, publicRoutes[path] || (path === '/app' ? privatePage : missingPage)))
    },
    configurePreviewServer(server) {
      const output = resolve(server.config.build.outDir)
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url, 'http://localhost')
        const path = url.pathname.replace(/\/+$/, '') || '/'
        if (Object.hasOwn(publicRoutes, path) || path === '/app') {
          request.url = `${path === '/' ? '' : path}/index.html${url.search}`
          if (path === '/app') response.setHeader('X-Robots-Tag', 'noindex, follow')
        } else {
          const file = resolve(output, `.${url.pathname}`)
          if (!file.startsWith(output + sep) || !existsSync(file) || !statSync(file).isFile()) {
            response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
            response.end(readFileSync(resolve(output, '404.html')))
            return
          }
        }
        next()
      })
    },
  }],
})
