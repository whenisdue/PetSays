import type { BubbleKind } from '../data/presets'
import type { ConnectorTarget } from './bubbleConnector'
import type { NormalizedRect } from './petDetection'

export type BubbleCenter = { x: number; y: number }

export type BubblePositionBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type BubblePlacementResult = {
  succeeded: boolean
  center: BubbleCenter
  connectorTarget: ConnectorTarget
  score: number
  reason: string
}

type Candidate = BubbleCenter & { label: string }

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(Number.isFinite(value) ? value : min, min), max)

export function getBubblePositionBounds(
  stageWidth: number,
  stageHeight: number,
  bubbleWidth?: number,
  bubbleHeight?: number,
): BubblePositionBounds {
  if (
    !Number.isFinite(stageWidth) ||
    !Number.isFinite(stageHeight) ||
    stageWidth <= 0 ||
    stageHeight <= 0
  ) {
    return { minX: 16, maxX: 84, minY: 16, maxY: 82 }
  }

  const edgePaddingX = 14
  const edgePaddingY = 10
  const halfWidth = bubbleWidth
    ? ((bubbleWidth / 2 + edgePaddingX) / stageWidth) * 100
    : 15
  const halfHeight = bubbleHeight
    ? ((bubbleHeight / 2 + edgePaddingY) / stageHeight) * 100
    : 15

  return {
    minX: Math.min(halfWidth, 50),
    maxX: Math.max(100 - halfWidth, 50),
    minY: Math.min(halfHeight, 50),
    maxY: Math.max(100 - halfHeight, 50),
  }
}

function area(rect: NormalizedRect) {
  return Math.max(0, rect.width) * Math.max(0, rect.height)
}

function overlapArea(first: NormalizedRect, second: NormalizedRect) {
  const left = Math.max(first.x, second.x)
  const top = Math.max(first.y, second.y)
  const right = Math.min(first.x + first.width, second.x + second.width)
  const bottom = Math.min(first.y + first.height, second.y + second.height)
  return Math.max(0, right - left) * Math.max(0, bottom - top)
}

function inflate(rect: NormalizedRect, xAmount: number, yAmount: number): NormalizedRect {
  const left = clamp(rect.x - xAmount, 0, 1)
  const top = clamp(rect.y - yAmount, 0, 1)
  const right = clamp(rect.x + rect.width + xAmount, 0, 1)
  const bottom = clamp(rect.y + rect.height + yAmount, 0, 1)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function bubbleRect(center: BubbleCenter, width: number, height: number): NormalizedRect {
  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  }
}

function centerOf(rect: NormalizedRect): BubbleCenter {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

function uniqueCandidates(candidates: Candidate[]) {
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = `${candidate.x.toFixed(4)}:${candidate.y.toFixed(4)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getCandidates(
  subject: NormalizedRect,
  bubbleWidth: number,
  bubbleHeight: number,
  bounds: BubblePositionBounds,
): Candidate[] {
  const minX = bounds.minX / 100
  const maxX = bounds.maxX / 100
  const minY = bounds.minY / 100
  const maxY = bounds.maxY / 100
  const subjectCenter = centerOf(subject)
  const gapX = 0.025
  const gapY = 0.025
  const clampCandidate = (label: string, x: number, y: number): Candidate => ({
    label,
    x: clamp(x, minX, maxX),
    y: clamp(y, minY, maxY),
  })
  const leftRoom = subject.x
  const rightRoom = 1 - subject.x - subject.width

  return uniqueCandidates([
    clampCandidate('top-left', minX, minY),
    clampCandidate('top-center', 0.5, minY),
    clampCandidate('top-right', maxX, minY),
    clampCandidate('middle-left', minX, 0.5),
    clampCandidate('middle-right', maxX, 0.5),
    clampCandidate('bottom-left', minX, maxY),
    clampCandidate('bottom-center', 0.5, maxY),
    clampCandidate('bottom-right', maxX, maxY),
    clampCandidate(
      'above-subject',
      subjectCenter.x,
      subject.y - bubbleHeight / 2 - gapY,
    ),
    clampCandidate(
      'left-of-subject',
      subject.x - bubbleWidth / 2 - gapX,
      subjectCenter.y,
    ),
    clampCandidate(
      'right-of-subject',
      subject.x + subject.width + bubbleWidth / 2 + gapX,
      subjectCenter.y,
    ),
    clampCandidate(
      leftRoom >= rightRoom ? 'safest-left-side' : 'safest-right-side',
      leftRoom >= rightRoom ? minX : maxX,
      clamp(subject.y + subject.height * 0.28, minY, maxY),
    ),
  ])
}

function compositionPenalty(
  center: BubbleCenter,
  subject: NormalizedRect,
  stageAspect: number,
) {
  const subjectCenter = centerOf(subject)
  const isAbove = center.y < subject.y + subject.height * 0.35
  const isBeside = center.x < subject.x || center.x > subject.x + subject.width
  const cornerDistance = Math.min(
    Math.hypot(center.x, center.y),
    Math.hypot(1 - center.x, center.y),
    Math.hypot(center.x, 1 - center.y),
    Math.hypot(1 - center.x, 1 - center.y),
  )
  let penalty = cornerDistance * 8
  if (isAbove) penalty -= stageAspect < 0.9 ? 2 : 4
  if (isBeside) penalty -= stageAspect < 0.9 ? 5 : 3
  if (Math.abs(center.x - 0.5) < 0.12 && subjectCenter.y < 0.5) penalty += 4
  return penalty
}

function verticalCompositionPenalty(center: BubbleCenter, label: string) {
  if (center.y <= 0.38) return -72
  if (center.y <= 0.5) return -35
  if (center.y <= 0.62) return 0
  if (center.y <= 0.74) return 42

  const bottomPenalty = 112 + (center.y - 0.74) * 220
  return label === 'bottom-center' ? bottomPenalty + 70 : bottomPenalty
}

export function chooseSmartBubblePlacement({
  subjectBox,
  headBox,
  bubbleWidth,
  bubbleHeight,
  stageWidth,
  stageHeight,
  bubbleKind,
  fallbackCenter,
  bounds,
}: {
  subjectBox: NormalizedRect
  headBox?: NormalizedRect | null
  bubbleWidth: number
  bubbleHeight: number
  stageWidth: number
  stageHeight: number
  bubbleKind: BubbleKind
  fallbackCenter: BubbleCenter
  bounds: BubblePositionBounds
}): BubblePlacementResult {
  const fallbackTarget = centerOf(headBox ?? subjectBox)
  if (
    ![bubbleWidth, bubbleHeight, stageWidth, stageHeight].every(Number.isFinite) ||
    bubbleWidth <= 0 ||
    bubbleHeight <= 0 ||
    stageWidth <= 0 ||
    stageHeight <= 0 ||
    area(subjectBox) <= 0
  ) {
    return {
      succeeded: false,
      center: fallbackCenter,
      connectorTarget: fallbackTarget,
      score: Number.POSITIVE_INFINITY,
      reason: 'invalid-geometry',
    }
  }

  const normalizedBubbleWidth = bubbleWidth / stageWidth
  const normalizedBubbleHeight = bubbleHeight / stageHeight
  const bubbleArea = Math.max(0.000001, normalizedBubbleWidth * normalizedBubbleHeight)
  const target = centerOf(headBox ?? subjectBox)
  const bodyClearance = inflate(subjectBox, 12 / stageWidth + 0.012, 12 / stageHeight + 0.012)
  const headClearance = headBox
    ? inflate(headBox, 16 / stageWidth + 0.018, 16 / stageHeight + 0.018)
    : null
  const stageDiagonal = Math.max(1, Math.hypot(stageWidth, stageHeight))
  const stageAspect = stageWidth / stageHeight

  const scoreCandidate = (candidate: Candidate) => {
    const center = candidate
    const rect = bubbleRect(center, normalizedBubbleWidth, normalizedBubbleHeight)
    const headOverlap = headBox ? overlapArea(rect, headBox) / bubbleArea : 0
    const headClearanceOverlap = headClearance
      ? overlapArea(rect, headClearance) / bubbleArea
      : 0
    const bodyOverlap = overlapArea(rect, subjectBox) / bubbleArea
    const bodyClearanceOverlap = overlapArea(rect, bodyClearance) / bubbleArea
    const connectorDistance = Math.hypot(
      (center.x - target.x) * stageWidth,
      (center.y - target.y) * stageHeight,
    ) / stageDiagonal
    const kindAdjustment = bubbleKind === 'thought' ? connectorDistance * 2 : 0

    return headOverlap * 7200 +
      headClearanceOverlap * 520 +
      bodyOverlap * 980 +
      bodyClearanceOverlap * 150 +
      connectorDistance * 24 +
      compositionPenalty(center, subjectBox, stageAspect) +
      verticalCompositionPenalty(center, candidate.label) +
      kindAdjustment
  }

  const candidates = getCandidates(subjectBox, normalizedBubbleWidth, normalizedBubbleHeight, bounds)
  const ranked = candidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate) }))
    .sort((first, second) => first.score - second.score)
  const best = ranked[0]
  const fallbackScore = scoreCandidate({
    x: clamp(fallbackCenter.x, bounds.minX / 100, bounds.maxX / 100),
    y: clamp(fallbackCenter.y, bounds.minY / 100, bounds.maxY / 100),
    label: 'fallback',
  })
  const meaningfulImprovement = Boolean(best) && best.score + 2 < fallbackScore

  if (!best || !meaningfulImprovement) {
    return {
      succeeded: false,
      center: fallbackCenter,
      connectorTarget: target,
      score: best?.score ?? Number.POSITIVE_INFINITY,
      reason: 'fallback-is-as-safe',
    }
  }

  return {
    succeeded: true,
    center: { x: best.x, y: best.y },
    connectorTarget: target,
    score: best.score,
    reason: best.label,
  }
}
