export type PetClass = 'dog' | 'cat'

export type NormalizedRect = {
  x: number
  y: number
  width: number
  height: number
}

export type PetDetectionStatus = 'ready' | 'low-confidence' | 'no-pet' | 'error'
export type HeadDetectionStatus = 'ready' | 'low-confidence' | 'not-found' | 'error'

export type PetDetectionResult = {
  status: PetDetectionStatus
  petClass: PetClass | null
  subjectBox: NormalizedRect | null
  subjectConfidence: number
  headBox: NormalizedRect | null
  headConfidence: number
  headStatus: HeadDetectionStatus
  initializationTimeMs: number | null
  subjectInferenceTimeMs: number | null
  headInferenceTimeMs: number | null
  totalTimeMs: number | null
  runtime: 'webgl' | 'cpu' | 'unknown'
}

type PixelRect = NormalizedRect
type ImageSize = { width: number; height: number }
type CocoSsdModule = typeof import('@tensorflow-models/coco-ssd')
type DetectorModel = Awaited<ReturnType<CocoSsdModule['load']>>

const subjectMinConfidence = 0.5
const headMinConfidence = 0.65
const headSearchHeightFraction = 0.75
const headInputMaxDimension = 4096
const petClasses = new Set<PetClass>(['dog', 'cat'])

let detectorPromise: Promise<{
  model: DetectorModel
  initializationTimeMs: number
  runtime: 'webgl' | 'cpu' | 'unknown'
}> | null = null

const now = () => typeof performance === 'undefined' ? Date.now() : performance.now()
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(Number.isFinite(value) ? value : min, min), max)

function rectArea(rect: PixelRect) {
  return Math.max(0, rect.width) * Math.max(0, rect.height)
}

function rectCenter(rect: PixelRect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

function safePixelRect(bbox: number[], source: ImageSize): PixelRect | null {
  if (bbox.length < 4 || !bbox.slice(0, 4).every(Number.isFinite)) return null
  const [rawX, rawY, rawWidth, rawHeight] = bbox
  if (rawWidth <= 0 || rawHeight <= 0) return null
  const width = clamp(rawWidth, 1, source.width)
  const height = clamp(rawHeight, 1, source.height)
  return {
    x: clamp(rawX, 0, source.width - width),
    y: clamp(rawY, 0, source.height - height),
    width,
    height,
  }
}

function normalizeRect(rect: PixelRect, source: ImageSize): NormalizedRect {
  return {
    x: rect.x / source.width,
    y: rect.y / source.height,
    width: rect.width / source.width,
    height: rect.height / source.height,
  }
}

async function loadDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const tf = await import('@tensorflow/tfjs-core')
      await import('@tensorflow/tfjs-backend-cpu')
      await import('@tensorflow/tfjs-backend-webgl')
      const cocoSsd = await import('@tensorflow-models/coco-ssd')
      const startedAt = now()
      let runtime: 'webgl' | 'cpu' | 'unknown' = 'unknown'

      try {
        await tf.setBackend('webgl')
        await tf.ready()
        runtime = tf.getBackend() === 'webgl' ? 'webgl' : 'unknown'
      } catch {
        await tf.setBackend('cpu')
        await tf.ready()
        runtime = tf.getBackend() === 'cpu' ? 'cpu' : 'unknown'
      }

      const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
      return {
        model,
        initializationTimeMs: Math.max(0, now() - startedAt),
        runtime,
      }
    })()
  }

  return detectorPromise
}

function failureResult(status: PetDetectionStatus = 'error'): PetDetectionResult {
  return {
    status,
    petClass: null,
    subjectBox: null,
    subjectConfidence: 0,
    headBox: null,
    headConfidence: 0,
    headStatus: status === 'no-pet' ? 'not-found' : 'error',
    initializationTimeMs: null,
    subjectInferenceTimeMs: null,
    headInferenceTimeMs: null,
    totalTimeMs: null,
    runtime: 'unknown',
  }
}

function primarySortValue(
  detection: { confidence: number; box: PixelRect; areaRatio: number },
  source: ImageSize,
) {
  const center = rectCenter(detection.box)
  const centerDistance = Math.hypot(
    (center.x / source.width - 0.5) * 2,
    (center.y / source.height - 0.5) * 2,
  )
  const centerProximity = clamp(1 - centerDistance, 0, 1)
  return detection.confidence * 0.55 + detection.areaRatio * 0.3 + centerProximity * 0.15
}

async function detectHead(
  model: DetectorModel,
  image: HTMLImageElement,
  subject: PixelRect,
  source: ImageSize,
): Promise<{
  status: HeadDetectionStatus
  box: PixelRect | null
  confidence: number
  inferenceTimeMs: number | null
}> {
  const searchRegion: PixelRect = {
    x: subject.x,
    y: subject.y,
    width: subject.width,
    height: subject.height * headSearchHeightFraction,
  }
  const scale = Math.min(
    1,
    headInputMaxDimension / Math.max(searchRegion.width, searchRegion.height),
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(searchRegion.width * scale))
  canvas.height = Math.max(1, Math.round(searchRegion.height * scale))
  const context = canvas.getContext('2d')
  if (!context) return { status: 'error', box: null, confidence: 0, inferenceTimeMs: null }

  context.drawImage(
    image,
    searchRegion.x,
    searchRegion.y,
    searchRegion.width,
    searchRegion.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  try {
    const startedAt = now()
    const rawDetections = await model.detect(canvas, 20, 0.25)
    const inferenceTimeMs = Math.max(0, now() - startedAt)
    const candidates = rawDetections
      .filter((detection) => petClasses.has(detection.class as PetClass))
      .map((detection) => {
        const boxInSearch = safePixelRect(detection.bbox, {
          width: canvas.width,
          height: canvas.height,
        })
        if (!boxInSearch) return null
        const scaleX = searchRegion.width / canvas.width
        const scaleY = searchRegion.height / canvas.height
        const box = safePixelRect([
          searchRegion.x + boxInSearch.x * scaleX,
          searchRegion.y + boxInSearch.y * scaleY,
          boxInSearch.width * scaleX,
          boxInSearch.height * scaleY,
        ], source)
        return box ? { box, confidence: clamp(detection.score, 0, 1) } : null
      })
      .filter((candidate): candidate is { box: PixelRect; confidence: number } => candidate !== null)
      .sort((first, second) => second.confidence - first.confidence)
    const best = candidates[0]

    if (!best) return { status: 'not-found', box: null, confidence: 0, inferenceTimeMs }
    if (best.confidence < headMinConfidence) {
      return { status: 'low-confidence', box: null, confidence: best.confidence, inferenceTimeMs }
    }
    return { status: 'ready', box: best.box, confidence: best.confidence, inferenceTimeMs }
  } catch {
    return { status: 'error', box: null, confidence: 0, inferenceTimeMs: null }
  }
}

export async function detectPetImage(image: HTMLImageElement): Promise<PetDetectionResult> {
  const source = { width: image.naturalWidth, height: image.naturalHeight }
  if (source.width <= 0 || source.height <= 0) return failureResult()

  try {
    const totalStartedAt = now()
    const detector = await loadDetector()
    const subjectStartedAt = now()
    const rawDetections = await detector.model.detect(image, 20, 0.25)
    const subjectInferenceTimeMs = Math.max(0, now() - subjectStartedAt)
    const sourceArea = source.width * source.height
    const detections = rawDetections
      .filter((detection) => petClasses.has(detection.class as PetClass))
      .map((detection) => {
        const box = safePixelRect(detection.bbox, source)
        if (!box) return null
        return {
          petClass: detection.class as PetClass,
          confidence: clamp(detection.score, 0, 1),
          box,
          areaRatio: clamp(rectArea(box) / sourceArea, 0, 1),
        }
      })
      .filter((detection): detection is {
        petClass: PetClass
        confidence: number
        box: PixelRect
        areaRatio: number
      } => detection !== null)
      .sort((first, second) => {
        const scoreDelta = primarySortValue(second, source) - primarySortValue(first, source)
        if (Math.abs(scoreDelta) > 0.000001) return scoreDelta
        const areaDelta = second.areaRatio - first.areaRatio
        if (Math.abs(areaDelta) > 0.000001) return areaDelta
        return second.confidence - first.confidence
      })
    const primary = detections[0]

    if (!primary) {
      return {
        ...failureResult('no-pet'),
        initializationTimeMs: detector.initializationTimeMs,
        subjectInferenceTimeMs,
        totalTimeMs: Math.max(0, now() - totalStartedAt),
        runtime: detector.runtime,
      }
    }

    if (primary.confidence < subjectMinConfidence) {
      return {
        ...failureResult('low-confidence'),
        petClass: primary.petClass,
        subjectConfidence: primary.confidence,
        initializationTimeMs: detector.initializationTimeMs,
        subjectInferenceTimeMs,
        totalTimeMs: Math.max(0, now() - totalStartedAt),
        runtime: detector.runtime,
      }
    }

    const head = await detectHead(detector.model, image, primary.box, source)
    return {
      status: 'ready',
      petClass: primary.petClass,
      subjectBox: normalizeRect(primary.box, source),
      subjectConfidence: primary.confidence,
      headBox: head.box ? normalizeRect(head.box, source) : null,
      headConfidence: head.confidence,
      headStatus: head.status,
      initializationTimeMs: detector.initializationTimeMs,
      subjectInferenceTimeMs,
      headInferenceTimeMs: head.inferenceTimeMs,
      totalTimeMs: Math.max(0, now() - totalStartedAt),
      runtime: detector.runtime,
    }
  } catch {
    return failureResult()
  }
}
