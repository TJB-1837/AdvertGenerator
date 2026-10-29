import { build } from 'vite'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { publicRoutes, siteUrl } from '../src/lib/public-content.js'
import { renderHead } from '../src/lib/seo.js'


await build()
const template = await readFile('dist/index.html', 'utf8')
const serverDirectory = resolve('dist/.prerender')
try {
  await build({ build: { ssr: 'src/entry-server.jsx', outDir: serverDirectory, emptyOutDir: true } })
  const { render } = await import(pathToFileURL(resolve(serverDirectory, 'entry-server.js')))
  for (const [path, page] of Object.entries(publicRoutes)) {
    const directory = path === '/' ? 'dist' : `dist${path}`
    await mkdir(directory, { recursive: true })
    await writeFile(`${directory}/index.html`, template.replace('<!--page-head-->', renderHead(path, page)).replace('<div id="root"></div>', `<div id="root">${render(path)}</div>`))
  }
  await mkdir('dist/app', { recursive: true })
  await writeFile('dist/app/index.html', template.replace('<!--page-head-->', renderHead('/app', { title: 'Your Workspace | Adrafteo', description: 'Sign in to your personal Adrafteo workspace.', noindex: true })))
  await writeFile('dist/404.html', template.replace('<!--page-head-->', renderHead('/404', { title: 'Page Not Found | Adrafteo', description: 'This page could not be found.', noindex: true })).replace('<div id="root"></div>', `<div id="root">${render('/404')}</div>`))
  const urls = Object.entries(publicRoutes).filter(([, page]) => !page.noindex).map(([path]) => `  <url><loc>${siteUrl}${path}</loc></url>`).join('\n')
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
  console.log(`Pre-rendered ${Object.keys(publicRoutes).length} public pages, workspace shell and 404.`)
} finally {
  // Fixed build-only directory: never publish server modules.
  await rm(serverDirectory, { recursive: true, force: true })
}
