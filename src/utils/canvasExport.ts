export function loadCanvasImage(source: string): Promise<HTMLImageElement> {
  const image = new window.Image()
  image.decoding = 'async'
  image.src = source

  return image.decode().then(() => image)
}

export function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
) {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  if (!sourceWidth || !sourceHeight) return

  const coverScale = Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight)
  const drawnWidth = sourceWidth * coverScale
  const drawnHeight = sourceHeight * coverScale

  context.drawImage(
    image,
    (canvasWidth - drawnWidth) / 2,
    (canvasHeight - drawnHeight) / 2,
    drawnWidth,
    drawnHeight,
  )
}

export function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const paragraphs = text.split('\n')
  const lines: string[] = []

  const splitLongWord = (word: string) => {
    const chunks: string[] = []
    let chunk = ''

    Array.from(word).forEach((character) => {
      const candidate = `${chunk}${character}`
      if (context.measureText(candidate).width <= maxWidth || !chunk) {
        chunk = candidate
      } else {
        chunks.push(chunk)
        chunk = character
      }
    })

    if (chunk) chunks.push(chunk)
    return chunks
  }

  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      return
    }

    let currentLine = ''

    words.forEach((word) => {
      if (context.measureText(word).width > maxWidth) {
        if (currentLine) {
          lines.push(currentLine)
          currentLine = ''
        }

        const chunks = splitLongWord(word)
        chunks.slice(0, -1).forEach((chunk) => lines.push(chunk))
        currentLine = chunks.at(-1) ?? ''
        return
      }

      const candidate = currentLine ? `${currentLine} ${word}` : word
      if (context.measureText(candidate).width <= maxWidth || !currentLine) {
        currentLine = candidate
      } else {
        lines.push(currentLine)
        currentLine = word
      }
    })

    if (currentLine) lines.push(currentLine)
  })

  return lines
}

export function drawPetSaysBrandMark(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  logoImage: HTMLImageElement,
) {
  const shortEdge = Math.min(canvasWidth, canvasHeight)
  const logoWidth = Math.max(160, Math.min(300, Math.round(shortEdge * 0.17)))
  const logoHeight = Math.max(1, Math.round(logoWidth * logoImage.naturalHeight / logoImage.naturalWidth))
  const horizontalPadding = Math.round(logoHeight * 0.42)
  const verticalPadding = Math.round(logoHeight * 0.3)
  const cornerRadius = Math.min(
    (logoHeight + verticalPadding * 2) / 2,
    logoHeight * 0.64,
  )
  const edgeInset = Math.max(12, shortEdge * 0.024)
  const pillWidth = logoWidth + horizontalPadding * 2
  const pillHeight = logoHeight + verticalPadding * 2
  const x = canvasWidth - edgeInset - pillWidth
  const y = canvasHeight - edgeInset - pillHeight

  const logoCanvas = document.createElement('canvas')
  logoCanvas.width = logoWidth
  logoCanvas.height = logoHeight
  const logoContext = logoCanvas.getContext('2d')
  if (!logoContext) return

  logoContext.imageSmoothingEnabled = true
  logoContext.imageSmoothingQuality = 'high'
  logoContext.drawImage(logoImage, 0, 0, logoWidth, logoHeight)
  logoContext.globalCompositeOperation = 'source-in'
  logoContext.fillStyle = 'rgba(255, 253, 248, 0.98)'
  logoContext.fillRect(0, 0, logoWidth, logoHeight)

  context.save()

  context.beginPath()
  context.moveTo(x + cornerRadius, y)
  context.lineTo(x + pillWidth - cornerRadius, y)
  context.quadraticCurveTo(x + pillWidth, y, x + pillWidth, y + cornerRadius)
  context.lineTo(x + pillWidth, y + pillHeight - cornerRadius)
  context.quadraticCurveTo(
    x + pillWidth,
    y + pillHeight,
    x + pillWidth - cornerRadius,
    y + pillHeight,
  )
  context.lineTo(x + cornerRadius, y + pillHeight)
  context.quadraticCurveTo(x, y + pillHeight, x, y + pillHeight - cornerRadius)
  context.lineTo(x, y + cornerRadius)
  context.quadraticCurveTo(x, y, x + cornerRadius, y)
  context.closePath()

  context.fillStyle = 'rgba(32, 31, 28, 0.68)'
  context.fill()
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(logoCanvas, x + horizontalPadding, y + verticalPadding, logoWidth, logoHeight)
  context.restore()
}

export function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Unable to create the PetSays image.'))
      },
      'image/jpeg',
      quality,
    )
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = downloadUrl
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
}
