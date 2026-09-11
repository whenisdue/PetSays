import {
  Fragment,
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
import { DecorativeSpots } from './components/DecorativeSpots'
import { PublicHome } from './components/PublicHome'
import { PublicSiteFooter } from './components/PublicSiteChrome'
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
import type { PendingLine } from './utils/pendingLine'

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

type BubbleState = {
  id: string
  text: string
  lineIndex: number
  position: Position
  scale: number
  connectorTarget: ConnectorTarget
  curveDirection: CurveDirection
}

const initialPosition: Position = { x: 50, y: 26 }
const defaultConnectorTarget: ConnectorTarget = { x: 0.5, y: 0.72 }
const minBubbleScale = 0.74
const maxBubbleScale = 1.28
const bubbleScaleStep = 0.08
const jpegExportQuality = 0.92
const suggestionsPerBatch = 4
const maxBubbles = 3

function createBubbleState(id: string, text = '', lineIndex = 0): BubbleState {
  return {
    id,
    text,
    lineIndex,
    position: initialPosition,
    scale: 1,
    connectorTarget: defaultConnectorTarget,
    curveDirection: 1,
  }
}

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

function getBubbleCopyClass(text: string) {
  const normalizedTextLength = text.trim().length
  if (normalizedTextLength > 90) return 'bubble-copy-xlong'
  if (normalizedTextLength > 52) return 'bubble-copy-long'
  return ''
}

type AppProps = {
  initialFile?: File | null
  pendingLine?: PendingLine | null
}

function App({ initialFile = null, pendingLine = null }: AppProps) {
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null)
  const [vibeId, setVibeId] = useState<VibeId | null>(null)
  const [suggestionBatch, setSuggestionBatch] = useState(0)
  const [customOpen, setCustomOpen] = useState(false)
  const [isCustomMode, setIsCustomMode] = useState(false)
  const nextBubbleIdRef = useRef(2)
  const [bubbles, setBubbles] = useState<BubbleState[]>(() => [createBubbleState('bubble-1')])
  const [selectedBubbleId, setSelectedBubbleId] = useState('bubble-1')
  const bubbleKind = 'thought' as const
  const [bubbleGeometries, setBubbleGeometries] = useState<Record<string, BubbleBox>>({})
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [draggingBubbleId, setDraggingBubbleId] = useState<string | null>(null)
  const [isDraggingTarget, setIsDraggingTarget] = useState(false)
  const [draggingTargetBubbleId, setDraggingTargetBubbleId] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [detectionResult, setDetectionResult] = useState<PetDetectionResult | null>(null)
  const [placementResult, setPlacementResult] = useState<BubblePlacementResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const stageHostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const stageSizeRef = useRef({ width: 0, height: 0 })
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const bubbleTextRefs = useRef<Record<string, HTMLSpanElement | null>>({})
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const photoUrlRef = useRef<string | null>(null)
  const dragPointerId = useRef<number | null>(null)
  const dragBubbleIdRef = useRef<string | null>(null)
  const bubbleGrabOffsetRef = useRef<Position | null>(null)
  const targetPointerId = useRef<number | null>(null)
  const targetBubbleIdRef = useRef<string | null>(null)
  const targetPointerStartRef = useRef<ConnectorTarget | null>(null)
  const targetPointerMovedRef = useRef(false)
  const targetDragThresholdRef = useRef(8)
  const curveDirectionInitializedRef = useRef<Record<string, boolean>>({})
  const uploadGenerationRef = useRef(0)
  const initialFileHandledRef = useRef<File | null>(null)
  const pendingLineRef = useRef<PendingLine | null>(pendingLine)
  const handleFileRef = useRef<(file: File | undefined) => void>(() => undefined)
  const smartPlacementAttemptedRef = useRef<Record<string, boolean>>({})
  const manualBubbleOverrideRef = useRef<Record<string, boolean>>({})
  const manualConnectorOverrideRef = useRef<Record<string, boolean>>({})

  const selectedVibe = vibeId ? getVibe(vibeId) : null
  const selectedBubble = bubbles.find((bubble) => bubble.id === selectedBubbleId) ?? bubbles[0] ?? null
  const isEditorMode = Boolean(selectedVibe || isCustomMode)
  const hasRenderableBubble = isEditorMode && bubbles.some((bubble) => Boolean(bubble.text.trim()))
  const isPlaceholderBubble = Boolean(
    isCustomMode && selectedBubble && !selectedBubble.text.trim(),
  )
  const hasBubblePreview = isEditorMode && bubbles.some(
    (bubble) => Boolean(bubble.text.trim()) || (isPlaceholderBubble && bubble.id === selectedBubble?.id),
  )

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
  const resolvedConnectors = useMemo(() => {
    if (!stageSize.width || !stageSize.height) return {}

    return Object.fromEntries(
      bubbles.flatMap((bubble) => {
        const geometry = bubbleGeometries[bubble.id]
        const hasPreview = Boolean(bubble.text.trim()) || (isPlaceholderBubble && bubble.id === selectedBubble?.id)
        if (!geometry || !hasPreview) return []

        return [[
          bubble.id,
          resolveConnectorGeometry(
            bubbleKind,
            geometry,
            bubble.connectorTarget,
            stageSize.width,
            stageSize.height,
            bubble.curveDirection,
          ),
        ]]
      }),
    ) as Record<string, ReturnType<typeof resolveConnectorGeometry>>
  }, [bubbles, bubbleGeometries, bubbleKind, isPlaceholderBubble, selectedBubble?.id, stageSize.height, stageSize.width])

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
    if (!photo || !hasBubblePreview || !stageRef.current) {
      setBubbleGeometries({})
      return
    }
    const stageRect = stageRef.current.getBoundingClientRect()
    const nextGeometries: Record<string, BubbleBox> = {}
    const nextBubbleValues = new Map<string, Partial<BubbleState>>()

    bubbles.forEach((bubble) => {
      const bubbleElement = bubbleRefs.current[bubble.id]
      if (!bubbleElement) return

      const bubbleRect = bubbleElement.getBoundingClientRect()
      const nextGeometry = {
        x: (bubbleRect.left - stageRect.left) / stageRect.width,
        y: (bubbleRect.top - stageRect.top) / stageRect.height,
        width: bubbleRect.width / stageRect.width,
        height: bubbleRect.height / stageRect.height,
      }
      nextGeometries[bubble.id] = nextGeometry

      const bounds = getBubblePositionBounds(
        stageRect.width,
        stageRect.height,
        bubbleRect.width,
        bubbleRect.height,
      )
      let nextPosition = {
        x: clamp(bubble.position.x, bounds.minX, bounds.maxX),
        y: clamp(bubble.position.y, bounds.minY, bounds.maxY),
      }
      let nextTarget = validateConnectorTarget(
        bubbleKind,
        bubble.connectorTarget,
        nextGeometry,
        stageRect.width,
        stageRect.height,
      )
      let nextCurveDirection = bubble.curveDirection

      if (!curveDirectionInitializedRef.current[bubble.id]) {
        curveDirectionInitializedRef.current[bubble.id] = true
        nextCurveDirection = getDefaultCurveDirection(
          bubbleKind,
          nextGeometry,
          nextTarget,
          stageRect.width,
          stageRect.height,
        )
      }

      if (
        detectionResult?.status === 'ready' &&
        detectionResult.subjectBox &&
        !smartPlacementAttemptedRef.current[bubble.id] &&
        !manualBubbleOverrideRef.current[bubble.id]
      ) {
        smartPlacementAttemptedRef.current[bubble.id] = true
        const placement = chooseSmartBubblePlacement({
          subjectBox: detectionResult.subjectBox,
          headBox: detectionResult.headBox,
          bubbleWidth: bubbleRect.width,
          bubbleHeight: bubbleRect.height,
          stageWidth: stageRect.width,
          stageHeight: stageRect.height,
          bubbleKind,
          fallbackCenter: {
            x: bubble.position.x / 100,
            y: bubble.position.y / 100,
          },
          bounds,
        })
        if (bubble.id === selectedBubble?.id) setPlacementResult(placement)
        if (placement.succeeded) {
          nextPosition = { x: placement.center.x * 100, y: placement.center.y * 100 }
          const placedGeometry = {
            x: placement.center.x - nextGeometry.width / 2,
            y: placement.center.y - nextGeometry.height / 2,
            width: nextGeometry.width,
            height: nextGeometry.height,
          }
          if (!manualConnectorOverrideRef.current[bubble.id]) {
            nextTarget = validateConnectorTarget(
              bubbleKind,
              placement.connectorTarget,
              placedGeometry,
              stageRect.width,
              stageRect.height,
            )
          }
          nextCurveDirection = getDefaultCurveDirection(
            bubbleKind,
            placedGeometry,
            nextTarget,
            stageRect.width,
            stageRect.height,
          )
        }
      }

      if (
        nextPosition.x !== bubble.position.x ||
        nextPosition.y !== bubble.position.y ||
        Math.abs(nextTarget.x - bubble.connectorTarget.x) > 0.00001 ||
        Math.abs(nextTarget.y - bubble.connectorTarget.y) > 0.00001 ||
        nextCurveDirection !== bubble.curveDirection
      ) {
        nextBubbleValues.set(bubble.id, {
          position: nextPosition,
          connectorTarget: nextTarget,
          curveDirection: nextCurveDirection,
        })
      }
    })

    setBubbleGeometries((current) => {
      const currentIds = Object.keys(current)
      const nextIds = Object.keys(nextGeometries)
      if (
        currentIds.length === nextIds.length &&
        nextIds.every((id) => {
          const previous = current[id]
          const next = nextGeometries[id]
          return previous && previous.x === next.x && previous.y === next.y && previous.width === next.width && previous.height === next.height
        })
      ) return current
      return nextGeometries
    })

    if (nextBubbleValues.size > 0) {
      const frame = window.requestAnimationFrame(() => {
        setBubbles((current) => current.map((bubble) => ({
          ...bubble,
          ...(nextBubbleValues.get(bubble.id) ?? {}),
        })))
        markCompositionDirty()
      })
      return () => window.cancelAnimationFrame(frame)
    }
  }, [bubbles, detectionResult, hasBubblePreview, bubbleKind, markCompositionDirty, photo, selectedBubble?.id, stageSize.height, stageSize.width])

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
    setDraggingBubbleId(null)
    setIsDraggingTarget(false)
    setDraggingTargetBubbleId(null)
    dragPointerId.current = null
    dragBubbleIdRef.current = null
    bubbleGrabOffsetRef.current = null
    targetPointerId.current = null
    targetBubbleIdRef.current = null
    targetPointerStartRef.current = null
    targetPointerMovedRef.current = false
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  const resetForNewPhoto = () => {
    setVibeId(null)
    setSuggestionBatch(0)
    setCustomOpen(false)
    setIsCustomMode(false)
    nextBubbleIdRef.current = 2
    setBubbles([createBubbleState('bubble-1')])
    setSelectedBubbleId('bubble-1')
    setBubbleGeometries({})
    bubbleRefs.current = {}
    bubbleTextRefs.current = {}
    curveDirectionInitializedRef.current = {}
    smartPlacementAttemptedRef.current = {}
    manualBubbleOverrideRef.current = {}
    manualConnectorOverrideRef.current = {}
    dragBubbleIdRef.current = null
    markCompositionDirty()
    setDetectionResult(null)
    setPlacementResult(null)
  }

  const handleFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return

    const pendingLineForPhoto = pendingLineRef.current
    pendingLineRef.current = null

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
      if (pendingLineForPhoto) {
        const pendingVibe = getVibe(pendingLineForPhoto.vibeId)
        if (pendingVibe.id === pendingLineForPhoto.vibeId) {
          const pendingLineIndex = pendingVibe.lines.indexOf(pendingLineForPhoto.text)
          setVibeId(pendingVibe.id)
          setSuggestionBatch(0)
          setBubbles([createBubbleState('bubble-1', pendingLineForPhoto.text, pendingLineIndex >= 0 ? pendingLineIndex : 0)])
          setSelectedBubbleId('bubble-1')
          setCustomOpen(false)
        }
      }
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

  useEffect(() => {
    handleFileRef.current = handleFile
  })

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0])
    event.target.value = ''
  }

  const updateBubble = useCallback((bubbleId: string, changes: Partial<BubbleState>) => {
    setBubbles((current) => current.map((bubble) => (
      bubble.id === bubbleId ? { ...bubble, ...changes } : bubble
    )))
  }, [])

  useEffect(() => {
    if (!initialFile || initialFileHandledRef.current === initialFile) return
    initialFileHandledRef.current = initialFile
    handleFileRef.current(initialFile)
  }, [initialFile])

  const handleVibe = (vibe: Vibe) => {
    if (!selectedBubble) return
    setIsCustomMode(false)
    setVibeId(vibe.id)
    setSuggestionBatch(0)
    setCustomOpen(false)
    updateBubble(selectedBubble.id, {
      text: vibe.lines[0],
      lineIndex: 0,
      ...(!manualConnectorOverrideRef.current[selectedBubble.id]
        ? { connectorTarget: defaultConnectorTarget, curveDirection: 1 }
        : {}),
      ...(!manualBubbleOverrideRef.current[selectedBubble.id]
        ? { position: initialPosition }
        : {}),
    })
    if (!manualBubbleOverrideRef.current[selectedBubble.id]) {
      smartPlacementAttemptedRef.current[selectedBubble.id] = false
      setPlacementResult(null)
    }
    if (!manualConnectorOverrideRef.current[selectedBubble.id]) {
      curveDirectionInitializedRef.current[selectedBubble.id] = false
    }
    markCompositionDirty()
  }

  const startCustomMode = () => {
    if (!selectedBubble) return
    setIsCustomMode(true)
    setVibeId(null)
    setSuggestionBatch(0)
    setCustomOpen(true)
    updateBubble(selectedBubble.id, {
      text: '',
      lineIndex: 0,
      position: initialPosition,
      scale: 1,
      connectorTarget: defaultConnectorTarget,
      curveDirection: 1,
    })
    curveDirectionInitializedRef.current[selectedBubble.id] = false
    setPlacementResult(null)
    smartPlacementAttemptedRef.current[selectedBubble.id] = false
    manualBubbleOverrideRef.current[selectedBubble.id] = false
    manualConnectorOverrideRef.current[selectedBubble.id] = false
    markCompositionDirty()
  }

  const handleChangeVibe = () => {
    setVibeId(null)
    setIsCustomMode(false)
    setCustomOpen(false)
  }

  const chooseLine = (index: number) => {
    if (!selectedVibe || !selectedBubble) return
    updateBubble(selectedBubble.id, {
      lineIndex: index,
      text: selectedVibe.lines[index],
    })
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
    if (selectedBubble) {
      updateBubble(selectedBubble.id, {
        lineIndex: nextIndex,
        text: selectedVibe.lines[nextIndex],
      })
    }
    setCustomOpen(false)
    markCompositionDirty()
  }

  const handleSelectBubble = (bubbleId: string) => {
    const bubble = bubbles.find((item) => item.id === bubbleId)
    if (!bubble) return
    setSelectedBubbleId(bubbleId)
    if (isCustomMode && !bubble.text.trim()) setCustomOpen(true)
  }

  const handleAddBubble = () => {
    if (bubbles.length >= maxBubbles) return

    const candidates: Position[] = [
      { x: 22, y: 24 },
      { x: 78, y: 24 },
      { x: 22, y: 62 },
      { x: 78, y: 62 },
      { x: 50, y: 76 },
      { x: 50, y: 20 },
    ]
    const subject = detectionResult?.subjectBox
    const subjectCenter = subject
      ? { x: (subject.x + subject.width / 2) * 100, y: (subject.y + subject.height / 2) * 100 }
      : null
    const nextPosition = candidates
      .map((candidate) => {
        const nearestBubbleDistance = Math.min(
          ...bubbles.map((bubble) => Math.hypot(candidate.x - bubble.position.x, candidate.y - bubble.position.y)),
        )
        const subjectDistance = subjectCenter
          ? Math.hypot(candidate.x - subjectCenter.x, candidate.y - subjectCenter.y)
          : 0
        return {
          candidate,
          score: nearestBubbleDistance + subjectDistance * 0.28,
        }
      })
      .sort((first, second) => second.score - first.score)[0]?.candidate ?? initialPosition
    const bubbleId = `bubble-${nextBubbleIdRef.current++}`
    const nextLineIndex = selectedVibe
      ? (selectedBubble?.lineIndex ?? 0) + 1 < selectedVibe.lines.length
        ? (selectedBubble?.lineIndex ?? 0) + 1
        : 0
      : 0
    const nextText = selectedVibe?.lines[nextLineIndex] ?? ''
    const nextBubble = {
      ...createBubbleState(bubbleId, nextText, nextLineIndex),
      position: nextPosition,
      connectorTarget: subjectCenter
        ? { x: subjectCenter.x / 100, y: subjectCenter.y / 100 }
        : defaultConnectorTarget,
    }

    setBubbles((current) => [...current, nextBubble])
    setSelectedBubbleId(bubbleId)
    setCustomOpen(!nextText)
    curveDirectionInitializedRef.current[bubbleId] = true
    smartPlacementAttemptedRef.current[bubbleId] = true
    manualBubbleOverrideRef.current[bubbleId] = false
    manualConnectorOverrideRef.current[bubbleId] = false
    markCompositionDirty()
  }

  const handleRemoveBubble = () => {
    if (bubbles.length <= 1 || !selectedBubble) return
    const selectedIndex = bubbles.findIndex((bubble) => bubble.id === selectedBubble.id)
    const remaining = bubbles.filter((bubble) => bubble.id !== selectedBubble.id)
    const nextSelected = remaining[Math.max(0, selectedIndex - 1)] ?? remaining[0]
    setBubbles(remaining)
    setSelectedBubbleId(nextSelected.id)
    setCustomOpen(isCustomMode && !nextSelected.text.trim())
    setBubbleGeometries((current) => {
      const next = { ...current }
      delete next[selectedBubble.id]
      return next
    })
    delete bubbleRefs.current[selectedBubble.id]
    delete bubbleTextRefs.current[selectedBubble.id]
    delete curveDirectionInitializedRef.current[selectedBubble.id]
    delete smartPlacementAttemptedRef.current[selectedBubble.id]
    delete manualBubbleOverrideRef.current[selectedBubble.id]
    delete manualConnectorOverrideRef.current[selectedBubble.id]
    markCompositionDirty()
  }

  const updateBubblePosition = useCallback((bubbleId: string, centerX: number, centerY: number) => {
    if (!stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const bubbleRect = bubbleRefs.current[bubbleId]?.getBoundingClientRect()
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
    manualBubbleOverrideRef.current[bubbleId] = true
    updateBubble(bubbleId, { position: { x: nextX, y: nextY } })
    markCompositionDirty()
  }, [markCompositionDirty, updateBubble])

  const handlePointerDown = (bubbleId: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!stageRef.current || !bubbleRefs.current[bubbleId]) return
    setSelectedBubbleId(bubbleId)
    event.preventDefault()
    const bubbleRect = bubbleRefs.current[bubbleId].getBoundingClientRect()
    bubbleGrabOffsetRef.current = {
      x: event.clientX - (bubbleRect.left + bubbleRect.width / 2),
      y: event.clientY - (bubbleRect.top + bubbleRect.height / 2),
    }
    dragPointerId.current = event.pointerId
    dragBubbleIdRef.current = bubbleId
    setDraggingBubbleId(bubbleId)
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerId.current !== event.pointerId || !dragBubbleIdRef.current) return
    const offset = bubbleGrabOffsetRef.current ?? { x: 0, y: 0 }
    updateBubblePosition(
      dragBubbleIdRef.current,
      event.clientX - offset.x,
      event.clientY - offset.y,
    )
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerId.current !== event.pointerId) return
    dragPointerId.current = null
    dragBubbleIdRef.current = null
    bubbleGrabOffsetRef.current = null
    setIsDragging(false)
    setDraggingBubbleId(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleBubbleKeyDown = (bubbleId: string, event: KeyboardEvent<HTMLDivElement>) => {
    const bubble = bubbles.find((item) => item.id === bubbleId)
    if (!bubble || !stageRef.current) return
    const step = event.shiftKey ? 5 : 2
    let nextPosition: Position | null = null
    if (event.key === 'ArrowLeft') nextPosition = { x: bubble.position.x - step, y: bubble.position.y }
    if (event.key === 'ArrowRight') nextPosition = { x: bubble.position.x + step, y: bubble.position.y }
    if (event.key === 'ArrowUp') nextPosition = { x: bubble.position.x, y: bubble.position.y - step }
    if (event.key === 'ArrowDown') nextPosition = { x: bubble.position.x, y: bubble.position.y + step }
    if (!nextPosition) return
    event.preventDefault()
    const rect = stageRef.current?.getBoundingClientRect()
    const bubbleRect = bubbleRefs.current[bubbleId]?.getBoundingClientRect()
    const bounds = rect
      ? getBubblePositionBounds(rect.width, rect.height, bubbleRect?.width, bubbleRect?.height)
      : { minX: 16, maxX: 84, minY: 16, maxY: 82 }
    const nextX = clamp(nextPosition.x, bounds.minX, bounds.maxX)
    manualBubbleOverrideRef.current[bubbleId] = true
    updateBubble(bubbleId, {
      position: { x: nextX, y: clamp(nextPosition.y, bounds.minY, bounds.maxY) },
    })
    markCompositionDirty()
  }

  const adjustBubbleScale = (bubbleId: string, delta: number) => {
    const bubble = bubbles.find((item) => item.id === bubbleId)
    if (!bubble) return
    manualBubbleOverrideRef.current[bubbleId] = true
    const next = clamp(bubble.scale + delta, minBubbleScale, maxBubbleScale)
    updateBubble(bubbleId, { scale: Math.round(next * 100) / 100 })
    markCompositionDirty()
  }

  const updateConnectorTarget = useCallback((bubbleId: string, clientX: number, clientY: number) => {
    if (!stageRef.current) return
    const bubbleState = bubbles.find((item) => item.id === bubbleId)
    if (!bubbleState) return
    manualConnectorOverrideRef.current[bubbleId] = true
    const rect = stageRef.current.getBoundingClientRect()
    const bubbleRect = bubbleRefs.current[bubbleId]?.getBoundingClientRect()
    const bubble = bubbleRect
      ? {
          x: (bubbleRect.left - rect.left) / rect.width,
          y: (bubbleRect.top - rect.top) / rect.height,
          width: bubbleRect.width / rect.width,
          height: bubbleRect.height / rect.height,
        }
      : null
    const nextTarget =
      validateConnectorTarget(
        bubbleKind,
        {
          x: (clientX - rect.left) / rect.width,
          y: (clientY - rect.top) / rect.height,
        },
        bubble,
        rect.width,
        rect.height,
      )
    updateBubble(bubbleId, { connectorTarget: nextTarget })
    markCompositionDirty()
  }, [bubbleKind, bubbles, markCompositionDirty, updateBubble])

  const handleConnectorPointerDown = (bubbleId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!stageRef.current) return
    setSelectedBubbleId(bubbleId)
    event.preventDefault()
    event.stopPropagation()
    targetPointerId.current = event.pointerId
    targetBubbleIdRef.current = bubbleId
    setDraggingTargetBubbleId(bubbleId)
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
    if (targetBubbleIdRef.current) {
      updateConnectorTarget(targetBubbleIdRef.current, event.clientX, event.clientY)
    }
  }

  const finishConnectorPointer = (event: ReactPointerEvent<HTMLButtonElement>, allowTap: boolean) => {
    if (targetPointerId.current !== event.pointerId) return
    const wasTap = allowTap && !targetPointerMovedRef.current
    const bubbleId = targetBubbleIdRef.current
    targetPointerId.current = null
    targetBubbleIdRef.current = null
    targetPointerStartRef.current = null
    targetPointerMovedRef.current = false
    setIsDraggingTarget(false)
    setDraggingTargetBubbleId(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (wasTap && bubbleId) {
      const bubble = bubbles.find((item) => item.id === bubbleId)
      if (!bubble) return
      curveDirectionInitializedRef.current[bubbleId] = true
      updateBubble(bubbleId, { curveDirection: bubble.curveDirection === 1 ? -1 : 1 })
      markCompositionDirty()
    }
  }

  const handleConnectorPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    finishConnectorPointer(event, true)
  }

  const handleConnectorPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    finishConnectorPointer(event, false)
  }

  const handleConnectorKeyDown = (bubbleId: string, event: KeyboardEvent<HTMLButtonElement>) => {
    const bubble = bubbles.find((item) => item.id === bubbleId)
    if (!bubble) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      curveDirectionInitializedRef.current[bubbleId] = true
      updateBubble(bubbleId, { curveDirection: bubble.curveDirection === 1 ? -1 : 1 })
      markCompositionDirty()
      return
    }
    const step = event.shiftKey ? 0.05 : 0.025
    let nextTarget: ConnectorTarget | null = null
    if (event.key === 'ArrowLeft') nextTarget = { x: bubble.connectorTarget.x - step, y: bubble.connectorTarget.y }
    if (event.key === 'ArrowRight') nextTarget = { x: bubble.connectorTarget.x + step, y: bubble.connectorTarget.y }
    if (event.key === 'ArrowUp') nextTarget = { x: bubble.connectorTarget.x, y: bubble.connectorTarget.y - step }
    if (event.key === 'ArrowDown') nextTarget = { x: bubble.connectorTarget.x, y: bubble.connectorTarget.y + step }
    if (!nextTarget) return
    event.preventDefault()
    manualConnectorOverrideRef.current[bubbleId] = true
    const rect = stageRef.current?.getBoundingClientRect()
    const bubbleRect = stageRef.current && bubbleRefs.current[bubbleId]
      ? bubbleRefs.current[bubbleId].getBoundingClientRect()
      : null
    const bubbleBox = rect && bubbleRect
      ? {
          x: (bubbleRect.left - rect.left) / rect.width,
          y: (bubbleRect.top - rect.top) / rect.height,
          width: bubbleRect.width / rect.width,
          height: bubbleRect.height / rect.height,
        }
      : null
    updateBubble(bubbleId, {
      connectorTarget: rect
        ? validateConnectorTarget(
            bubbleKind,
            nextTarget,
            bubbleBox,
            rect.width,
            rect.height,
          )
        : nextTarget,
    })
    markCompositionDirty()
  }

  const drawPetSaysBrandMark = (
    context: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    logoImage: HTMLImageElement,
  ) => {
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

  const createPetSaysImageBlob = async (): Promise<Blob | null> => {
    const exportableBubbles = bubbles.filter((bubble) => Boolean(bubble.text.trim()))
    if (!photo || !hasRenderableBubble || !stageRef.current || exportableBubbles.length === 0) return null

    const image = new window.Image()
    image.src = photo.src
    const logoImage = new window.Image()
    logoImage.src = '/brand/petsays-wordmark.png'
    await document.fonts.ready
    await image.decode()
    await logoImage.decode()

    const stageRect = stageRef.current.getBoundingClientRect()
    const scale = photo.naturalWidth / stageRect.width
    const canvas = document.createElement('canvas')
    canvas.width = photo.naturalWidth
    canvas.height = photo.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) return null

    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    for (const bubble of exportableBubbles) {
      const bubbleGeometry = bubbleGeometries[bubble.id]
      const resolvedConnector = resolvedConnectors[bubble.id]
      if (!bubbleGeometry || !resolvedConnector) return null
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
    }

    for (const bubble of exportableBubbles) {
      const bubbleElement = bubbleRefs.current[bubble.id]
      const bubbleTextElement = bubbleTextRefs.current[bubble.id]
      if (!bubbleElement || !bubbleTextElement) return null
      const bubbleRect = bubbleElement.getBoundingClientRect()
      const textRect = bubbleTextElement.getBoundingClientRect()
      const computed = window.getComputedStyle(bubbleTextElement)
      const fontSize = Number.parseFloat(computed.fontSize) * bubble.scale * scale
      const padding = Number.parseFloat(computed.paddingLeft) * bubble.scale * scale
      const lineHeightValue = Number.parseFloat(computed.lineHeight)
      const lineHeight = (Number.isFinite(lineHeightValue) ? lineHeightValue * bubble.scale : fontSize * 1.22) * scale
      const bubbleX = (bubbleRect.left - stageRect.left) * scale
      const bubbleY = (bubbleRect.top - stageRect.top) * scale
      const bubbleWidth = bubbleRect.width * scale
      const bubbleHeight = bubbleRect.height * scale
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
      const lines = wrapText(context, bubble.text, textWidth)
      const totalHeight = lines.length * lineHeight
      const firstY = textY - totalHeight / 2 + lineHeight / 2
      lines.forEach((line, index) => context.fillText(line, textX, firstY + index * lineHeight))
      context.restore()
    }

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

  if (!photo) {
    return (
      <PublicHome
        fileInputRef={fileInputRef}
        onFileChange={handleFileInput}
        onHome={handleHome}
        onUpload={() => fileInputRef.current?.click()}
      />
    )
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
        <section className={`maker-section ${isEditorMode ? 'has-result' : 'is-vibe-picker'}`} aria-labelledby="maker-title">
            <DecorativeSpots page={isEditorMode ? 'result' : 'picker'} />
            <div className="maker-topline">
              <div>
                {!isEditorMode && <p className="eyebrow">Photo received</p>}
                <h1 id="maker-title" className={isEditorMode ? 'result-page-title' : 'vibe-picker-title'}>
                  {isEditorMode ? 'Your pet has opinions.' : 'Pick a vibe.'}
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

            <div className={`maker-layout ${isEditorMode ? 'has-result' : ''}`}>
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
                    {bubbles.map((bubble, index) => {
                      const hasRealText = Boolean(bubble.text.trim())
                      const isSelected = bubble.id === selectedBubble?.id
                      const showPlaceholder = isSelected && isCustomMode && !hasRealText
                      const displayText = hasRealText ? bubble.text : showPlaceholder ? 'Type something…' : ''
                      if (!isEditorMode || !displayText) return null
                      const geometry = bubbleGeometries[bubble.id]
                      const connector = resolvedConnectors[bubble.id]

                      return (
                        <Fragment key={bubble.id}>
                          {geometry && connector && (
                            <BubbleConnector
                              kind={bubbleKind}
                              bubble={geometry}
                              target={bubble.connectorTarget}
                              curveDirection={bubble.curveDirection}
                              width={stageSize.width}
                              height={stageSize.height}
                              geometry={connector}
                            />
                          )}
                          <div
                            ref={(element) => {
                              if (element) bubbleRefs.current[bubble.id] = element
                              else delete bubbleRefs.current[bubble.id]
                            }}
                            className={`bubble-group ${isSelected ? 'is-selected' : ''} ${isDragging && draggingBubbleId === bubble.id ? 'is-dragging' : ''}`}
                            style={{
                              left: `${bubble.position.x}%`,
                              top: `${bubble.position.y}%`,
                              '--bubble-scale': bubble.scale,
                              '--bubble-outer-max-width': `${bubbleOuterMaxWidth}px`,
                              '--bubble-text-max-width': `${bubbleTextMaxWidth}px`,
                            } as CSSProperties}
                            data-bubble-id={bubble.id}
                            data-bubble-scale={bubble.scale.toFixed(2)}
                            onPointerDown={(event) => handlePointerDown(bubble.id, event)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onClick={() => handleSelectBubble(bubble.id)}
                            onKeyDown={(event) => handleBubbleKeyDown(bubble.id, event)}
                            role="group"
                            tabIndex={0}
                            aria-label={`Thought bubble ${index + 1}${isSelected ? ', selected' : ''}. Use arrow keys to move it around the photo.`}
                            title="Tap to edit this bubble"
                          >
                            <BubbleGraphic
                              kind={bubbleKind}
                              text={displayText}
                              className={`${getBubbleCopyClass(bubble.text)}${showPlaceholder ? ' bubble-placeholder' : ''}`}
                              textRef={(element) => {
                                if (element) bubbleTextRefs.current[bubble.id] = element
                                else delete bubbleTextRefs.current[bubble.id]
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            className={`connector-handle ${isSelected ? 'is-selected' : ''} ${isDraggingTarget && draggingTargetBubbleId === bubble.id ? 'is-dragging' : ''}`}
                            style={{ left: `${bubble.connectorTarget.x * 100}%`, top: `${bubble.connectorTarget.y * 100}%` }}
                            onPointerDown={(event) => handleConnectorPointerDown(bubble.id, event)}
                            onPointerMove={handleConnectorPointerMove}
                            onPointerUp={handleConnectorPointerUp}
                            onPointerCancel={handleConnectorPointerCancel}
                            onKeyDown={(event) => handleConnectorKeyDown(bubble.id, event)}
                            aria-label={`Drag connector tip for bubble ${index + 1}, or tap to flip the curve`}
                            title="Drag to point; tap to flip curve"
                          >
                            <span aria-hidden="true" />
                          </button>
                        </Fragment>
                      )
                    })}
                  </div>
                  {hasBubblePreview && (
                    <div className="bubble-size-row" role="group" aria-label="Adjust thought bubble size">
                      <span className="bubble-size-label">Bubble size</span>
                      <div className="bubble-size-control">
                        <button
                          type="button"
                          className="bubble-size-button"
                          onClick={() => selectedBubble && adjustBubbleScale(selectedBubble.id, -bubbleScaleStep)}
                          disabled={!selectedBubble || selectedBubble.scale <= minBubbleScale}
                          aria-label="Decrease bubble size"
                          title="Make bubble smaller"
                        >
                          −
                        </button>
                        <span className="bubble-size-divider" aria-hidden="true" />
                        <button
                          type="button"
                          className="bubble-size-button"
                          onClick={() => selectedBubble && adjustBubbleScale(selectedBubble.id, bubbleScaleStep)}
                          disabled={!selectedBubble || selectedBubble.scale >= maxBubbleScale}
                          aria-label="Increase bubble size"
                          title="Make bubble larger"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {hasRenderableBubble && (
                  <p className="drag-hint">
                    <span className="drag-hint-copy">
                      <span className="drag-hint-line">Drag the bubble.</span>
                      <span className="drag-hint-line">Point the tail.</span>
                      <span className="drag-hint-line">Tap to curve it.</span>
                    </span>
                    <span className="drag-hint-heart" aria-hidden="true">♡</span>
                  </p>
                )}
                {hasRenderableBubble && (
                  <div className="result-completion result-completion-mobile">
                    <div className="completion-actions">
                      <button
                        type="button"
                        className="download-button"
                        onClick={handleDownload}
                      >
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

                    <p
                      className={`download-note ${
                        downloaded || shareStatus ? 'is-done' : ''
                      }`}
                    >
                      {shareStatus ??
                        (downloaded
                          ? 'Saved as a photo. Make another?'
                          : 'Free, includes a small PetSays mark, no signup.')}
                    </p>
                  </div>
                )}
              </div>

              <div className="controls-column">
                {!isEditorMode ? (
                  <div className="vibe-picker">
                    <div className="custom-entry">
                      <p className="custom-entry-copy">Know exactly what your pet should say?</p>
                      <button
                        type="button"
                        className="custom-entry-button"
                        onClick={startCustomMode}
                      >
                        <span className="custom-entry-icon" aria-hidden="true">✎</span>
                        <span>Write my own line</span>
                      </button>
                    </div>
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
                        <p className="eyebrow">
                          {selectedVibe
                            ? `${selectedVibe.label} · ${selectedVibe.eyebrow}`
                            : 'YOUR JOKE'}
                        </p>
                        <button type="button" className="back-to-vibes" onClick={handleChangeVibe}>
                          ← Change vibe
                        </button>
                      </div>
                      <h2>{selectedVibe ? 'Does this sound right?' : 'Make your pet say it.'}</h2>
                    </div>

                    {selectedVibe && (
                      <div className="line-list" aria-label="Alternate funny lines">
                        {visibleLineIndices.map((index) => {
                          const line = selectedVibe.lines[index]

                          return (
                            <button
                              type="button"
                              key={`${suggestionBatch}-${index}-${line}`}
                              className={`line-chip ${selectedBubble?.lineIndex === index && !customOpen ? 'selected' : ''}`}
                              onClick={() => chooseLine(index)}
                            >
                              {line}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {selectedVibe && (
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
                          aria-controls="custom-line"
                        >
                          <span className="write-icon" aria-hidden="true">✎</span>
                          <span>Write my own line</span>
                        </button>
                      </div>
                    )}

                    {customOpen && (
                      <div className={`custom-copy ${!selectedVibe ? 'custom-copy-direct' : ''}`}>
                        <label htmlFor="custom-line">Your line</label>
                        <textarea
                          ref={textAreaRef}
                          id="custom-line"
                          value={selectedBubble?.text ?? ''}
                          maxLength={120}
                          rows={2}
                          onChange={(event) => {
                            if (selectedBubble) {
                              updateBubble(selectedBubble.id, { text: event.target.value })
                            }
                            markCompositionDirty()
                          }}
                          placeholder="What is your pet thinking?"
                        />
                        <span className="character-count">{selectedBubble?.text.length ?? 0}/120</span>
                      </div>
                    )}

                    <div className="bubble-manage-row">
                      <button
                        type="button"
                        className="add-bubble-button"
                        onClick={handleAddBubble}
                        disabled={bubbles.length >= maxBubbles}
                      >
                        + Add another bubble
                      </button>
                      {bubbles.length > 1 && (
                        <button
                          type="button"
                          className="remove-bubble-button"
                          onClick={handleRemoveBubble}
                        >
                          Remove bubble
                        </button>
                      )}
                    </div>
                    {bubbles.length > 1 && (
                      <p className="bubble-selection-note">Tap a bubble to edit it.</p>
                    )}

                    {hasRenderableBubble && (
                      <div className="result-completion result-completion-desktop">
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
                    )}

                  </div>
                )}
              </div>
            </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  )
}

export default App
