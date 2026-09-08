import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { BubbleGraphic } from './components/BubbleGraphic'
import { BubbleConnector } from './components/BubbleConnector'
import { ExampleCarousel } from './components/ExampleCarousel'
import { VibeArt } from './components/VibeArt'
import { getVibe, vibes, type BubbleKind, type Vibe, type VibeId } from './data/presets'
import {
  bubbleConnectorSvg,
  getDefaultCurveDirection,
  resolveConnectorGeometry,
  validateConnectorTarget,
  type BubbleBox,
  type ConnectorTarget,
  type CurveDirection,
} from './utils/bubbleConnector'
import { bubbleBodySvg } from './utils/bubbleShell'
import './App.css'

type LoadedPhoto = {
  src: string
  name: string
  naturalWidth: number
  naturalHeight: number
}

type Position = {
  x: number
  y: number
}

const initialPosition: Position = { x: 58, y: 34 }
const defaultConnectorTarget: ConnectorTarget = { x: 0.5, y: 0.72 }
const jpegExportQuality = 0.92

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getBubblePositionBounds(
  stageWidth: number,
  stageHeight: number,
  bubbleWidth?: number,
  bubbleHeight?: number,
) {
  const halfWidth = bubbleWidth ? (bubbleWidth / stageWidth) * 50 : 15
  const halfHeight = bubbleHeight ? (bubbleHeight / stageHeight) * 50 : 15

  return {
    minX: Math.min(halfWidth, 50),
    maxX: Math.max(100 - halfWidth, 50),
    minY: Math.min(halfHeight, 50),
    maxY: Math.max(100 - halfHeight, 50),
  }
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const paragraphs = text.split('\n')
  const lines: string[] = []

  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      return
    }

    let currentLine = ''
    words.forEach((word) => {
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

function App() {
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null)
  const [vibeId, setVibeId] = useState<VibeId | null>(null)
  const [lineIndex, setLineIndex] = useState(0)
  const [currentText, setCurrentText] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [bubbleKind, setBubbleKind] = useState<BubbleKind>('thought')
  const [connectorTarget, setConnectorTarget] = useState<ConnectorTarget>(defaultConnectorTarget)
  const [curveDirection, setCurveDirection] = useState<CurveDirection>(1)
  const [bubbleGeometry, setBubbleGeometry] = useState<BubbleBox | null>(null)
  const [position, setPosition] = useState<Position>(initialPosition)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingTarget, setIsDraggingTarget] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const stageHostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const bubbleGroupRef = useRef<HTMLDivElement>(null)
  const bubbleTextRef = useRef<HTMLSpanElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const photoUrlRef = useRef<string | null>(null)
  const dragPointerId = useRef<number | null>(null)
  const bubbleGrabOffsetRef = useRef<Position | null>(null)
  const targetPointerId = useRef<number | null>(null)
  const targetPointerStartRef = useRef<ConnectorTarget | null>(null)
  const targetPointerMovedRef = useRef(false)
  const targetDragThresholdRef = useRef(8)
  const curveDirectionInitializedRef = useRef(false)

  const selectedVibe = vibeId ? getVibe(vibeId) : null
  const resolvedConnector = useMemo(() => {
    if (
      !selectedVibe ||
      !currentText ||
      !bubbleGeometry ||
      !stageSize.width ||
      !stageSize.height
    ) {
      return null
    }

    return resolveConnectorGeometry(
      bubbleKind,
      bubbleGeometry,
      connectorTarget,
      stageSize.width,
      stageSize.height,
      curveDirection,
    )
  }, [
    selectedVibe,
    currentText,
    bubbleGeometry,
    stageSize.width,
    stageSize.height,
    bubbleKind,
    connectorTarget,
    curveDirection,
  ])
  const markCompositionDirty = useCallback(() => setDownloaded(false), [])

  useEffect(() => {
    if (!customOpen) return
    const frame = window.requestAnimationFrame(() => textAreaRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [customOpen])

  useEffect(() => {
    if (!photo || !stageHostRef.current) return

    const updateStageSize = () => {
      const hostWidth = stageHostRef.current?.clientWidth ?? 0
      if (!hostWidth) return
      const ratio = photo.naturalWidth / photo.naturalHeight
      const desktopHeightFloor = window.innerWidth >= 760 ? 430 : 0
      const maxHeight = Math.min(
        Math.max(window.innerHeight * 0.56, desktopHeightFloor),
        560,
      )
      const width = Math.min(hostWidth, maxHeight * ratio)
      setStageSize({ width, height: width / ratio })
      markCompositionDirty()
    }

    updateStageSize()
    const observer = new ResizeObserver(updateStageSize)
    observer.observe(stageHostRef.current)
    window.addEventListener('resize', updateStageSize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateStageSize)
    }
  }, [photo, markCompositionDirty])

  useEffect(() => {
    return () => {
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    }
  }, [])

  useLayoutEffect(() => {
    if (!photo || !vibeId || !stageRef.current || !bubbleGroupRef.current) {
      setBubbleGeometry(null)
      return
    }
    const stageRect = stageRef.current.getBoundingClientRect()
    const bubbleRect = bubbleGroupRef.current.getBoundingClientRect()
    const bounds = getBubblePositionBounds(stageRect.width, stageRect.height, bubbleRect.width, bubbleRect.height)
    const nextGeometry = {
      x: (bubbleRect.left - stageRect.left) / stageRect.width,
      y: (bubbleRect.top - stageRect.top) / stageRect.height,
      width: bubbleRect.width / stageRect.width,
      height: bubbleRect.height / stageRect.height,
    }
    const nextTarget = validateConnectorTarget(
      bubbleKind,
      connectorTarget,
      nextGeometry,
      stageRect.width,
      stageRect.height,
    )
    if (!curveDirectionInitializedRef.current) {
      curveDirectionInitializedRef.current = true
      setCurveDirection(
        getDefaultCurveDirection(
          bubbleKind,
          nextGeometry,
          nextTarget,
          stageRect.width,
          stageRect.height,
        ),
      )
    }
    setBubbleGeometry((current) => {
      if (
        current &&
        current.x === nextGeometry.x &&
        current.y === nextGeometry.y &&
        current.width === nextGeometry.width &&
        current.height === nextGeometry.height
      ) return current
      return nextGeometry
    })
    setPosition((current) => {
      const next = {
        x: clamp(current.x, bounds.minX, bounds.maxX),
        y: clamp(current.y, bounds.minY, bounds.maxY),
      }
      return next.x === current.x && next.y === current.y ? current : next
    })
    if (
      Math.abs(nextTarget.x - connectorTarget.x) > 0.00001 ||
      Math.abs(nextTarget.y - connectorTarget.y) > 0.00001
    ) {
      setConnectorTarget(nextTarget)
      markCompositionDirty()
    }
  }, [photo, vibeId, currentText, bubbleKind, connectorTarget, position.x, position.y, stageSize.width, stageSize.height, markCompositionDirty])

  const handleHome = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current)
      photoUrlRef.current = null
    }
    resetForNewPhoto()
    setPhoto(null)
    setStageSize({ width: 0, height: 0 })
    setIsDragging(false)
    setIsDraggingTarget(false)
    dragPointerId.current = null
    bubbleGrabOffsetRef.current = null
    targetPointerId.current = null
    targetPointerStartRef.current = null
    targetPointerMovedRef.current = false
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  const resetForNewPhoto = () => {
    setVibeId(null)
    setLineIndex(0)
    setCurrentText('')
    setCustomOpen(false)
    setBubbleKind('thought')
    setConnectorTarget(defaultConnectorTarget)
    setCurveDirection(1)
    curveDirectionInitializedRef.current = false
    setBubbleGeometry(null)
    setPosition(initialPosition)
    setDownloaded(false)
  }

  const handleFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return

    const src = URL.createObjectURL(file)
    const image = new window.Image()
    image.onload = () => {
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
      photoUrlRef.current = src
      setPhoto({
        src,
        name: file.name,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      })
      resetForNewPhoto()
    }
    image.onerror = () => URL.revokeObjectURL(src)
    image.src = src
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleVibe = (vibe: Vibe) => {
    setVibeId(vibe.id)
    setLineIndex(0)
    setCurrentText(vibe.lines[0])
    setCustomOpen(false)
    setBubbleKind(vibe.defaultBubble)
    setConnectorTarget(defaultConnectorTarget)
    setCurveDirection(1)
    curveDirectionInitializedRef.current = false
    setBubbleGeometry(null)
    setPosition(initialPosition)
    setDownloaded(false)
  }

  const chooseLine = (index: number) => {
    if (!selectedVibe) return
    setLineIndex(index)
    setCurrentText(selectedVibe.lines[index])
    setCustomOpen(false)
    setDownloaded(false)
  }

  const handleAnother = () => {
    if (!selectedVibe) return
    const nextIndex = (lineIndex + 1) % selectedVibe.lines.length
    chooseLine(nextIndex)
  }

  const updateBubblePosition = useCallback((centerX: number, centerY: number) => {
    if (!stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const bubbleRect = bubbleGroupRef.current?.getBoundingClientRect()
    const bounds = getBubblePositionBounds(rect.width, rect.height, bubbleRect?.width, bubbleRect?.height)
    const nextX = clamp(
      ((centerX - rect.left) / rect.width) * 100,
      bounds.minX,
      bounds.maxX,
    )
    const nextY = clamp(
      ((centerY - rect.top) / rect.height) * 100,
      bounds.minY,
      bounds.maxY,
    )
    setPosition({ x: nextX, y: nextY })
    markCompositionDirty()
  }, [markCompositionDirty])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!stageRef.current || !bubbleGroupRef.current) return
    event.preventDefault()
    const bubbleRect = bubbleGroupRef.current.getBoundingClientRect()
    bubbleGrabOffsetRef.current = {
      x: event.clientX - (bubbleRect.left + bubbleRect.width / 2),
      y: event.clientY - (bubbleRect.top + bubbleRect.height / 2),
    }
    dragPointerId.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerId.current !== event.pointerId) return
    const offset = bubbleGrabOffsetRef.current ?? { x: 0, y: 0 }
    updateBubblePosition(event.clientX - offset.x, event.clientY - offset.y)
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerId.current !== event.pointerId) return
    dragPointerId.current = null
    bubbleGrabOffsetRef.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleBubbleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 2
    let nextPosition: Position | null = null
    if (event.key === 'ArrowLeft') nextPosition = { x: position.x - step, y: position.y }
    if (event.key === 'ArrowRight') nextPosition = { x: position.x + step, y: position.y }
    if (event.key === 'ArrowUp') nextPosition = { x: position.x, y: position.y - step }
    if (event.key === 'ArrowDown') nextPosition = { x: position.x, y: position.y + step }
    if (!nextPosition) return
    event.preventDefault()
    const rect = stageRef.current?.getBoundingClientRect()
    const bubbleRect = bubbleGroupRef.current?.getBoundingClientRect()
    const bounds = rect
      ? getBubblePositionBounds(rect.width, rect.height, bubbleRect?.width, bubbleRect?.height)
      : { minX: 16, maxX: 84, minY: 16, maxY: 82 }
    const nextX = clamp(nextPosition.x, bounds.minX, bounds.maxX)
    setPosition({ x: nextX, y: clamp(nextPosition.y, bounds.minY, bounds.maxY) })
    markCompositionDirty()
  }

  const updateConnectorTarget = useCallback((clientX: number, clientY: number) => {
    if (!stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const bubbleRect = bubbleGroupRef.current?.getBoundingClientRect()
    const bubble = bubbleRect
      ? {
          x: (bubbleRect.left - rect.left) / rect.width,
          y: (bubbleRect.top - rect.top) / rect.height,
          width: bubbleRect.width / rect.width,
          height: bubbleRect.height / rect.height,
        }
      : null
    setConnectorTarget(
      validateConnectorTarget(
        bubbleKind,
        {
          x: (clientX - rect.left) / rect.width,
          y: (clientY - rect.top) / rect.height,
        },
        bubble,
        rect.width,
        rect.height,
      ),
    )
    markCompositionDirty()
  }, [bubbleKind, markCompositionDirty])

  const handleConnectorPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!stageRef.current) return
    event.preventDefault()
    event.stopPropagation()
    targetPointerId.current = event.pointerId
    targetPointerStartRef.current = { x: event.clientX, y: event.clientY }
    targetPointerMovedRef.current = false
    targetDragThresholdRef.current =
      event.pointerType === 'touch' ? 12 : event.pointerType === 'pen' ? 9 : 6
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDraggingTarget(true)
  }

  const handleConnectorPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (targetPointerId.current !== event.pointerId) return
    event.preventDefault()
    const start = targetPointerStartRef.current
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) >=
        targetDragThresholdRef.current
    ) {
      targetPointerMovedRef.current = true
    }
    if (!targetPointerMovedRef.current) return
    updateConnectorTarget(event.clientX, event.clientY)
  }

  const finishConnectorPointer = (event: ReactPointerEvent<HTMLButtonElement>, allowTap: boolean) => {
    if (targetPointerId.current !== event.pointerId) return
    const wasTap = allowTap && !targetPointerMovedRef.current
    targetPointerId.current = null
    targetPointerStartRef.current = null
    targetPointerMovedRef.current = false
    setIsDraggingTarget(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (wasTap) {
      curveDirectionInitializedRef.current = true
      setCurveDirection((current) => current === 1 ? -1 : 1)
      markCompositionDirty()
    }
  }

  const handleConnectorPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    finishConnectorPointer(event, true)
  }

  const handleConnectorPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    finishConnectorPointer(event, false)
  }

  const handleConnectorKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      curveDirectionInitializedRef.current = true
      setCurveDirection((current) => current === 1 ? -1 : 1)
      markCompositionDirty()
      return
    }
    const step = event.shiftKey ? 0.05 : 0.025
    let nextTarget: ConnectorTarget | null = null
    if (event.key === 'ArrowLeft') nextTarget = { x: connectorTarget.x - step, y: connectorTarget.y }
    if (event.key === 'ArrowRight') nextTarget = { x: connectorTarget.x + step, y: connectorTarget.y }
    if (event.key === 'ArrowUp') nextTarget = { x: connectorTarget.x, y: connectorTarget.y - step }
    if (event.key === 'ArrowDown') nextTarget = { x: connectorTarget.x, y: connectorTarget.y + step }
    if (!nextTarget) return
    event.preventDefault()
    const rect = stageRef.current?.getBoundingClientRect()
    const bubbleRect = stageRef.current && bubbleGroupRef.current
      ? bubbleGroupRef.current.getBoundingClientRect()
      : null
    const bubble = rect && bubbleRect
      ? {
          x: (bubbleRect.left - rect.left) / rect.width,
          y: (bubbleRect.top - rect.top) / rect.height,
          width: bubbleRect.width / rect.width,
          height: bubbleRect.height / rect.height,
        }
      : null
    setConnectorTarget(
      rect
        ? validateConnectorTarget(
            bubbleKind,
            nextTarget,
            bubble,
            rect.width,
            rect.height,
          )
        : nextTarget,
    )
    markCompositionDirty()
  }

  const handleDownload = async () => {
    if (
      !photo ||
      !stageRef.current ||
      !bubbleGroupRef.current ||
      !bubbleTextRef.current ||
      !resolvedConnector
    ) return

    const image = new window.Image()
    image.src = photo.src
    await document.fonts.ready
    await image.decode()

    const stageRect = stageRef.current.getBoundingClientRect()
    const bubbleRect = bubbleGroupRef.current.getBoundingClientRect()
    const textRect = bubbleTextRef.current.getBoundingClientRect()
    const scale = photo.naturalWidth / stageRect.width
    const canvas = document.createElement('canvas')
    canvas.width = photo.naturalWidth
    canvas.height = photo.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const computed = window.getComputedStyle(bubbleTextRef.current)
    const fontSize = Number.parseFloat(computed.fontSize) * scale
    const padding = Number.parseFloat(computed.paddingLeft) * scale
    const lineHeightValue = Number.parseFloat(computed.lineHeight)
    const lineHeight = (Number.isFinite(lineHeightValue) ? lineHeightValue : fontSize * 1.22) * scale

    const bubbleX = (bubbleRect.left - stageRect.left) * scale
    const bubbleY = (bubbleRect.top - stageRect.top) * scale
    const bubbleWidth = bubbleRect.width * scale
    const bubbleHeight = bubbleRect.height * scale
    const connectorSvg = bubbleConnectorSvg(
      resolvedConnector,
      canvas.width,
      canvas.height,
    )
    const connectorUrl = URL.createObjectURL(new Blob([connectorSvg], { type: 'image/svg+xml' }))
    const connectorImage = new window.Image()
    connectorImage.src = connectorUrl
    await connectorImage.decode()
    context.drawImage(connectorImage, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(connectorUrl)

    const shellSvg = bubbleBodySvg(bubbleKind, bubbleWidth, bubbleHeight)
    const shellUrl = URL.createObjectURL(new Blob([shellSvg], { type: 'image/svg+xml' }))
    const shellImage = new window.Image()
    shellImage.src = shellUrl
    await shellImage.decode()
    context.drawImage(shellImage, bubbleX, bubbleY, bubbleWidth, bubbleHeight)
    URL.revokeObjectURL(shellUrl)

    context.save()
    context.fillStyle = computed.color
    context.font = `${computed.fontWeight} ${fontSize}px ${computed.fontFamily}`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const textX = (textRect.left - stageRect.left) * scale + textRect.width * scale / 2
    const textY = (textRect.top - stageRect.top) * scale + textRect.height * scale / 2
    const textWidth = Math.max(1, textRect.width * scale - padding * 2)
    const lines = wrapText(context, currentText, textWidth)
    const totalHeight = lines.length * lineHeight
    const firstY = textY - totalHeight / 2 + lineHeight / 2
    lines.forEach((line, index) => context.fillText(line, textX, firstY + index * lineHeight))
    context.restore()

    const link = document.createElement('a')
    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Unable to create the PetSays photo.'))
        },
        'image/jpeg',
        jpegExportQuality,
      )
    })
    const downloadUrl = URL.createObjectURL(jpegBlob)
    link.download = `petsays-${vibeId ?? 'pet'}.jpg`
    link.href = downloadUrl
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
    setDownloaded(true)
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="/" onClick={handleHome} aria-label="PetSays home">
          <span className="wordmark-bubble" aria-hidden="true" />
          <span>PetSays</span>
        </a>
        <span className="header-note">made for the funny photos</span>
      </header>

      <main id="top">
        {!photo ? (
          <>
            <section className="intro-hero" aria-labelledby="hero-title">
              <div className="hero-action-panel">
                <div className="hero-copy">
                  <p className="eyebrow">For photos that look like they have something to say</p>
                  <h1 id="hero-title">Make your pet talk.</h1>
                  <p className="hero-subtitle">Upload a photo. Pick a vibe. Make it funny.</p>
                </div>

                <label className="upload-card" htmlFor="photo-upload">
                  <span className="upload-icon" aria-hidden="true">↑</span>
                  <span className="upload-card-title">Upload a photo</span>
                  <span className="upload-card-hint">Camera roll or camera</span>
                </label>
                <p className="upload-trust">No signup · No watermark</p>
                <input
                  ref={fileInputRef}
                  id="photo-upload"
                  className="visually-hidden"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileInput}
                  aria-label="Upload a pet photo"
                />
              </div>

              <ExampleCarousel />
            </section>

            <section className="how-section" aria-labelledby="how-title">
              <div className="section-heading compact-heading">
                <p className="eyebrow">Three tiny moves</p>
                <h2 id="how-title">Upload. Pick a vibe. Download.</h2>
              </div>
              <ol className="how-list">
                <li><span>01</span><strong>Upload</strong><small>Choose the face.</small></li>
                <li><span>02</span><strong>Pick a vibe</strong><small>Trust your instincts.</small></li>
                <li><span>03</span><strong>Download</strong><small>Keep the joke.</small></li>
              </ol>
            </section>
          </>
        ) : (
          <section className="maker-section" aria-labelledby="maker-title">
            <div className="maker-topline">
              <div>
                <p className="eyebrow">{selectedVibe ? 'The translation is happening' : 'Photo received'}</p>
                <h1 id="maker-title">{selectedVibe ? 'Look what your pet is saying.' : 'Pick a vibe.'}</h1>
              </div>
              <label className="change-photo-button" htmlFor="photo-upload">Change photo</label>
            </div>

            <input
              ref={fileInputRef}
              id="photo-upload"
              className="visually-hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileInput}
              aria-label="Choose a different pet photo"
            />

            <div className={`maker-layout ${selectedVibe ? 'has-result' : ''}`}>
              <div className="photo-column">
                <div className="stage-host" ref={stageHostRef}>
                  <div
                    ref={stageRef}
                    className="photo-stage"
                    style={{
                      width: stageSize.width || '100%',
                      height: stageSize.height || 'auto',
                      aspectRatio: `${photo.naturalWidth} / ${photo.naturalHeight}`,
                    }}
                  >
                    <img className="uploaded-photo" src={photo.src} alt={`Uploaded pet photo: ${photo.name}`} />
                    {selectedVibe && currentText && bubbleGeometry && resolvedConnector && (
                      <BubbleConnector
                        kind={bubbleKind}
                        bubble={bubbleGeometry}
                        target={connectorTarget}
                        curveDirection={curveDirection}
                        width={stageSize.width}
                        height={stageSize.height}
                        geometry={resolvedConnector}
                      />
                    )}
                    {selectedVibe && currentText && (
                      <div
                        ref={bubbleGroupRef}
                        className={`bubble-group ${isDragging ? 'is-dragging' : ''}`}
                        style={{ left: `${position.x}%`, top: `${position.y}%` }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onKeyDown={handleBubbleKeyDown}
                        role="button"
                        tabIndex={0}
                        aria-label="Drag bubble to move it around the photo"
                        title="Drag me"
                      >
                        <BubbleGraphic
                          kind={bubbleKind}
                          text={currentText}
                          textRef={bubbleTextRef}
                        />
                      </div>
                    )}
                    {selectedVibe && currentText && (
                      <button
                        type="button"
                        className={`connector-handle ${isDraggingTarget ? 'is-dragging' : ''}`}
                        style={{ left: `${connectorTarget.x * 100}%`, top: `${connectorTarget.y * 100}%` }}
                        onPointerDown={handleConnectorPointerDown}
                        onPointerMove={handleConnectorPointerMove}
                        onPointerUp={handleConnectorPointerUp}
                        onPointerCancel={handleConnectorPointerCancel}
                        onKeyDown={handleConnectorKeyDown}
                        aria-label="Drag connector tip to point at your pet, or tap to flip the curve"
                        title="Drag to point; tap to flip curve"
                      >
                        <span aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                {selectedVibe && <p className="drag-hint">Drag the bubble. Point the tail.</p>}
              </div>

              <div className="controls-column">
                {!selectedVibe ? (
                  <div className="vibe-picker">
                    <div className="control-heading">
                      <p className="eyebrow">One tap, instant personality</p>
                    </div>
                    <div className="vibe-grid">
                      {vibes.map((vibe) => (
                        <button
                          className="vibe-card"
                          key={vibe.id}
                          type="button"
                          onClick={() => handleVibe(vibe)}
                          style={{ '--vibe-color': vibe.color, '--vibe-tint': vibe.tint } as React.CSSProperties}
                        >
                          <span
                            className={`vibe-art vibe-art-${vibe.id}`}
                            style={{ backgroundColor: vibe.tint }}
                            aria-hidden="true"
                          >
                            <VibeArt id={vibe.id} color={vibe.color} />
                          </span>
                          <span className="vibe-card-copy">
                            <strong>{vibe.label}</strong>
                            <small>{vibe.sample}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="result-controls" aria-live="polite">
                    <div className="control-heading result-heading">
                      <p className="eyebrow">{selectedVibe.label} · {selectedVibe.eyebrow}</p>
                      <h2>Does this sound right?</h2>
                    </div>

                    <div className="bubble-tools">
                      <div className="bubble-switch" role="group" aria-label="Bubble style">
                        <button
                          type="button"
                          className={bubbleKind === 'thought' ? 'active' : ''}
                          onClick={() => {
                            setBubbleKind('thought')
                            markCompositionDirty()
                          }}
                          aria-pressed={bubbleKind === 'thought'}
                        >
                          Thought
                        </button>
                        <button
                          type="button"
                          className={bubbleKind === 'speech' ? 'active' : ''}
                          onClick={() => {
                            setBubbleKind('speech')
                            markCompositionDirty()
                          }}
                          aria-pressed={bubbleKind === 'speech'}
                        >
                          Speech
                        </button>
                      </div>
                    </div>

                    <div className="line-list" aria-label="Alternate funny lines">
                      {selectedVibe.lines.slice(0, 4).map((line, index) => (
                        <button
                          type="button"
                          key={line}
                          className={`line-chip ${lineIndex === index && !customOpen ? 'selected' : ''}`}
                          onClick={() => chooseLine(index)}
                        >
                          {line}
                        </button>
                      ))}
                    </div>

                    <div className="action-row">
                      <button type="button" className="another-button" onClick={handleAnother}>
                        Another one <span aria-hidden="true">↻</span>
                      </button>
                      <button
                        type="button"
                        className={`write-button ${customOpen ? 'active' : ''}`}
                        onClick={() => setCustomOpen((open) => !open)}
                        aria-expanded={customOpen}
                      >
                        Write my own
                      </button>
                    </div>

                    {customOpen && (
                      <div className="custom-copy">
                        <label htmlFor="custom-line">Your line</label>
                        <textarea
                          ref={textAreaRef}
                          id="custom-line"
                          value={currentText}
                          maxLength={120}
                          rows={2}
                          onChange={(event) => {
                            setCurrentText(event.target.value)
                            setDownloaded(false)
                          }}
                          placeholder="What is your pet thinking?"
                        />
                        <span className="character-count">{currentText.length}/120</span>
                      </div>
                    )}

                    <button type="button" className="download-button" onClick={handleDownload}>
                      <span>Download</span>
                      <span aria-hidden="true">↓</span>
                    </button>
                    <p className={`download-note ${downloaded ? 'is-done' : ''}`}>
                      {downloaded ? 'Saved as a photo. Make another?' : 'Free, no watermark, no signup.'}
                    </p>

                    <button type="button" className="back-to-vibes" onClick={() => setVibeId(null)}>
                      ← Try a different vibe
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <span>PetSays</span>
        <span>Small tool. Big opinions.</span>
      </footer>
    </div>
  )
}

export default App
