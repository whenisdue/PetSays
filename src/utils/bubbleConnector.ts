import {
  getBubbleShellCenter,
  getBubbleShellIntersection,
  getBubbleShellPerimeter,
  isPointInsideBubbleShell,
  type BubbleBox,
  type BubbleKind,
  type BubblePoint,
} from './bubbleShell'

export type { BubbleBox } from './bubbleShell'

export type ConnectorTarget = BubblePoint
export type CurveDirection = -1 | 1
export const connectorFill = '#fffdf8'
export const connectorStroke = '#201f1c'

type PixelPoint = BubblePoint

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const toPixels = (point: BubblePoint, width: number, height: number): PixelPoint => ({
  x: point.x * width,
  y: point.y * height,
})

const fromPixels = (point: PixelPoint, width: number, height: number): BubblePoint => ({
  x: point.x / width,
  y: point.y / height,
})

const normalize = (point: PixelPoint): PixelPoint => {
  const length = Math.hypot(point.x, point.y)
  return length > 0.0001 ? { x: point.x / length, y: point.y / length } : { x: 0, y: 1 }
}

const sampleQuadratic = (
  start: PixelPoint,
  control: PixelPoint,
  end: PixelPoint,
  t: number,
): PixelPoint => {
  const inverse = 1 - t
  return {
    x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  }
}

const sampleQuadraticAtDistance = (
  start: PixelPoint,
  control: PixelPoint,
  end: PixelPoint,
  desiredDistance: number,
) => {
  const samples = 36
  let previous = start
  let travelled = 0

  for (let index = 1; index <= samples; index += 1) {
    const point = sampleQuadratic(start, control, end, index / samples)
    const segmentLength = Math.hypot(point.x - previous.x, point.y - previous.y)
    if (travelled + segmentLength >= desiredDistance) {
      const progress = segmentLength > 0 ? (desiredDistance - travelled) / segmentLength : 0
      return {
        point: {
          x: previous.x + (point.x - previous.x) * progress,
          y: previous.y + (point.y - previous.y) * progress,
        },
        pathLength: travelled + segmentLength,
      }
    }
    travelled += segmentLength
    previous = point
  }

  return { point: end, pathLength: travelled }
}

const getQuadraticLength = (start: PixelPoint, control: PixelPoint, end: PixelPoint) => {
  const samples = 36
  let previous = start
  let length = 0

  for (let index = 1; index <= samples; index += 1) {
    const point = sampleQuadratic(start, control, end, index / samples)
    length += Math.hypot(point.x - previous.x, point.y - previous.y)
    previous = point
  }

  return length
}

export function validateConnectorTarget(
  kind: BubbleKind,
  target: ConnectorTarget,
  bubble: BubbleBox | null,
  stageWidth: number,
  stageHeight: number,
): ConnectorTarget {
  const width = Math.max(1, stageWidth)
  const height = Math.max(1, stageHeight)
  const stageMargin = 2
  let next = {
    x: clamp(target.x, stageMargin / width, 1 - stageMargin / width),
    y: clamp(target.y, stageMargin / height, 1 - stageMargin / height),
  }

  if (!bubble || !isPointInsideBubbleShell(kind, bubble, next)) return next

  const requestedTarget = toPixels(next, width, height)
  const perimeter = getBubbleShellPerimeter(kind, bubble).map((point) =>
    toPixels(point, width, height),
  )
  let attachment = perimeter[0]
  let closestDistance = Number.POSITIVE_INFINITY

  perimeter.forEach((start, index) => {
    const end = perimeter[(index + 1) % perimeter.length]
    const segment = { x: end.x - start.x, y: end.y - start.y }
    const segmentLengthSquared = segment.x ** 2 + segment.y ** 2
    const projection = segmentLengthSquared
      ? clamp(
          ((requestedTarget.x - start.x) * segment.x +
            (requestedTarget.y - start.y) * segment.y) /
            segmentLengthSquared,
          0,
          1,
        )
      : 0
    const candidate = {
      x: start.x + segment.x * projection,
      y: start.y + segment.y * projection,
    }
    const distance = Math.hypot(
      requestedTarget.x - candidate.x,
      requestedTarget.y - candidate.y,
    )
    if (distance < closestDistance) {
      attachment = candidate
      closestDistance = distance
    }
  })

  const center = toPixels(getBubbleShellCenter(kind, bubble), width, height)
  const outward = normalize({ x: attachment.x - center.x, y: attachment.y - center.y })
  const safetyGap = 3

  next = fromPixels(
    {
      x: clamp(attachment.x + outward.x * safetyGap, stageMargin, width - stageMargin),
      y: clamp(attachment.y + outward.y * safetyGap, stageMargin, height - stageMargin),
    },
    width,
    height,
  )

  return next
}

export function getConnectorCurveGeometry(
  kind: BubbleKind,
  bubble: BubbleBox,
  target: ConnectorTarget,
  stageWidth: number,
  stageHeight: number,
  curveDirection: CurveDirection = 1,
) {
  const width = Math.max(1, stageWidth)
  const height = Math.max(1, stageHeight)
  const shell = getBubbleShellIntersection(kind, bubble, target, width, height)
  const attachmentPixels = toPixels(shell.point, width, height)
  const targetPixels = toPixels(target, width, height)
  const delta = {
    x: targetPixels.x - attachmentPixels.x,
    y: targetPixels.y - attachmentPixels.y,
  }
  const direction = normalize(delta)
  const perpendicular = {
    x: -direction.y * curveDirection,
    y: direction.x * curveDirection,
  }
  const distance = Math.hypot(delta.x, delta.y)
  const midpoint = {
    x: (attachmentPixels.x + targetPixels.x) / 2,
    y: (attachmentPixels.y + targetPixels.y) / 2,
  }
  const bubblePixelWidth = bubble.width * width
  const bubblePixelHeight = bubble.height * height
  const curveLimit = Math.min(
    Math.max(bubblePixelWidth, bubblePixelHeight) * 0.18,
    Math.min(width, height) * 0.14,
    72,
  )
  const curveAmount = Math.min(distance * 0.22, curveLimit)
  const stageMargin = 2
  const unclampedControl = {
    x: midpoint.x + perpendicular.x * curveAmount,
    y: midpoint.y + perpendicular.y * curveAmount,
  }
  const controlPixels = {
    x: clamp(unclampedControl.x, stageMargin, width - stageMargin),
    y: clamp(unclampedControl.y, stageMargin, height - stageMargin),
  }

  return {
    attachment: shell.point,
    attachmentTangent: shell.tangent,
    target,
    control: fromPixels(controlPixels, width, height),
    distance,
    curveAmount,
  }
}

export function getDefaultCurveDirection(
  kind: BubbleKind,
  bubble: BubbleBox,
  target: ConnectorTarget,
  stageWidth: number,
  stageHeight: number,
): CurveDirection {
  const curve = getConnectorCurveGeometry(kind, bubble, target, stageWidth, stageHeight, 1)
  const midpoint = {
    x: (curve.attachment.x + target.x) / 2,
    y: (curve.attachment.y + target.y) / 2,
  }
  const towardImageCenter = {
    x: (0.5 - midpoint.x) * stageWidth,
    y: (0.5 - midpoint.y) * stageHeight,
  }
  const attachmentPixels = toPixels(curve.attachment, stageWidth, stageHeight)
  const targetPixels = toPixels(target, stageWidth, stageHeight)
  const direction = normalize({
    x: targetPixels.x - attachmentPixels.x,
    y: targetPixels.y - attachmentPixels.y,
  })
  const perpendicular = { x: -direction.y, y: direction.x }
  return perpendicular.x * towardImageCenter.x + perpendicular.y * towardImageCenter.y >= 0
    ? 1
    : -1
}

export function getSpeechTailGeometry(
  bubble: BubbleBox,
  target: ConnectorTarget,
  stageWidth: number,
  stageHeight: number,
  curveDirection: CurveDirection = 1,
) {
  const curve = getConnectorCurveGeometry(
    'speech',
    bubble,
    target,
    stageWidth,
    stageHeight,
    curveDirection,
  )
  const attachment = toPixels(curve.attachment, stageWidth, stageHeight)
  const control = toPixels(curve.control, stageWidth, stageHeight)
  const bubblePixelWidth = bubble.width * stageWidth
  const bubblePixelHeight = bubble.height * stageHeight
  const maximumBaseHalf = Math.min(bubblePixelWidth * 0.045, bubblePixelHeight * 0.15)
  const baseHalf = Math.min(maximumBaseHalf, Math.max(2.5, curve.distance * 0.2))
  const tangent = curve.attachmentTangent
  const baseStartPixels = {
    x: attachment.x - tangent.x * baseHalf,
    y: attachment.y - tangent.y * baseHalf,
  }
  const baseEndPixels = {
    x: attachment.x + tangent.x * baseHalf,
    y: attachment.y + tangent.y * baseHalf,
  }
  const controlSpread = baseHalf * 0.42
  const controlStartPixels = {
    x: clamp(control.x - tangent.x * controlSpread, 2, stageWidth - 2),
    y: clamp(control.y - tangent.y * controlSpread, 2, stageHeight - 2),
  }
  const controlEndPixels = {
    x: clamp(control.x + tangent.x * controlSpread, 2, stageWidth - 2),
    y: clamp(control.y + tangent.y * controlSpread, 2, stageHeight - 2),
  }

  return {
    ...curve,
    baseStart: fromPixels(baseStartPixels, stageWidth, stageHeight),
    baseEnd: fromPixels(baseEndPixels, stageWidth, stageHeight),
    controlStart: fromPixels(controlStartPixels, stageWidth, stageHeight),
    controlEnd: fromPixels(controlEndPixels, stageWidth, stageHeight),
  }
}

export function getThoughtConnectorDots(
  bubble: BubbleBox,
  target: ConnectorTarget,
  stageWidth: number,
  stageHeight: number,
  curveDirection: CurveDirection = 1,
) {
  const curve = getConnectorCurveGeometry(
    'thought',
    bubble,
    target,
    stageWidth,
    stageHeight,
    curveDirection,
  )
  const start = toPixels(curve.attachment, stageWidth, stageHeight)
  const control = toPixels(curve.control, stageWidth, stageHeight)
  const end = toPixels(curve.target, stageWidth, stageHeight)
  const pathLength = getQuadraticLength(start, control, end)
  const largestRadius = clamp(bubble.width * stageWidth * 0.035, 5.5, 12)
  const radiusScale = clamp(pathLength / (largestRadius * 5.2), 0.62, 1)
  const distances = [pathLength * 0.2, pathLength * 0.56, pathLength * 0.86]
  const radii = [
    largestRadius * radiusScale,
    largestRadius * 0.64 * radiusScale,
    largestRadius * 0.38 * radiusScale,
  ]

  return distances.map((distance, index) => {
    const sampled = sampleQuadraticAtDistance(start, control, end, distance).point
    return {
      ...fromPixels(sampled, stageWidth, stageHeight),
      r: radii[index] / stageWidth,
    }
  })
}

export function getConnectorShape(
  kind: BubbleKind,
  bubble: BubbleBox,
  target: ConnectorTarget,
  stageWidth: number,
  stageHeight: number,
  curveDirection: CurveDirection = 1,
) {
  return kind === 'speech'
    ? {
        type: 'speech' as const,
        ...getSpeechTailGeometry(bubble, target, stageWidth, stageHeight, curveDirection),
      }
    : {
        type: 'thought' as const,
        dots: getThoughtConnectorDots(bubble, target, stageWidth, stageHeight, curveDirection),
      }
}

export type ResolvedConnectorGeometry = ReturnType<typeof resolveConnectorGeometry>

export function resolveConnectorGeometry(
  kind: BubbleKind,
  bubble: BubbleBox,
  target: ConnectorTarget,
  stageWidth: number,
  stageHeight: number,
  curveDirection: CurveDirection = 1,
) {
  const viewWidth = Math.max(1, stageWidth)
  const viewHeight = Math.max(1, stageHeight)
  const shape = getConnectorShape(
    kind,
    bubble,
    target,
    viewWidth,
    viewHeight,
    curveDirection,
  )

  return {
    ...shape,
    strokeWidth: getConnectorStrokeWidth(kind, bubble, viewWidth) / viewWidth,
  }
}

const pointString = (point: BubblePoint, width: number, height: number) =>
  `${point.x * width} ${point.y * height}`

export const getSpeechTailPath = (
  shape: ReturnType<typeof getSpeechTailGeometry>,
  width: number,
  height: number,
) =>
  `M ${pointString(shape.baseStart, width, height)} Q ${pointString(shape.controlStart, width, height)} ${pointString(shape.target, width, height)} Q ${pointString(shape.controlEnd, width, height)} ${pointString(shape.baseEnd, width, height)} Z`

export const getConnectorStrokeWidth = (
  kind: BubbleKind,
  bubble: BubbleBox,
  width: number,
) => Math.max(kind === 'speech' ? 1.5 : 2, bubble.width * width * ((kind === 'speech' ? 4.2 : 6) / 320))

export function bubbleConnectorSvg(
  geometry: ResolvedConnectorGeometry,
  width: number,
  height: number,
) {
  const viewWidth = Math.max(1, width)
  const viewHeight = Math.max(1, height)
  const strokeWidth = geometry.strokeWidth * viewWidth

  if (geometry.type === 'speech') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="0 0 ${viewWidth} ${viewHeight}" preserveAspectRatio="none"><path d="${getSpeechTailPath(geometry, viewWidth, viewHeight)}" fill="${connectorFill}" stroke="${connectorStroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  }

  const dots = geometry.dots
    .map(
      (dot) =>
        `<circle cx="${dot.x * viewWidth}" cy="${dot.y * viewHeight}" r="${dot.r * viewWidth}"/>`,
    )
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="0 0 ${viewWidth} ${viewHeight}" preserveAspectRatio="none"><g fill="${connectorFill}" stroke="${connectorStroke}" stroke-width="${strokeWidth}" stroke-linejoin="round">${dots}</g></svg>`
}
