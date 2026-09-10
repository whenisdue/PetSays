import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import react from '@vitejs/plugin-react'
import { build } from 'vite'

const projectRoot = process.cwd()
const serverOutDir = await mkdtemp(join(projectRoot, '.petsays-ssr-'))

try {
  await build({
    configFile: false,
    root: projectRoot,
    plugins: [react()],
    build: {
      ssr: resolve(projectRoot, 'src/entry-server.tsx'),
      outDir: serverOutDir,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: 'entry-server.mjs',
          format: 'es',
        },
      },
    },
  })

  const serverEntry = await import(
    pathToFileURL(resolve(serverOutDir, 'entry-server.mjs')).href
  )
  const renderedHome = serverEntry.renderPublicHome()
  const rootMarkupStart = renderedHome.indexOf('<div class="app-shell">')
  const htmlPath = resolve(projectRoot, 'dist/index.html')
  const html = await readFile(htmlPath, 'utf8')
  const rootMarker = '<div id="root"></div>'

  if (rootMarkupStart === -1) {
    throw new Error('Could not find the rendered homepage root markup')
  }

  if (!html.includes(rootMarker)) {
    throw new Error(`Could not find ${rootMarker} in ${htmlPath}`)
  }

  const renderedPrelude = renderedHome.slice(0, rootMarkupStart)
  const renderedRoot = renderedHome.slice(rootMarkupStart)
  const htmlWithPrelude = html.replace('</head>', `${renderedPrelude}</head>`)

  await writeFile(
    htmlPath,
    htmlWithPrelude.replace(rootMarker, `<div id="root">${renderedRoot}</div>`),
  )
} finally {
  await rm(serverOutDir, { recursive: true, force: true })
}
