export type BubbleKind = 'speech' | 'thought'

export type BubblePoint = { x: number; y: number }

export type BubbleBox = BubblePoint & {
  width: number
  height: number
}

export type ShellIntersection = {
  point: BubblePoint
  tangent: BubblePoint
  center: BubblePoint
}

const viewBoxWidth = 320
const viewBoxHeight = 200
const thoughtScaleY = 1.18
const perimeterStepsPerCurve = 18

export const speechBodyPath =
  'M160 14C242 14 306 30 306 96.5C306 163 242 179 160 179C78 179 14 163 14 96.5C14 30 78 14 160 14Z'

export const thoughtBodyPath =
  'M50 16C28 16 13 31 17 51C1 66 11 87 32 91C27 113 48 133 75 129C91 149 126 148 143 133C169 148 204 145 213 124C240 131 266 114 263 92C289 91 305 72 292 52C297 31 279 14 256 16C237 0 205 4 188 18C167 2 131 3 113 19C95 4 68 2 50 16Z'

const cubicPoint = (
  start: BubblePoint,
  controlA: BubblePoint,
  controlB: BubblePoint,
  end: BubblePoint,
  t: number,
): BubblePoint => {
  const inverse = 1 - t

  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse ** 2 * t * controlA.x +
      3 * inverse * t ** 2 * controlB.x +
      t ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse ** 2 * t * controlA.y +
      3 * inverse * t ** 2 * controlB.y +
      t ** 3 * end.y,
  }
}

const samplePath = (path: string, scaleY = 1): BubblePoint[] => {
  const tokens = path.match(/[MCZ]|-?(?:\d+\.?\d*|\.\d+)/g) ?? []
  const points: BubblePoint[] = []
  let index = 0
  let current = { x: 0, y: 0 }
  let start = current

  while (index < tokens.length) {
    const command = tokens[index]
    index += 1

    if (command === 'M') {
      current = { x: Number(tokens[index]), y: Number(tokens[index + 1]) }
      index += 2
      start = current
      points.push({ x: current.x, y: current.y * scaleY })
      continue
    }

    if (command === 'C') {
      const controlA = { x: Number(tokens[index]), y: Number(tokens[index + 1]) }
      const controlB = { x: Number(tokens[index + 2]), y: Number(tokens[index + 3]) }
      const end = { x: Number(tokens[index + 4]), y: Number(tokens[index + 5]) }
      index += 6

      for (let step = 1; step <= perimeterStepsPerCurve; step += 1) {
        const point = cubicPoint(
          current,
          controlA,
          controlB,
          end,
          step / perimeterStepsPerCurve,
        )
        points.push({ x: point.x, y: point.y * scaleY })
      }

      current = end
      continue
    }

    if (command === 'Z') {
      const scaledStart = { x: start.x, y: start.y * scaleY }
      const last = points.at(-1)
      if (!last || last.x !== scaledStart.x || last.y !== scaledStart.y) {
        points.push(scaledStart)
      }
    }
  }

  return points
}

const localPerimeters: Record<BubbleKind, BubblePoint[]> = {
  speech: samplePath(speechBodyPath),
  thought: samplePath(thoughtBodyPath, thoughtScaleY),
}

const localBounds = Object.fromEntries(
  (['speech', 'thought'] as BubbleKind[]).map((kind) => {
    const points = localPerimeters[kind]
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    return [kind, { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }]
  }),
) as Record<BubbleKind, { minX: number; maxX: number; minY: number; maxY: number }>

const mapLocalPoint = (point: BubblePoint, bubble: BubbleBox): BubblePoint => ({
  x: bubble.x + (point.x / viewBoxWidth) * bubble.width,
  y: bubble.y + (point.y / viewBoxHeight) * bubble.height,
})

const toPixels = (point: BubblePoint, width: number, height: number): BubblePoint => ({
  x: point.x * width,
  y: point.y * height,
})

const normalizeVector = (point: BubblePoint): BubblePoint => {
  const length = Math.hypot(point.x, point.y)
  return length > 0.0001 ? { x: point.x / length, y: point.y / length } : { x: 0, y: 1 }
}

const cross = (a: BubblePoint, b: BubblePoint) => a.x * b.y - a.y * b.x

export const getBubbleShellPerimeter = (kind: BubbleKind, bubble: BubbleBox): BubblePoint[] =>
  localPerimeters[kind].map((point) => mapLocalPoint(point, bubble))

export const getBubbleShellCenter = (kind: BubbleKind, bubble: BubbleBox): BubblePoint => {
  const bounds = localBounds[kind]
  return mapLocalPoint(
    { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
    bubble,
  )
}

export const isPointInsideBubbleShell = (
  kind: BubbleKind,
  bubble: BubbleBox,
  point: BubblePoint,
) => {
  const perimeter = getBubbleShellPerimeter(kind, bubble)
  let inside = false

  for (
    let index = 0, previous = perimeter.length - 1;
    index < perimeter.length;
    previous = index, index += 1
  ) {
    const currentPoint = perimeter[index]
    const previousPoint = perimeter[previous]
    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x
    if (crosses) inside = !inside
  }

  return inside
}

export const getBubbleShellIntersection = (
  kind: BubbleKind,
  bubble: BubbleBox,
  target: BubblePoint,
  stageWidth: number,
  stageHeight: number,
): ShellIntersection => {
  const perimeter = getBubbleShellPerimeter(kind, bubble)
  const center = getBubbleShellCenter(kind, bubble)
  const centerPixels = toPixels(center, stageWidth, stageHeight)
  const targetPixels = toPixels(target, stageWidth, stageHeight)
  let ray = { x: targetPixels.x - centerPixels.x, y: targetPixels.y - centerPixels.y }

  if (Math.hypot(ray.x, ray.y) < 0.001) ray = { x: 0, y: 1 }

  let bestDistance = Number.POSITIVE_INFINITY
  let bestPoint: BubblePoint | null = null
  let bestTangent: BubblePoint | null = null

  for (let index = 0; index < perimeter.length; index += 1) {
    const start = toPixels(perimeter[index], stageWidth, stageHeight)
    const end = toPixels(perimeter[(index + 1) % perimeter.length], stageWidth, stageHeight)
    const segment = { x: end.x - start.x, y: end.y - start.y }
    const denominator = cross(ray, segment)
    if (Math.abs(denominator) < 0.000001) continue

    const fromCenter = { x: start.x - centerPixels.x, y: start.y - centerPixels.y }
    const rayDistance = cross(fromCenter, segment) / denominator
    const segmentDistance = cross(fromCenter, ray) / denominator

    if (
      rayDistance >= 0 &&
      segmentDistance >= 0 &&
      segmentDistance <= 1 &&
      rayDistance < bestDistance
    ) {
      bestDistance = rayDistance
      bestPoint = {
        x: (centerPixels.x + ray.x * rayDistance) / stageWidth,
        y: (centerPixels.y + ray.y * rayDistance) / stageHeight,
      }
      bestTangent = normalizeVector(segment)
    }
  }

  if (!bestPoint || !bestTangent) {
    const direction = normalizeVector(ray)
    let fallbackIndex = 0
    let fallbackProjection = Number.NEGATIVE_INFINITY

    perimeter.forEach((point, index) => {
      const pixels = toPixels(point, stageWidth, stageHeight)
      const projection =
        (pixels.x - centerPixels.x) * direction.x +
        (pixels.y - centerPixels.y) * direction.y
      if (projection > fallbackProjection) {
        fallbackIndex = index
        fallbackProjection = projection
      }
    })

    bestPoint = perimeter[fallbackIndex]
    const before = toPixels(
      perimeter[(fallbackIndex - 1 + perimeter.length) % perimeter.length],
      stageWidth,
      stageHeight,
    )
    const after = toPixels(
      perimeter[(fallbackIndex + 1) % perimeter.length],
      stageWidth,
      stageHeight,
    )
    bestTangent = normalizeVector({ x: after.x - before.x, y: after.y - before.y })
  }

  return { point: bestPoint, tangent: bestTangent, center }
}

const shellMarkup = (kind: BubbleKind) => {
  if (kind === 'thought') {
    return `<g transform="scale(1 1.18)"><path d="${thoughtBodyPath}" fill="#fffdf8" stroke="#201f1c" stroke-width="6" stroke-linejoin="round" /></g>`
  }
  return `<path d="${speechBodyPath}" fill="#fffdf8" stroke="#201f1c" stroke-width="6" stroke-linejoin="round" />`
}

export const bubbleBodySvg = (kind: BubbleKind, width: number, height: number) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 320 200" preserveAspectRatio="none">
    ${shellMarkup(kind)}
  </svg>
`
