import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { BubbleConnector } from './components/BubbleConnector'
import { BubbleGraphic } from './components/BubbleGraphic'
import { PublicSiteFooter, PublicSiteHeader } from './components/PublicSiteChrome'
import { vibes, type VibeId } from './data/presets'
import type { Story } from './data/stories'
import {
  getDefaultCurveDirection,
  resolveConnectorGeometry,
  validateConnectorTarget,
  type BubbleBox,
  type ConnectorTarget,
  type CurveDirection,
} from './utils/bubbleConnector'
import { getBubblePositionBounds } from './utils/bubblePlacement'
import { getRandomStory } from './utils/storyEngine'
import {
  createStoryFiles,
  createStoryImageBlobs,
  createStoryZip,
  type StoryExportFrame,
} from './utils/storiesExport'
import { downloadBlob } from './utils/canvasExport'
import './Stories.css'

type StoryPhoto = {
  src: string
  name: string
}

type StoriesStep = 'upload' | 'vibes' | 'story'

type Position = {
  x: number
  y: number
}

type StoryBubbleLayout = {
  position: Position
  scale: number
  connectorTarget: ConnectorTarget
  curveDirection: CurveDirection
}

type StageSize = {
  width: number
  height: number
}

const storyBubbleKind = 'thought' as const
const defaultFramePosition: Position = { x: 50, y: 24 }
const defaultFrameTarget: ConnectorTarget = { x: 0.5, y: 0.72 }
const minBubbleScale = 0.74
const maxBubbleScale = 1.28
const bubbleScaleStep = 0.08

const storiesIntroPreviewFrames = [
  { line: 'Hmm… what’s this?', color: '#ffda63', rotation: '-6deg', left: '27%', top: '4%' },
  { line: 'Oh. You’re eating again?', color: '#f6c1ad', rotation: '5deg', left: '50%', top: '10%' },
  { line: 'Unbelievable. This is my villain origin story.', color: '#c9e7dc', rotation: '10deg', left: '73%', top: '17%' },
] as const

function getStorySlideKey(storyId: string, slideIndex: number) {
  return `${storyId}:${slideIndex}`
}

function createStoryBubbleLayout(): StoryBubbleLayout {
  return {
    position: defaultFramePosition,
    scale: 1,
    connectorTarget: defaultFrameTarget,
    curveDirection: 1,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max)
}

function getFrameScaleLimit(
  stageWidth: number,
  stageHeight: number,
  bubbleWidth: number,
  bubbleHeight: number,
  currentScale: number,
) {
  const safeScale = Math.max(currentScale, 0.01)
  const baseWidth = bubbleWidth / safeScale
  const baseHeight = bubbleHeight / safeScale
  const widthLimit = (stageWidth - 20) / Math.max(baseWidth, 1)
  const heightLimit = (stageHeight - 20) / Math.max(baseHeight, 1)
  return Math.max(minBubbleScale, Math.min(maxBubbleScale, widthLimit, heightLimit))
}

export function StoriesApp() {
  const [step, setStep] = useState<StoriesStep>('upload')
  const [photo, setPhoto] = useState<StoryPhoto | null>(null)
  const [vibeId, setVibeId] = useState<VibeId | null>(null)
  const [story, setStory] = useState<Story | null>(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const [storyLayout, setStoryLayout] = useState<StoryBubbleLayout | null>(null)
  // These are measured DOM boxes, not editable layout state. Each slide needs
  // its own measurement because the story text can change the bubble's size.
  const [bubbleMeasurements, setBubbleMeasurements] = useState<Record<string, BubbleBox>>({})
  const [slideMeasurements, setSlideMeasurements] = useState<Record<string, StageSize>>({})
  const [storyScaleLimit, setStoryScaleLimit] = useState(maxBubbleScale)
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoUrlRef = useRef<string | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollFrameRef = useRef<number | null>(null)
  const slideRefs = useRef<Record<string, HTMLElement | null>>({})
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const storyTextRefs = useRef<Record<string, HTMLSpanElement | null>>({})
  const curveDirectionInitializedRef = useRef(false)
  const dragPointerId = useRef<number | null>(null)
  const dragSlideKeyRef = useRef<string | null>(null)
  const bubbleGrabOffsetRef = useRef<Position | null>(null)
  const targetPointerId = useRef<number | null>(null)
  const targetSlideKeyRef = useRef<string | null>(null)
  const targetPointerStartRef = useRef<Position | null>(null)
  const targetPointerMovedRef = useRef(false)
  const targetDragThresholdRef = useRef(8)

  const activeBubbleScaleLimit = storyScaleLimit

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  const resetCarousel = useCallback(() => {
    setActiveSlide(0)
    window.requestAnimationFrame(() => {
      trackRef.current?.scrollTo({ left: 0, behavior: 'auto' })
    })
  }, [])

  const updateStoryLayout = useCallback((patch: Partial<StoryBubbleLayout>) => {
    setExportStatus(null)
    setStoryLayout((current) => ({
      ...(current ?? createStoryBubbleLayout()),
      ...patch,
    }))
  }, [])

  const loadStory = useCallback((nextStory: Story) => {
    setExportStatus(null)
    setBubbleMeasurements({})
    setSlideMeasurements({})
    setStoryScaleLimit(maxBubbleScale)
    setStory(nextStory)
    resetCarousel()
  }, [resetCarousel])

  useEffect(() => () => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    if (scrollFrameRef.current) window.cancelAnimationFrame(scrollFrameRef.current)
  }, [])

  const handleFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return

    const src = URL.createObjectURL(file)
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    photoUrlRef.current = src
    setPhoto({ src, name: file.name })
    setExportStatus(null)
    setVibeId(null)
    setStory(null)
    setStoryLayout(null)
    setBubbleMeasurements({})
    setSlideMeasurements({})
    setStoryScaleLimit(maxBubbleScale)
    curveDirectionInitializedRef.current = false
    setStep('vibes')
    resetCarousel()
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleVibe = (nextVibeId: VibeId) => {
    setVibeId(nextVibeId)
    if (!storyLayout) {
      curveDirectionInitializedRef.current = false
      setStoryLayout(createStoryBubbleLayout())
    }
    loadStory(getRandomStory(nextVibeId))
    setStep('story')
  }

  const handleAnotherStory = () => {
    if (!vibeId) return
    curveDirectionInitializedRef.current = false
    setStoryLayout(createStoryBubbleLayout())
    loadStory(getRandomStory(vibeId))
  }

  const goToSlide = (index: number, behavior: ScrollBehavior = 'smooth') => {
    const track = trackRef.current
    if (!track || !story) return
    const nextIndex = Math.min(Math.max(index, 0), story.slides.length - 1)
    track.scrollTo({ left: track.clientWidth * nextIndex, behavior })
    setActiveSlide(nextIndex)
  }

  const handleCarouselScroll = () => {
    if (scrollFrameRef.current) window.cancelAnimationFrame(scrollFrameRef.current)
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      const track = trackRef.current
      if (!track || !story || track.clientWidth === 0) return
      const nextIndex = Math.min(
        story.slides.length - 1,
        Math.max(0, Math.round(track.scrollLeft / track.clientWidth)),
      )
      setActiveSlide(nextIndex)
    })
  }

  const handleCarouselKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goToSlide(activeSlide - 1)
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      goToSlide(activeSlide + 1)
    }
  }

  useLayoutEffect(() => {
    if (!story || !storyLayout) return

    const nextBubbleMeasurements: Record<string, BubbleBox> = {}
    const nextSlideMeasurements: Record<string, StageSize> = {}
    let sharedMinX = 0
    let sharedMaxX = 100
    let sharedMinY = 0
    let sharedMaxY = 100
    let nextScaleLimit = maxBubbleScale

    story.slides.forEach((_, index) => {
      const slideKey = getStorySlideKey(story.id, index)
      const slide = slideRefs.current[slideKey]
      const bubble = bubbleRefs.current[slideKey]
      if (!slide || !bubble) return

      const slideRect = slide.getBoundingClientRect()
      const bubbleRect = bubble.getBoundingClientRect()
      if (!slideRect.width || !slideRect.height) return

      const geometry: BubbleBox = {
        x: (bubbleRect.left - slideRect.left) / slideRect.width,
        y: (bubbleRect.top - slideRect.top) / slideRect.height,
        width: bubbleRect.width / slideRect.width,
        height: bubbleRect.height / slideRect.height,
      }
      const stageSize = { width: slideRect.width, height: slideRect.height }
      nextBubbleMeasurements[slideKey] = geometry
      nextSlideMeasurements[slideKey] = stageSize

      nextScaleLimit = Math.min(
        nextScaleLimit,
        getFrameScaleLimit(
          slideRect.width,
          slideRect.height,
          bubbleRect.width,
          bubbleRect.height,
          storyLayout.scale,
        ),
      )

      const bounds = getBubblePositionBounds(
        slideRect.width,
        slideRect.height,
        bubbleRect.width,
        bubbleRect.height,
      )
      sharedMinX = Math.max(sharedMinX, bounds.minX)
      sharedMaxX = Math.min(sharedMaxX, bounds.maxX)
      sharedMinY = Math.max(sharedMinY, bounds.minY)
      sharedMaxY = Math.min(sharedMaxY, bounds.maxY)
    })

    const firstGeometry = Object.values(nextBubbleMeasurements)[0]
    const firstStageSize = Object.values(nextSlideMeasurements)[0]
    if (!firstGeometry || !firstStageSize) return

    const nextPosition = {
      x: clamp(storyLayout.position.x, sharedMinX, sharedMaxX),
      y: clamp(storyLayout.position.y, sharedMinY, sharedMaxY),
    }
    const nextScale = clamp(storyLayout.scale, minBubbleScale, nextScaleLimit)
    const nextTarget = curveDirectionInitializedRef.current
      ? storyLayout.connectorTarget
      : validateConnectorTarget(
          storyBubbleKind,
          storyLayout.connectorTarget,
          firstGeometry,
          firstStageSize.width,
          firstStageSize.height,
        )
    const nextCurveDirection = curveDirectionInitializedRef.current
      ? storyLayout.curveDirection
      : getDefaultCurveDirection(
          storyBubbleKind,
          firstGeometry,
          nextTarget,
          firstStageSize.width,
          firstStageSize.height,
        )
    curveDirectionInitializedRef.current = true

    const frame = window.requestAnimationFrame(() => {
      setBubbleMeasurements((current) => {
        const keys = Object.keys(nextBubbleMeasurements)
        if (
          Object.keys(current).length === keys.length &&
          keys.every((key) => {
            const previous = current[key]
            const next = nextBubbleMeasurements[key]
            return previous && next && previous.x === next.x && previous.y === next.y && previous.width === next.width && previous.height === next.height
          })
        ) return current
        return nextBubbleMeasurements
      })

      setSlideMeasurements((current) => {
        const keys = Object.keys(nextSlideMeasurements)
        if (
          Object.keys(current).length === keys.length &&
          keys.every((key) => {
            const previous = current[key]
            const next = nextSlideMeasurements[key]
            return previous && next && previous.width === next.width && previous.height === next.height
          })
        ) return current
        return nextSlideMeasurements
      })

      setStoryScaleLimit((current) => current === nextScaleLimit ? current : nextScaleLimit)
      setStoryLayout((current) => {
        if (!current) return current
        if (
          current.position.x === nextPosition.x &&
          current.position.y === nextPosition.y &&
          current.scale === nextScale &&
          current.connectorTarget.x === nextTarget.x &&
          current.connectorTarget.y === nextTarget.y &&
          current.curveDirection === nextCurveDirection
        ) return current
        return {
          ...current,
          position: nextPosition,
          scale: nextScale,
          connectorTarget: nextTarget,
          curveDirection: nextCurveDirection,
        }
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [story, storyLayout])

  const updateBubblePosition = useCallback((slideKey: string, centerX: number, centerY: number) => {
    const slide = slideRefs.current[slideKey]
    const bubble = bubbleRefs.current[slideKey]
    if (!slide || !bubble) return

    const slideRect = slide.getBoundingClientRect()
    const bubbleRect = bubble.getBoundingClientRect()
    const bounds = getBubblePositionBounds(
      slideRect.width,
      slideRect.height,
      bubbleRect.width,
      bubbleRect.height,
    )
    updateStoryLayout({
      position: {
        x: clamp(((centerX - slideRect.left) / slideRect.width) * 100, bounds.minX, bounds.maxX),
        y: clamp(((centerY - slideRect.top) / slideRect.height) * 100, bounds.minY, bounds.maxY),
      },
    })
  }, [updateStoryLayout])

  const handleBubblePointerDown = (slideKey: string, event: ReactPointerEvent<HTMLDivElement>) => {
    const bubble = bubbleRefs.current[slideKey]
    if (!bubble) return
    event.preventDefault()
    const bubbleRect = bubble.getBoundingClientRect()
    bubbleGrabOffsetRef.current = {
      x: event.clientX - (bubbleRect.left + bubbleRect.width / 2),
      y: event.clientY - (bubbleRect.top + bubbleRect.height / 2),
    }
    dragPointerId.current = event.pointerId
    dragSlideKeyRef.current = slideKey
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleBubblePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerId.current !== event.pointerId || !dragSlideKeyRef.current) return
    event.preventDefault()
    const offset = bubbleGrabOffsetRef.current ?? { x: 0, y: 0 }
    updateBubblePosition(
      dragSlideKeyRef.current,
      event.clientX - offset.x,
      event.clientY - offset.y,
    )
  }

  const handleBubblePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerId.current !== event.pointerId) return
    dragPointerId.current = null
    dragSlideKeyRef.current = null
    bubbleGrabOffsetRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleBubbleKeyDown = (slideKey: string, event: KeyboardEvent<HTMLDivElement>) => {
    const slide = slideRefs.current[slideKey]
    const bubble = bubbleRefs.current[slideKey]
    if (!storyLayout || !slide || !bubble) return

    const step = event.shiftKey ? 5 : 2
    let nextPosition: Position | null = null
    if (event.key === 'ArrowLeft') nextPosition = { x: storyLayout.position.x - step, y: storyLayout.position.y }
    if (event.key === 'ArrowRight') nextPosition = { x: storyLayout.position.x + step, y: storyLayout.position.y }
    if (event.key === 'ArrowUp') nextPosition = { x: storyLayout.position.x, y: storyLayout.position.y - step }
    if (event.key === 'ArrowDown') nextPosition = { x: storyLayout.position.x, y: storyLayout.position.y + step }
    if (!nextPosition) return

    event.preventDefault()
    event.stopPropagation()
    const slideRect = slide.getBoundingClientRect()
    const bubbleRect = bubble.getBoundingClientRect()
    const bounds = getBubblePositionBounds(
      slideRect.width,
      slideRect.height,
      bubbleRect.width,
      bubbleRect.height,
    )
    updateStoryLayout({
      position: {
        x: clamp(nextPosition.x, bounds.minX, bounds.maxX),
        y: clamp(nextPosition.y, bounds.minY, bounds.maxY),
      },
    })
  }

  const adjustBubbleScale = (delta: number) => {
    if (!storyLayout) return
    const nextScale = clamp(storyLayout.scale + delta, minBubbleScale, activeBubbleScaleLimit)
    updateStoryLayout({ scale: Math.round(nextScale * 100) / 100 })
  }

  const updateConnectorTarget = useCallback((slideKey: string, clientX: number, clientY: number) => {
    const slide = slideRefs.current[slideKey]
    const bubble = bubbleRefs.current[slideKey]
    if (!slide || !bubble) return

    const slideRect = slide.getBoundingClientRect()
    const bubbleRect = bubble.getBoundingClientRect()
    const bubbleBox: BubbleBox = {
      x: (bubbleRect.left - slideRect.left) / slideRect.width,
      y: (bubbleRect.top - slideRect.top) / slideRect.height,
      width: bubbleRect.width / slideRect.width,
      height: bubbleRect.height / slideRect.height,
    }
    const nextTarget = validateConnectorTarget(
      storyBubbleKind,
      {
        x: (clientX - slideRect.left) / slideRect.width,
        y: (clientY - slideRect.top) / slideRect.height,
      },
      bubbleBox,
      slideRect.width,
      slideRect.height,
    )
    updateStoryLayout({ connectorTarget: nextTarget })
  }, [updateStoryLayout])

  const handleConnectorPointerDown = (slideKey: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    targetPointerId.current = event.pointerId
    targetSlideKeyRef.current = slideKey
    targetPointerStartRef.current = { x: event.clientX, y: event.clientY }
    targetPointerMovedRef.current = false
    targetDragThresholdRef.current = event.pointerType === 'touch' ? 12 : event.pointerType === 'pen' ? 9 : 6
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleConnectorPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (targetPointerId.current !== event.pointerId) return
    event.preventDefault()
    const start = targetPointerStartRef.current
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) >= targetDragThresholdRef.current
    ) {
      targetPointerMovedRef.current = true
    }
    if (targetPointerMovedRef.current && targetSlideKeyRef.current) {
      updateConnectorTarget(targetSlideKeyRef.current, event.clientX, event.clientY)
    }
  }

  const finishConnectorPointer = (event: ReactPointerEvent<HTMLButtonElement>, allowTap: boolean) => {
    if (targetPointerId.current !== event.pointerId) return
    const wasTap = allowTap && !targetPointerMovedRef.current
    const slideKey = targetSlideKeyRef.current
    targetPointerId.current = null
    targetSlideKeyRef.current = null
    targetPointerStartRef.current = null
    targetPointerMovedRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (wasTap && slideKey && storyLayout) {
      updateStoryLayout({ curveDirection: storyLayout.curveDirection === 1 ? -1 : 1 })
    }
  }

  const handleConnectorPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    finishConnectorPointer(event, true)
  }

  const handleConnectorPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    finishConnectorPointer(event, false)
  }

  const handleConnectorKeyDown = (slideKey: string, event: KeyboardEvent<HTMLButtonElement>) => {
    const slide = slideRefs.current[slideKey]
    const bubble = bubbleRefs.current[slideKey]
    if (!storyLayout || !slide || !bubble) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      updateStoryLayout({ curveDirection: storyLayout.curveDirection === 1 ? -1 : 1 })
      return
    }

    const step = event.shiftKey ? 0.05 : 0.025
    let nextTarget: ConnectorTarget | null = null
    if (event.key === 'ArrowLeft') nextTarget = { x: storyLayout.connectorTarget.x - step, y: storyLayout.connectorTarget.y }
    if (event.key === 'ArrowRight') nextTarget = { x: storyLayout.connectorTarget.x + step, y: storyLayout.connectorTarget.y }
    if (event.key === 'ArrowUp') nextTarget = { x: storyLayout.connectorTarget.x, y: storyLayout.connectorTarget.y - step }
    if (event.key === 'ArrowDown') nextTarget = { x: storyLayout.connectorTarget.x, y: storyLayout.connectorTarget.y + step }
    if (!nextTarget) return

    event.preventDefault()
    event.stopPropagation()
    const slideRect = slide.getBoundingClientRect()
    const bubbleRect = bubble.getBoundingClientRect()
    const bubbleBox: BubbleBox = {
      x: (bubbleRect.left - slideRect.left) / slideRect.width,
      y: (bubbleRect.top - slideRect.top) / slideRect.height,
      width: bubbleRect.width / slideRect.width,
      height: bubbleRect.height / slideRect.height,
    }
    updateStoryLayout({
      connectorTarget: validateConnectorTarget(
        storyBubbleKind,
        nextTarget,
        bubbleBox,
        slideRect.width,
        slideRect.height,
      ),
    })
  }

  const getStoryExportFrames = (): StoryExportFrame[] | null => {
    if (!story || !storyLayout) return null

    const frames = story.slides.map((line, index): StoryExportFrame | null => {
      const slideKey = getStorySlideKey(story.id, index)
      const slide = slideRefs.current[slideKey]
      const bubble = bubbleRefs.current[slideKey]
      const text = storyTextRefs.current[slideKey]
      if (!slide || !bubble || !text) return null

      const slideRect = slide.getBoundingClientRect()
      const bubbleRect = bubble.getBoundingClientRect()
      const textRect = text.getBoundingClientRect()
      if (!slideRect.width || !slideRect.height || !bubbleRect.width || !bubbleRect.height) return null

      const computed = window.getComputedStyle(text)
      const fontSize = Number.parseFloat(computed.fontSize)
      const lineHeight = Number.parseFloat(computed.lineHeight)
      const paddingLeft = Number.parseFloat(computed.paddingLeft)
      const paddingRight = Number.parseFloat(computed.paddingRight)
      const safeFontSize = Number.isFinite(fontSize) ? fontSize : 18

      return {
        bubble: {
          x: (bubbleRect.left - slideRect.left) / slideRect.width,
          y: (bubbleRect.top - slideRect.top) / slideRect.height,
          width: bubbleRect.width / slideRect.width,
          height: bubbleRect.height / slideRect.height,
        },
        bubbleScale: storyLayout.scale,
        connectorTarget: storyLayout.connectorTarget,
        curveDirection: storyLayout.curveDirection,
        slideWidth: slideRect.width,
        text: line,
        textBox: {
          x: (textRect.left - slideRect.left) / slideRect.width,
          y: (textRect.top - slideRect.top) / slideRect.height,
          width: textRect.width / slideRect.width,
          height: textRect.height / slideRect.height,
        },
        textStyle: {
          color: computed.color,
          fontFamily: computed.fontFamily,
          fontSize: safeFontSize,
          fontWeight: computed.fontWeight,
          lineHeight: Number.isFinite(lineHeight) ? lineHeight : safeFontSize * 1.16,
          paddingLeft: Number.isFinite(paddingLeft) ? paddingLeft : 0,
          paddingRight: Number.isFinite(paddingRight) ? paddingRight : 0,
        },
      }
    })

    return frames.every((frame): frame is StoryExportFrame => Boolean(frame)) ? frames : null
  }

  const createStoryExportFiles = async () => {
    if (!photo) throw new Error('The Story photo is not ready.')
    const frames = getStoryExportFrames()
    if (!frames) throw new Error('The Story preview is still getting ready.')
    return createStoryFiles(await createStoryImageBlobs(photo.src, frames))
  }

  const saveStoryZip = async (files: File[]) => {
    const zip = await createStoryZip(files)
    downloadBlob(zip, 'petsays-story.zip')
  }

  const handleDownloadStory = async () => {
    if (isExporting) return
    setIsExporting(true)
    setExportStatus('Preparing 7 slides…')

    try {
      const files = await createStoryExportFiles()
      await saveStoryZip(files)
      setExportStatus('Saved petsays-story.zip')
    } catch {
      setExportStatus('Could not prepare your story. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleShareStory = async () => {
    if (isExporting) return
    setIsExporting(true)
    setExportStatus('Preparing 7 slides…')

    try {
      const files = await createStoryExportFiles()
      let supportsFileShare = false
      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
        try {
          supportsFileShare = navigator.canShare({ files })
        } catch {
          supportsFileShare = false
        }
      }

      if (!supportsFileShare) {
        await saveStoryZip(files)
        setExportStatus('Sharing isn’t available here, so we saved your story instead.')
        return
      }

      try {
        await navigator.share({
          files,
          title: 'PetSays Story',
          text: 'Made with PetSays',
        })
        setExportStatus('Shared via your device.')
      } catch (error) {
        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
          setExportStatus(null)
          return
        }
        await saveStoryZip(files)
        setExportStatus('Sharing didn’t open, so we saved your story instead.')
      }
    } catch {
      setExportStatus('Could not prepare your story. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const changePhoto = () => fileInputRef.current?.click()

  return (
    <div className="stories-shell">
      <PublicSiteHeader />

      <main className="stories-main">
        <input
          ref={fileInputRef}
          id="stories-photo-upload"
          className="visually-hidden"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          aria-label="Upload a pet photo for a story"
        />

        {step === 'upload' && (
          <section className="stories-intro" aria-labelledby="stories-title">
            <div className="stories-intro-copy">
              <p className="eyebrow">PETSAYS STORIES · EXPERIMENT</p>
              <h1 id="stories-title">Turn one<br />pet photo<br />into a whole<br />story.</h1>
              <p>Pick a vibe, then swipe through seven escalating thoughts.</p>
            </div>

            <div className="stories-intro-visual" role="group" aria-label="Example story preview showing the same pet across three escalating frames">
              <span className="stories-intro-note stories-intro-note-top" aria-hidden="true">SAME PHOTO.<br />7 ESCALATING<br />THOUGHTS.</span>
              <span className="stories-intro-note stories-intro-note-side" aria-hidden="true">SWIPE THROUGH<br />THE STORY!</span>
              <span className="stories-intro-note stories-intro-note-bottom" aria-hidden="true">SAME PET.<br />BIGGER FEELINGS.</span>
              <span className="stories-intro-burst stories-intro-burst-sun" aria-hidden="true" />
              <span className="stories-intro-burst stories-intro-burst-coral" aria-hidden="true" />
              <span className="stories-intro-burst stories-intro-burst-mint" aria-hidden="true" />

              <div className="stories-intro-preview-stage">
                {storiesIntroPreviewFrames.map((frame, index) => (
                  <article
                    key={frame.line}
                    className={`stories-intro-preview-card stories-intro-preview-card-${index + 1}`}
                    style={{
                      '--preview-frame-color': frame.color,
                      '--preview-frame-rotation': frame.rotation,
                      '--preview-frame-left': frame.left,
                      '--preview-frame-top': frame.top,
                    } as CSSProperties}
                    aria-label={`Story frame ${index + 1} of 7: ${frame.line}`}
                  >
                    <img
                      src="/demo/pet-cat-gray.jpg"
                      alt={index === 0 ? 'Tabby cat photo used in the PetSays story preview.' : ''}
                      draggable={false}
                    />
                    <div className="stories-intro-preview-wash" aria-hidden="true" />
                    <div className="stories-intro-preview-bubble">
                      <BubbleGraphic kind="thought" text={frame.line} />
                    </div>
                    <span className="stories-intro-preview-counter" aria-hidden="true">{index + 1}/7</span>
                  </article>
                ))}
              </div>

              <div className="stories-intro-preview-controls" aria-hidden="true">
                <span className="stories-intro-preview-arrow">←</span>
                <span className="stories-intro-preview-dots">
                  {Array.from({ length: 7 }, (_, index) => (
                    <span key={index} className={index === 0 ? 'is-active' : ''} />
                  ))}
                </span>
                <span className="stories-intro-preview-arrow">→</span>
              </div>
            </div>

            <div className="stories-intro-actions">
              <button type="button" className="stories-primary-button" onClick={changePhoto}>
                <svg className="stories-upload-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 15V4m0 0 4 4m-4-4L8 8" />
                  <path d="M6.5 13H6a4 4 0 0 0 0 8h12a4 4 0 0 0 0-8h-.5" />
                </svg>
                Upload a pet photo
              </button>
              <p className="stories-trust">One photo. Seven slides. No signup.</p>
            </div>
          </section>
        )}

        {step === 'vibes' && photo && (
          <section className="stories-vibes" aria-labelledby="stories-vibes-title">
            <div className="stories-section-heading">
              <div>
                <p className="eyebrow">PHOTO READY</p>
                <h1 id="stories-vibes-title">Pick a vibe for the story.</h1>
              </div>
              <button type="button" className="stories-text-button" onClick={changePhoto}>Change photo</button>
            </div>
            <div className="stories-photo-preview">
              <img src={photo.src} alt={`Uploaded pet photo: ${photo.name}`} />
              <span>One photo. Seven thoughts.</span>
            </div>
            <div className="stories-vibe-grid" aria-label="Story vibes">
              {vibes.map((vibe) => (
                <button
                  key={vibe.id}
                  type="button"
                  className="stories-vibe-card"
                  onClick={() => handleVibe(vibe.id)}
                  style={{ '--story-vibe-color': vibe.color, '--story-vibe-tint': vibe.tint } as CSSProperties}
                >
                  <strong>{vibe.label}</strong>
                  <span>{vibe.eyebrow}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 'story' && photo && story && vibeId && (
          <section className="stories-viewer" aria-labelledby="stories-viewer-title">
            <div className="stories-viewer-heading">
              <div>
                <p className="eyebrow">{vibes.find((vibe) => vibe.id === vibeId)?.label} STORY</p>
                <h1 id="stories-viewer-title">Swipe through the plot.</h1>
              </div>
              <button type="button" className="stories-text-button" onClick={() => setStep('vibes')}>Change vibe</button>
            </div>

            <div className="stories-editor-workspace">
              <div className="stories-canvas-column">
                <div
                  ref={trackRef}
                  className="stories-track"
                  role="region"
                  aria-label="PetSays story carousel"
                  tabIndex={0}
                  onScroll={handleCarouselScroll}
                  onKeyDown={handleCarouselKeyDown}
                >
                  {story.slides.map((line, index) => {
                    const slideKey = getStorySlideKey(story.id, index)
                    const stageSize = slideMeasurements[slideKey]
                    const geometry = bubbleMeasurements[slideKey]
                    const connector = stageSize && geometry
                      ? resolveConnectorGeometry(
                          storyBubbleKind,
                          geometry,
                          storyLayout?.connectorTarget ?? defaultFrameTarget,
                          stageSize.width,
                          stageSize.height,
                          storyLayout?.curveDirection ?? 1,
                        )
                      : null
                    const isActiveFrame = index === activeSlide

                    return (
                      <article
                        key={slideKey}
                        ref={(element) => {
                          if (element) slideRefs.current[slideKey] = element
                          else delete slideRefs.current[slideKey]
                        }}
                        className="story-slide"
                        aria-label={`Slide ${index + 1} of ${story.slides.length}`}
                      >
                        <img className="story-slide-photo" src={photo.src} alt="" draggable={false} />
                        <div className="stories-slide-wash" aria-hidden="true" />
                        {connector && stageSize && (
                          <BubbleConnector
                            kind={storyBubbleKind}
                            bubble={geometry}
                            target={storyLayout?.connectorTarget ?? defaultFrameTarget}
                            curveDirection={storyLayout?.curveDirection ?? 1}
                            width={stageSize.width}
                            height={stageSize.height}
                            geometry={connector}
                            className="stories-bubble-connector"
                          />
                        )}
                        <div
                          ref={(element) => {
                            if (element) bubbleRefs.current[slideKey] = element
                            else delete bubbleRefs.current[slideKey]
                          }}
                          className={`bubble-group stories-bubble ${isActiveFrame ? 'is-selected' : 'stories-bubble-inactive'}`}
                          style={{
                            left: `${storyLayout?.position.x ?? defaultFramePosition.x}%`,
                            top: `${storyLayout?.position.y ?? defaultFramePosition.y}%`,
                            '--bubble-scale': storyLayout?.scale ?? 1,
                          } as CSSProperties}
                          onPointerDown={isActiveFrame ? (event) => handleBubblePointerDown(slideKey, event) : undefined}
                          onPointerMove={isActiveFrame ? handleBubblePointerMove : undefined}
                          onPointerUp={isActiveFrame ? handleBubblePointerUp : undefined}
                          onPointerCancel={isActiveFrame ? handleBubblePointerUp : undefined}
                          onKeyDown={isActiveFrame ? (event) => handleBubbleKeyDown(slideKey, event) : undefined}
                          role="group"
                          tabIndex={isActiveFrame ? 0 : -1}
                          aria-label={`Thought bubble for slide ${index + 1}${isActiveFrame ? ', selected. Use arrow keys to move it.' : ''}`}
                        >
                          <BubbleGraphic
                            kind={storyBubbleKind}
                            text={line}
                            className="stories-bubble-graphic"
                            textRef={(element) => {
                              if (element) storyTextRefs.current[slideKey] = element
                              else delete storyTextRefs.current[slideKey]
                            }}
                          />
                        </div>
                        {isActiveFrame && (
                          <button
                            type="button"
                            className="connector-handle is-selected"
                            style={{
                              left: `${(storyLayout?.connectorTarget.x ?? defaultFrameTarget.x) * 100}%`,
                              top: `${(storyLayout?.connectorTarget.y ?? defaultFrameTarget.y) * 100}%`,
                            }}
                            onPointerDown={(event) => handleConnectorPointerDown(slideKey, event)}
                            onPointerMove={handleConnectorPointerMove}
                            onPointerUp={handleConnectorPointerUp}
                            onPointerCancel={handleConnectorPointerCancel}
                            onKeyDown={(event) => handleConnectorKeyDown(slideKey, event)}
                            aria-label="Drag thought connector target, or press Enter to flip the curve"
                            title="Drag to point; tap to flip curve"
                          >
                            <span aria-hidden="true" />
                          </button>
                        )}
                        <span className="stories-slide-number">{index + 1} / {story.slides.length}</span>
                      </article>
                    )
                  })}
                </div>
              </div>

              <aside className="stories-editor-controls" aria-label="Story editing controls">
                {storyLayout && (
                  <div className="bubble-size-row stories-bubble-size-row" role="group" aria-label="Adjust story thought bubble size">
                    <div className="stories-control-copy">
                      <span className="bubble-size-label">Bubble size</span>
                      <span className="stories-control-helper">Make it bigger or smaller.</span>
                    </div>
                    <div className="bubble-size-control">
                      <button
                        type="button"
                        className="bubble-size-button"
                        onClick={() => adjustBubbleScale(-bubbleScaleStep)}
                        disabled={storyLayout.scale <= minBubbleScale}
                        aria-label="Decrease story bubble size"
                      >
                        −
                      </button>
                      <span className="bubble-size-divider" aria-hidden="true" />
                      <button
                        type="button"
                        className="bubble-size-button"
                        onClick={() => adjustBubbleScale(bubbleScaleStep)}
                        disabled={storyLayout.scale >= activeBubbleScaleLimit}
                        aria-label="Increase story bubble size"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                <div className="stories-frame-section">
                  <div className="stories-frame-copy">
                    <h2>Story frames</h2>
                    <p>Swipe through your story.</p>
                  </div>
                  <div className="stories-carousel-controls">
                    <button
                      type="button"
                      className="stories-arrow-button"
                      onClick={() => goToSlide(activeSlide - 1)}
                      disabled={activeSlide === 0}
                      aria-label="Previous story slide"
                    >
                      ←
                    </button>
                    <div className="stories-progress" aria-label={`Slide ${activeSlide + 1} of ${story.slides.length}`}>
                      {story.slides.map((_, index) => (
                        <button
                          key={index}
                          type="button"
                          className={index === activeSlide ? 'is-active' : ''}
                          onClick={() => goToSlide(index)}
                          aria-label={`Go to slide ${index + 1}`}
                          aria-current={index === activeSlide ? 'true' : undefined}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="stories-arrow-button"
                      onClick={() => goToSlide(activeSlide + 1)}
                      disabled={activeSlide === story.slides.length - 1}
                      aria-label="Next story slide"
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="stories-export-actions" aria-label="Finish your story" aria-busy={isExporting}>
                  <button
                    type="button"
                    className="stories-export-button stories-download-button"
                    onClick={handleDownloadStory}
                    disabled={isExporting}
                  >
                    {isExporting ? 'Preparing 7 slides…' : 'Download story'}
                    <span aria-hidden="true">↓</span>
                  </button>
                  <button
                    type="button"
                    className="stories-export-button stories-share-button"
                    onClick={handleShareStory}
                    disabled={isExporting}
                  >
                    Share story
                    <span aria-hidden="true">↗</span>
                  </button>
                  {exportStatus && <p className="stories-export-status" role="status">{exportStatus}</p>}
                </div>

                <div className="stories-actions">
                  <button type="button" className="stories-secondary-button" onClick={handleAnotherStory}>Another story ↻</button>
                  <button type="button" className="stories-text-button" onClick={changePhoto}>Change photo</button>
                </div>
              </aside>
            </div>
          </section>
        )}
      </main>

      <PublicSiteFooter />
    </div>
  )
}
