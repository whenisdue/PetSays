import JSZip from 'jszip'
import { bubbleConnectorSvg, resolveConnectorGeometry, type BubbleBox, type ConnectorTarget, type CurveDirection } from './bubbleConnector'
import { bubbleBodySvg } from './bubbleShell'
import { canvasToJpegBlob, drawCoverImage, drawPetSaysBrandMark, loadCanvasImage, wrapCanvasText } from './canvasExport'

export const storyExportWidth = 1080
export const storyExportHeight = 1920
export const storyExportQuality = 0.92

export type StoryExportTextStyle = {
  color: string
  fontFamily: string
  fontSize: number
  fontWeight: string
  lineHeight: number
  paddingLeft: number
  paddingRight: number
}

export type StoryExportFrame = {
  bubble: BubbleBox
  bubbleScale: number
  connectorTarget: ConnectorTarget
  curveDirection: CurveDirection
  slideWidth: number
  text: string
  textBox: BubbleBox
  textStyle: StoryExportTextStyle
}

export function getStoryExportFilename(index: number) {
  return `petsays-story-${String(index + 1).padStart(2, '0')}.jpg`
}

async function drawSvgImage(
  context: CanvasRenderingContext2D,
  svg: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const image = await loadCanvasImage(svgUrl)
    context.drawImage(image, x, y, width, height)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

function drawStoryWash(context: CanvasRenderingContext2D) {
  const wash = context.createLinearGradient(0, 0, 0, storyExportHeight)
  wash.addColorStop(0, 'rgba(32, 31, 28, 0.12)')
  wash.addColorStop(0.38, 'rgba(32, 31, 28, 0)')
  wash.addColorStop(1, 'rgba(32, 31, 28, 0.08)')
  context.fillStyle = wash
  context.fillRect(0, 0, storyExportWidth, storyExportHeight)
}

function drawStoryFrameCounter(
  context: CanvasRenderingContext2D,
  index: number,
  total: number,
) {
  const text = `${index + 1} / ${total}`
  const fontSize = 26
  const horizontalPadding = 20
  const verticalPadding = 11
  const height = fontSize + verticalPadding * 2
  const x = 42
  const y = storyExportHeight - 42 - height

  context.save()
  context.font = `700 ${fontSize}px Fredoka, sans-serif`
  const width = context.measureText(text).width + horizontalPadding * 2
  context.beginPath()
  context.moveTo(x + height / 2, y)
  context.lineTo(x + width - height / 2, y)
  context.arc(x + width - height / 2, y + height / 2, height / 2, -Math.PI / 2, Math.PI / 2)
  context.lineTo(x + height / 2, y + height)
  context.arc(x + height / 2, y + height / 2, height / 2, Math.PI / 2, Math.PI * 1.5)
  context.closePath()
  context.fillStyle = 'rgba(32, 31, 28, 0.78)'
  context.fill()
  context.fillStyle = '#fffdf8'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, x + width / 2, y + height / 2 + 1)
  context.restore()
}

function drawStoryText(
  context: CanvasRenderingContext2D,
  frame: StoryExportFrame,
) {
  const viewportScale = storyExportWidth / Math.max(frame.slideWidth, 1)
  const fontSize = frame.textStyle.fontSize * frame.bubbleScale * viewportScale
  const paddingLeft = frame.textStyle.paddingLeft * frame.bubbleScale * viewportScale
  const paddingRight = frame.textStyle.paddingRight * frame.bubbleScale * viewportScale
  const lineHeight = frame.textStyle.lineHeight * frame.bubbleScale * viewportScale
  const textX = (frame.textBox.x + frame.textBox.width / 2) * storyExportWidth
  const textY = (frame.textBox.y + frame.textBox.height / 2) * storyExportHeight
  const textWidth = Math.max(
    1,
    frame.textBox.width * storyExportWidth - paddingLeft - paddingRight,
  )

  context.save()
  context.fillStyle = frame.textStyle.color
  context.font = `${frame.textStyle.fontWeight} ${fontSize}px ${frame.textStyle.fontFamily}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  const lines = wrapCanvasText(context, frame.text, textWidth)
  const totalHeight = lines.length * lineHeight
  const firstY = textY - totalHeight / 2 + lineHeight / 2
  lines.forEach((line, index) => context.fillText(line, textX, firstY + index * lineHeight))
  context.restore()
}

export async function createStoryImageBlobs(
  photoSrc: string,
  frames: StoryExportFrame[],
  logoSrc = '/brand/petsays-wordmark.png',
) {
  if (frames.length === 0) throw new Error('There are no Story frames to export.')

  await document.fonts.ready
  const [photo, logo] = await Promise.all([
    loadCanvasImage(photoSrc),
    loadCanvasImage(logoSrc),
  ])

  const blobs: Blob[] = []
  for (const [index, frame] of frames.entries()) {
    const canvas = document.createElement('canvas')
    canvas.width = storyExportWidth
    canvas.height = storyExportHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to prepare the Story canvas.')

    context.fillStyle = '#e8e0d6'
    context.fillRect(0, 0, storyExportWidth, storyExportHeight)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    drawCoverImage(context, photo, storyExportWidth, storyExportHeight)
    drawStoryWash(context)

    const connectorGeometry = resolveConnectorGeometry(
      'thought',
      frame.bubble,
      frame.connectorTarget,
      storyExportWidth,
      storyExportHeight,
      frame.curveDirection,
    )
    await drawSvgImage(
      context,
      bubbleConnectorSvg(connectorGeometry, storyExportWidth, storyExportHeight),
      0,
      0,
      storyExportWidth,
      storyExportHeight,
    )

    await drawSvgImage(
      context,
      bubbleBodySvg(
        'thought',
        frame.bubble.width * storyExportWidth,
        frame.bubble.height * storyExportHeight,
      ),
      frame.bubble.x * storyExportWidth,
      frame.bubble.y * storyExportHeight,
      frame.bubble.width * storyExportWidth,
      frame.bubble.height * storyExportHeight,
    )
    drawStoryText(context, frame)
    drawStoryFrameCounter(context, index, frames.length)
    drawPetSaysBrandMark(context, storyExportWidth, storyExportHeight, logo)
    blobs.push(await canvasToJpegBlob(canvas, storyExportQuality))
  }

  return blobs
}

export function createStoryFiles(blobs: Blob[]) {
  return blobs.map((blob, index) => new File([blob], getStoryExportFilename(index), { type: 'image/jpeg' }))
}

export async function createStoryZip(files: File[]) {
  const zip = new JSZip()
  files.forEach((file) => zip.file(file.name, file))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' })
}
