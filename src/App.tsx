import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { BubbleGraphic } from './components/BubbleGraphic'
import { BubbleConnector } from './components/BubbleConnector'
import { HeroDemo, HeroSteps, HeroUploadRail } from './components/ExampleCarousel'
import '@fontsource/fredoka/latin-700.css'
import { getVibe, vibes, type Vibe, type VibeId } from './data/presets'
import {
  bubbleConnectorSvg,
  getDefaultCurveDirection,
  resolveConnectorGeometry,
  validateConnectorTarget,
  type BubbleBox,
  type ConnectorTarget,
  type CurveDirection,
} from './utils/bubbleConnector'
import {
  chooseSmartBubblePlacement,
  getBubblePositionBounds,
  type BubblePlacementResult,
} from './utils/bubblePlacement'
import { bubbleBodySvg } from './utils/bubbleShell'
import { detectPetImage, type PetDetectionResult } from './utils/petDetection'
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

const initialPosition: Position = { x: 50, y: 26 }
const defaultConnectorTarget: ConnectorTarget = { x: 0.5, y: 0.72 }
const minBubbleScale = 0.74
const maxBubbleScale = 1.28
const bubbleScaleStep = 0.08
const jpegExportQuality = 0.92
const suggestionsPerBatch = 4

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getSuggestionIndices(lineCount: number, batchIndex: number) {
  if (lineCount <= 0) return []

  const start = (batchIndex * suggestionsPerBatch) % lineCount
  const count = Math.min(suggestionsPerBatch, lineCount)

  return Array.from(
    { length: count },
    (_, offset) => (start + offset) % lineCount,
  )
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
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

type DecorativePage = 'landing' | 'picker' | 'result'

function DecorativeSpots({ page }: { page: DecorativePage }) {
  return (
    <div className={`vibe-atmosphere vibe-atmosphere-${page}`} aria-hidden="true">
      <span className="vibe-spot vibe-spot-mint" />
      <span className="vibe-spot vibe-spot-lilac" />
      <span className="vibe-spot vibe-spot-peach" />
      <span className="vibe-spot vibe-spot-sun" />
      <span className="vibe-spot vibe-spot-sky" />
      <span className="vibe-spot vibe-spot-coral" />
    </div>
  )
}

function App() {
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null)
  const [vibeId, setVibeId] = useState<VibeId | null>(null)
  const [lineIndex, setLineIndex] = useState(0)
  const [suggestionBatch, setSuggestionBatch] = useState(0)
  const [currentText, setCurrentText] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const bubbleKind = 'thought' as const
  const [connectorTarget, setConnectorTarget] = useState<ConnectorTarget>(defaultConnectorTarget)
  const [curveDirection, setCurveDirection] = useState<CurveDirection>(1)
  const [bubbleGeometry, setBubbleGeometry] = useState<BubbleBox | null>(null)
  const [position, setPosition] = useState<Position>(initialPosition)
  const [bubbleScale, setBubbleScale] = useState(1)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingTarget, setIsDraggingTarget] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [detectionResult, setDetectionResult] = useState<PetDetectionResult | null>(null)
  const [placementResult, setPlacementResult] = useState<BubblePlacementResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const stageHostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const stageSizeRef = useRef({ width: 0, height: 0 })
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
  const uploadGenerationRef = useRef(0)
  const smartPlacementAttemptedRef = useRef(false)
  const manualBubbleOverrideRef = useRef(false)
  const manualConnectorOverrideRef = useRef(false)

  const selectedVibe = vibeId ? getVibe(vibeId) : null
  const normalizedTextLength = currentText.trim().length
  const bubbleCopyClass =
    normalizedTextLength > 90
      ? 'bubble-copy-xlong'
      : normalizedTextLength > 52
        ? 'bubble-copy-long'
        : ''

  const bubbleOuterMaxWidth = useMemo(() => {
    const absoluteMax = 368
    const safeStageWidth = Number.isFinite(stageSize.width) ? stageSize.width : 0

    if (safeStageWidth <= 0) return absoluteMax
    return Math.min(absoluteMax, Math.max(150, safeStageWidth - 28))
  }, [stageSize.width])

  const bubbleTextMaxWidth = Math.max(
    116,
    bubbleOuterMaxWidth - 30,
  )

  const visibleLineIndices = useMemo(
    () =>
      selectedVibe
        ? getSuggestionIndices(selectedVibe.lines.length, suggestionBatch)
        : [],
    [selectedVibe, suggestionBatch],
  )
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

  const markCompositionDirty = useCallback(() => {
    setDownloaded(false)
    setShareStatus(null)
  }, [])

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
      const isDesktop = window.matchMedia('(min-width: 760px)').matches
      const width = isDesktop
        ? Math.min(hostWidth, Math.min(Math.max(window.innerHeight * 0.56, 430), 560) * ratio)
        : hostWidth
      const nextStageSize = { width, height: width / ratio }
      const currentStageSize = stageSizeRef.current

      if (
        Math.abs(currentStageSize.width - nextStageSize.width) < 0.5 &&
        Math.abs(currentStageSize.height - nextStageSize.height) < 0.5
      ) return

      stageSizeRef.current = nextStageSize
      setStageSize(nextStageSize)
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
    if (
      detectionResult &&
      !smartPlacementAttemptedRef.current &&
      !manualBubbleOverrideRef.current
    ) {
      smartPlacementAttemptedRef.current = true
      if (detectionResult.status === 'ready' && detectionResult.subjectBox) {
        const placement = chooseSmartBubblePlacement({
          subjectBox: detectionResult.subjectBox,
          headBox: detectionResult.headBox,
          bubbleWidth: bubbleRect.width,
          bubbleHeight: bubbleRect.height,
          stageWidth: stageRect.width,
          stageHeight: stageRect.height,
          bubbleKind,
          fallbackCenter: { x: initialPosition.x / 100, y: initialPosition.y / 100 },
          bounds,
        })
        setPlacementResult(placement)
        if (placement.succeeded) {
          const placedGeometry = {
            x: placement.center.x - nextGeometry.width / 2,
            y: placement.center.y - nextGeometry.height / 2,
            width: nextGeometry.width,
            height: nextGeometry.height,
          }
          const placedTarget = manualConnectorOverrideRef.current
            ? nextTarget
            : validateConnectorTarget(
                bubbleKind,
                placement.connectorTarget,
                placedGeometry,
                stageRect.width,
                stageRect.height,
              )
          setPosition({ x: placement.center.x * 100, y: placement.center.y * 100 })
          if (!manualConnectorOverrideRef.current) setConnectorTarget(placedTarget)
          curveDirectionInitializedRef.current = true
          setCurveDirection(
            getDefaultCurveDirection(
              bubbleKind,
              placedGeometry,
              placedTarget,
              stageRect.width,
              stageRect.height,
            ),
          )
          markCompositionDirty()
        }
      }
    }
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
  }, [photo, vibeId, currentText, bubbleKind, connectorTarget, position.x, position.y, bubbleScale, stageSize.width, stageSize.height, detectionResult, markCompositionDirty])

  const handleHome = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    uploadGenerationRef.current += 1
    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current)
      photoUrlRef.current = null
    }
    resetForNewPhoto()
    setPhoto(null)
    stageSizeRef.current = { width: 0, height: 0 }
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
    setSuggestionBatch(0)
    setCurrentText('')
    setCustomOpen(false)
    setConnectorTarget(defaultConnectorTarget)
    setCurveDirection(1)
    curveDirectionInitializedRef.current = false
    setBubbleGeometry(null)
    setPosition(initialPosition)
    setBubbleScale(1)
    markCompositionDirty()
    setDetectionResult(null)
    setPlacementResult(null)
    smartPlacementAttemptedRef.current = false
    manualBubbleOverrideRef.current = false
    manualConnectorOverrideRef.current = false
  }

  const handleFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return

    const uploadGeneration = uploadGenerationRef.current + 1
    uploadGenerationRef.current = uploadGeneration
    const src = URL.createObjectURL(file)
    const image = new window.Image()
    image.onload = () => {
      if (uploadGeneration !== uploadGenerationRef.current) {
        URL.revokeObjectURL(src)
        return
      }
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
      photoUrlRef.current = src
      resetForNewPhoto()
      setPhoto({
        src,
        name: file.name,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      })
      void detectPetImage(image).then((result) => {
        if (uploadGeneration !== uploadGenerationRef.current) return
        setDetectionResult(result)
      })
    }
    image.onerror = () => {
      URL.revokeObjectURL(src)
      if (uploadGeneration === uploadGenerationRef.current) setDetectionResult(null)
    }
    image.src = src
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleVibe = (vibe: Vibe) => {
    setVibeId(vibe.id)
    setLineIndex(0)
    setSuggestionBatch(0)
    setCurrentText(vibe.lines[0])
    setCustomOpen(false)
    if (!manualConnectorOverrideRef.current) setConnectorTarget(defaultConnectorTarget)
    if (!manualBubbleOverrideRef.current) setPosition(initialPosition)
    if (!manualBubbleOverrideRef.current) {
      smartPlacementAttemptedRef.current = false
      setPlacementResult(null)
    }
    if (!manualConnectorOverrideRef.current) {
      setCurveDirection(1)
      curveDirectionInitializedRef.current = false
    }
    setBubbleGeometry(null)
    markCompositionDirty()
  }

  const chooseLine = (index: number) => {
    if (!selectedVibe) return
    setLineIndex(index)
    setCurrentText(selectedVibe.lines[index])
    setCustomOpen(false)
    markCompositionDirty()
  }

  const handleAnother = () => {
    if (!selectedVibe) return

    const batchCount = Math.max(
      1,
      Math.ceil(selectedVibe.lines.length / suggestionsPerBatch),
    )
    const nextBatch = (suggestionBatch + 1) % batchCount
    const nextIndices = getSuggestionIndices(
      selectedVibe.lines.length,
      nextBatch,
    )
    const nextIndex =
      nextIndices[Math.floor(Math.random() * nextIndices.length)] ?? 0

    setSuggestionBatch(nextBatch)
    setLineIndex(nextIndex)
    setCurrentText(selectedVibe.lines[nextIndex])
    setCustomOpen(false)
    markCompositionDirty()
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
    manualBubbleOverrideRef.current = true
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
    manualBubbleOverrideRef.current = true
    const rect = stageRef.current?.getBoundingClientRect()
    const bubbleRect = bubbleGroupRef.current?.getBoundingClientRect()
    const bounds = rect
      ? getBubblePositionBounds(rect.width, rect.height, bubbleRect?.width, bubbleRect?.height)
      : { minX: 16, maxX: 84, minY: 16, maxY: 82 }
    const nextX = clamp(nextPosition.x, bounds.minX, bounds.maxX)
    setPosition({ x: nextX, y: clamp(nextPosition.y, bounds.minY, bounds.maxY) })
    markCompositionDirty()
  }

  const adjustBubbleScale = (delta: number) => {
    manualBubbleOverrideRef.current = true
    setBubbleScale((current) => {
      const next = clamp(current + delta, minBubbleScale, maxBubbleScale)
      return Math.round(next * 100) / 100
    })
    markCompositionDirty()
  }

  const updateConnectorTarget = useCallback((clientX: number, clientY: number) => {
    if (!stageRef.current) return
    manualConnectorOverrideRef.current = true
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
    manualConnectorOverrideRef.current = true
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

  const drawPetSaysBrandMark = (
    context: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    logoImage: HTMLImageElement,
  ) => {
    const shortEdge = Math.min(canvasWidth, canvasHeight)
    const logoWidth = Math.max(148, Math.min(280, Math.round(shortEdge * 0.15)))
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

  const createPetSaysImageBlob = async (): Promise<Blob | null> => {
    if (
      !photo ||
      !stageRef.current ||
      !bubbleGroupRef.current ||
      !bubbleTextRef.current ||
      !resolvedConnector
    ) return null

    const image = new window.Image()
    image.src = photo.src
    const logoImage = new window.Image()
    logoImage.src = '/brand/petsays-wordmark.png'
    await document.fonts.ready
    await image.decode()
    await logoImage.decode()

    const stageRect = stageRef.current.getBoundingClientRect()
    const bubbleRect = bubbleGroupRef.current.getBoundingClientRect()
    const textRect = bubbleTextRef.current.getBoundingClientRect()
    const scale = photo.naturalWidth / stageRect.width
    const canvas = document.createElement('canvas')
    canvas.width = photo.naturalWidth
    canvas.height = photo.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) return null

    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const computed = window.getComputedStyle(bubbleTextRef.current)
    const fontSize = Number.parseFloat(computed.fontSize) * bubbleScale * scale
    const padding = Number.parseFloat(computed.paddingLeft) * bubbleScale * scale
    const lineHeightValue = Number.parseFloat(computed.lineHeight)
    const lineHeight = (Number.isFinite(lineHeightValue) ? lineHeightValue * bubbleScale : fontSize * 1.22) * scale

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

    drawPetSaysBrandMark(context, canvas.width, canvas.height, logoImage)

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Unable to create the PetSays photo.'))
        },
        'image/jpeg',
        jpegExportQuality,
      )
    })
  }

  const getExportFileName = () => `petsays-${vibeId ?? 'pet'}.jpg`

  const downloadJpegBlob = (jpegBlob: Blob) => {
    const downloadUrl = URL.createObjectURL(jpegBlob)
    const link = document.createElement('a')
    link.download = getExportFileName()
    link.href = downloadUrl
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
  }

  const handleDownload = async () => {
    try {
      const jpegBlob = await createPetSaysImageBlob()
      if (!jpegBlob) return
      downloadJpegBlob(jpegBlob)
      setShareStatus(null)
      setDownloaded(true)
    } catch {
      setShareStatus('Could not make the image. Please try again.')
    }
  }

  const handleShare = async () => {
    try {
      const jpegBlob = await createPetSaysImageBlob()
      if (!jpegBlob) return

      const file = new File([jpegBlob], getExportFileName(), { type: 'image/jpeg' })
      let supportsFileShare = false
      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
        try {
          supportsFileShare = navigator.canShare({ files: [file] })
        } catch {
          supportsFileShare = false
        }
      }

      if (!supportsFileShare) {
        downloadJpegBlob(jpegBlob)
        setDownloaded(true)
        setShareStatus("Sharing isn't available here, so we saved the image instead.")
        return
      }

      try {
        await navigator.share({ files: [file] })
        setDownloaded(false)
        setShareStatus('Shared via your device.')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        downloadJpegBlob(jpegBlob)
        setDownloaded(true)
        setShareStatus("Sharing didn't open, so we saved the image instead.")
      }
    } catch {
      setShareStatus('Could not make the image. Please try again.')
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="/" onClick={handleHome} aria-label="PetSays home">
          <span>PetSays</span>
        </a>
        <span className="header-note">Small tool. Big opinions.</span>
      </header>

      <main id="top">
        {!photo ? (
          <>
            <section className="intro-hero" aria-labelledby="hero-title">
              <div className="hero-action-panel">
                <DecorativeSpots page="landing" />
                <div className="hero-copy">
                  <p className="eyebrow">For photos that look like they have something to say</p>
                  <h1 id="hero-title" className="hero-title">Make your pet talk.</h1>
                  <p className="hero-subtitle">Upload a photo. Pick a vibe. Make it funny.</p>
                </div>
                <HeroUploadRail variant="desktop" />
                <HeroSteps variant="desktop" />
              </div>

              <HeroDemo onUpload={() => fileInputRef.current?.click()} />

              <HeroSteps variant="mobile" />

              <input
                ref={fileInputRef}
                id="photo-upload"
                className="visually-hidden"
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                aria-label="Upload a pet photo"
              />
            </section>

          </>
        ) : (
          <section className={`maker-section ${selectedVibe ? 'has-result' : 'is-vibe-picker'}`} aria-labelledby="maker-title">
            <DecorativeSpots page={selectedVibe ? 'result' : 'picker'} />
            <div className="maker-topline">
              <div>
                {!selectedVibe && <p className="eyebrow">Photo received</p>}
                <h1 id="maker-title" className={selectedVibe ? 'result-page-title' : 'vibe-picker-title'}>
                  {selectedVibe ? 'Your pet has opinions.' : 'Pick a vibe.'}
                </h1>
              </div>
            </div>

            <input
              ref={fileInputRef}
              id="photo-upload"
              className="visually-hidden"
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              aria-label="Choose a different pet photo"
            />

            <div className={`maker-layout ${selectedVibe ? 'has-result' : ''}`}>
              <div className={`photo-column ${photo.naturalWidth / photo.naturalHeight > 1.15 ? 'photo-column-wide' : ''}`}>
                <div className="photo-column-toolbar">
                  <label className="change-photo-button" htmlFor="photo-upload">
                    <span className="change-photo-icon" aria-hidden="true">↻</span>
                    <span>Change photo</span>
                  </label>
                </div>
                <div className="stage-host" ref={stageHostRef}>
                  <div
                    ref={stageRef}
                    className="photo-stage"
                    data-detection-status={detectionResult?.status ?? 'loading'}
                    data-pet-class={detectionResult?.petClass ?? undefined}
                    data-subject-box={detectionResult?.subjectBox ? JSON.stringify(detectionResult.subjectBox) : undefined}
                    data-subject-confidence={detectionResult?.subjectConfidence.toFixed(3)}
                    data-head-box={detectionResult?.headBox ? JSON.stringify(detectionResult.headBox) : undefined}
                    data-head-status={detectionResult?.headStatus}
                    data-head-confidence={detectionResult?.headConfidence.toFixed(3)}
                    data-detection-runtime={detectionResult?.runtime}
                    data-model-init-ms={detectionResult?.initializationTimeMs?.toFixed(1)}
                    data-subject-inference-ms={detectionResult?.subjectInferenceTimeMs?.toFixed(1)}
                    data-head-inference-ms={detectionResult?.headInferenceTimeMs?.toFixed(1)}
                    data-total-detection-ms={detectionResult?.totalTimeMs?.toFixed(1)}
                    data-smart-placement={placementResult?.succeeded ? placementResult.reason : placementResult?.reason ?? 'pending'}
                    data-placement-score={placementResult?.score.toFixed(2)}
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
                        style={{
                          left: `${position.x}%`,
                          top: `${position.y}%`,
                          '--bubble-scale': bubbleScale,
                          '--bubble-outer-max-width': `${bubbleOuterMaxWidth}px`,
                          '--bubble-text-max-width': `${bubbleTextMaxWidth}px`,
                        } as CSSProperties}
                        data-bubble-scale={bubbleScale.toFixed(2)}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onKeyDown={handleBubbleKeyDown}
                        role="group"
                        tabIndex={0}
                        aria-label="Thought bubble. Use arrow keys to move it around the photo."
                        title="Drag me"
                      >
                        <BubbleGraphic
                          kind={bubbleKind}
                          text={currentText}
                          className={bubbleCopyClass}
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
                  {selectedVibe && currentText && (
                    <div className="bubble-size-row" role="group" aria-label="Adjust thought bubble size">
                      <span className="bubble-size-label">Bubble size</span>
                      <div className="bubble-size-control">
                        <button
                          type="button"
                          className="bubble-size-button"
                          onClick={() => adjustBubbleScale(-bubbleScaleStep)}
                          disabled={bubbleScale <= minBubbleScale}
                          aria-label="Decrease bubble size"
                          title="Make bubble smaller"
                        >
                          −
                        </button>
                        <span className="bubble-size-divider" aria-hidden="true" />
                        <button
                          type="button"
                          className="bubble-size-button"
                          onClick={() => adjustBubbleScale(bubbleScaleStep)}
                          disabled={bubbleScale >= maxBubbleScale}
                          aria-label="Increase bubble size"
                          title="Make bubble larger"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {selectedVibe && (
                  <p className="drag-hint">
                    <span className="drag-hint-copy">
                      <span className="drag-hint-line">Drag the bubble.</span>
                      <span className="drag-hint-line">Point the tail.</span>
                      <span className="drag-hint-line">Tap to curve it.</span>
                    </span>
                    <span className="drag-hint-heart" aria-hidden="true">♡</span>
                  </p>
                )}
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
                          style={{ '--vibe-color': vibe.color, '--vibe-tint': vibe.tint } as CSSProperties}
                        >
                          <span
                            className={`vibe-title-panel vibe-title-${vibe.id}`}
                            style={{ backgroundColor: vibe.tint }}
                          >
                            <strong>{vibe.label}</strong>
                          </span>
                          <span className="vibe-card-copy">
                            <small>{vibe.sample}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="result-controls" aria-live="polite">
                    <div className="control-heading result-heading">
                      <div className="result-vibe-row">
                        <p className="eyebrow">{selectedVibe.label} · {selectedVibe.eyebrow}</p>
                        <button type="button" className="back-to-vibes" onClick={() => setVibeId(null)}>
                          ← Change vibe
                        </button>
                      </div>
                      <h2>Does this sound right?</h2>
                    </div>

                    <div className="line-list" aria-label="Alternate funny lines">
                      {visibleLineIndices.map((index) => {
                        const line = selectedVibe.lines[index]

                        return (
                          <button
                            type="button"
                            key={`${suggestionBatch}-${index}-${line}`}
                            className={`line-chip ${lineIndex === index && !customOpen ? 'selected' : ''}`}
                            onClick={() => chooseLine(index)}
                          >
                            {line}
                          </button>
                        )
                      })}
                    </div>

                    <div className="action-row">
                      <button
                        type="button"
                        className="another-button"
                        onClick={handleAnother}
                        aria-label="Show four new funny lines"
                      >
                        Another one <span className="another-icon" aria-hidden="true">↻</span>
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
                            markCompositionDirty()
                          }}
                          placeholder="What is your pet thinking?"
                        />
                        <span className="character-count">{currentText.length}/120</span>
                      </div>
                    )}

                    <div className="result-completion">
                      <div className="completion-actions">
                        <button type="button" className="download-button" onClick={handleDownload}>
                          <span>Download</span>
                          <span aria-hidden="true">↓</span>
                        </button>
                        <button
                          type="button"
                          className="share-button"
                          onClick={handleShare}
                          aria-label="Share your PetSays image"
                        >
                          <span className="share-icon" aria-hidden="true">↗</span>
                          <span>Share</span>
                        </button>
                      </div>
                      <p className={`download-note ${downloaded || shareStatus ? 'is-done' : ''}`}>
                        {shareStatus ?? (downloaded ? 'Saved as a photo. Make another?' : 'Free, includes a small PetSays mark, no signup.')}
                      </p>
                    </div>

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
