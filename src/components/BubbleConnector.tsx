import type { BubbleKind } from '../utils/bubbleShell'
import {
  connectorFill,
  connectorStroke,
  getSpeechTailPath,
  resolveConnectorGeometry,
  type BubbleBox,
  type ConnectorTarget,
  type CurveDirection,
  type ResolvedConnectorGeometry,
} from '../utils/bubbleConnector'

export function BubbleConnector({
  kind,
  bubble,
  target,
  curveDirection,
  width,
  height,
  geometry,
  className = '',
}: {
  kind: BubbleKind
  bubble: BubbleBox
  target: ConnectorTarget
  curveDirection: CurveDirection
  width: number
  height: number
  geometry?: ResolvedConnectorGeometry
  className?: string
}) {
  const viewWidth = Math.max(1, width)
  const viewHeight = Math.max(1, height)
  const resolved = geometry ?? resolveConnectorGeometry(
    kind,
    bubble,
    target,
    viewWidth,
    viewHeight,
    curveDirection,
  )
  const strokeWidth = resolved.strokeWidth * viewWidth

  return (
    <svg
      className={`bubble-connector ${className}`.trim()}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {resolved.type === 'speech' ? (
        <path
          d={getSpeechTailPath(resolved, viewWidth, viewHeight)}
          fill={connectorFill}
          stroke={connectorStroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <g fill={connectorFill} stroke={connectorStroke} strokeWidth={strokeWidth} strokeLinejoin="round">
          {resolved.dots.map((dot, index) => (
            <circle key={index} cx={dot.x * viewWidth} cy={dot.y * viewHeight} r={dot.r * viewWidth} />
          ))}
        </g>
      )}
    </svg>
  )
}
