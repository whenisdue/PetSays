import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import react from '@vitejs/plugin-react'
import { build } from 'vite'

const projectRoot = process.cwd()
const serverOutDir = await mkdtemp(join(projectRoot, '.petsays-ssr-'))

const publicPages = [
  { render: 'renderPublicHome', outputPath: 'index.html' },
  {
    render: 'renderPublicIdeas',
    outputPath: 'pet-thought-bubble-ideas/index.html',
    metadataExport: 'ideasPageMetadata',
  },
  {
    render: 'renderPublicPrivacy',
    outputPath: 'privacy/index.html',
    metadataExport: 'privacyPageMetadata',
  },
  {
    render: 'renderPublicTerms',
    outputPath: 'terms/index.html',
    metadataExport: 'termsPageMetadata',
  },
]

function escapeAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function replaceHeadTag(html, expression, replacement, label) {
  if (!expression.test(html)) throw new Error(`Could not replace ${label} in the HTML template`)
  const nextHtml = html.replace(expression, replacement)
  return nextHtml
}

function applyPageMetadata(html, metadata) {
  let nextHtml = html
  const title = escapeAttribute(metadata.title)
  const description = escapeAttribute(metadata.description)
  const canonical = escapeAttribute(metadata.canonical)
  const ogImage = escapeAttribute(metadata.ogImage)
  const ogImageAlt = escapeAttribute(metadata.ogImageAlt)

  nextHtml = replaceHeadTag(nextHtml, /<title>[^<]*<\/title>/, `<title>${title}</title>`, 'title')
  nextHtml = replaceHeadTag(nextHtml, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`, 'description')
  nextHtml = replaceHeadTag(nextHtml, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`, 'canonical')
  nextHtml = replaceHeadTag(nextHtml, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`, 'og:title')
  nextHtml = replaceHeadTag(nextHtml, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`, 'og:description')
  nextHtml = replaceHeadTag(nextHtml, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonical}" />`, 'og:url')
  nextHtml = replaceHeadTag(nextHtml, /<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${ogImage}" />`, 'og:image')
  nextHtml = replaceHeadTag(nextHtml, /<meta property="og:image:alt" content="[^"]*" \/>/, `<meta property="og:image:alt" content="${ogImageAlt}" />`, 'og:image:alt')
  nextHtml = replaceHeadTag(nextHtml, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${title}" />`, 'twitter:title')
  nextHtml = replaceHeadTag(nextHtml, /<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${description}" />`, 'twitter:description')
  nextHtml = replaceHeadTag(nextHtml, /<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${ogImage}" />`, 'twitter:image')
  nextHtml = replaceHeadTag(nextHtml, /<meta name="twitter:image:alt" content="[^"]*" \/>/, `<meta name="twitter:image:alt" content="${ogImageAlt}" />`, 'twitter:image:alt')

  if (metadata.robots) {
    nextHtml = nextHtml.replace('</head>', `    <meta name="robots" content="${escapeAttribute(metadata.robots)}" />\n  </head>`)
  }

  return nextHtml
}

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
  const htmlPath = resolve(projectRoot, 'dist/index.html')
  const html = await readFile(htmlPath, 'utf8')
  const rootMarker = '<div id="root"></div>'

  if (!html.includes(rootMarker)) {
    throw new Error(`Could not find ${rootMarker} in ${htmlPath}`)
  }

  for (const page of publicPages) {
    const renderedPage = serverEntry[page.render]()
    const rootMarkupStart = renderedPage.indexOf('<div class="')
    if (rootMarkupStart === -1) throw new Error(`Could not find rendered root markup for ${page.outputPath}`)

    const renderedPrelude = renderedPage.slice(0, rootMarkupStart)
    const renderedRoot = renderedPage.slice(rootMarkupStart)
    const pageTemplate = page.metadataExport
      ? applyPageMetadata(html, serverEntry[page.metadataExport])
      : html
    const htmlWithPrelude = pageTemplate.replace('</head>', `${renderedPrelude}</head>`)
    const outputPath = resolve(projectRoot, 'dist', page.outputPath)

    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(
      outputPath,
      htmlWithPrelude.replace(rootMarker, `<div id="root">${renderedRoot}</div>`),
    )
  }
} finally {
  await rm(serverOutDir, { recursive: true, force: true })
}
