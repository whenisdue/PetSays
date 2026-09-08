import type { Ref } from 'react'
import {
  speechBodyPath,
  thoughtBodyPath,
  type BubbleKind,
} from '../utils/bubbleShell'

export type { BubbleKind } from '../utils/bubbleShell'

export function BubbleGraphic({
  kind,
  text,
  className = '',
  textRef,
}: {
  kind: BubbleKind
  text: string
  className?: string
  textRef?: Ref<HTMLSpanElement>
}) {
  return (
    <div className={`bubble-graphic ${kind} ${className}`.trim()} data-kind={kind}>
      <svg className="bubble-shell" viewBox="0 0 320 200" preserveAspectRatio="none" aria-hidden="true">
        <path d={kind === 'speech' ? speechBodyPath : thoughtBodyPath} transform={kind === 'thought' ? 'scale(1 1.18)' : undefined} fill="#fffdf8" stroke="#201f1c" strokeWidth="6" strokeLinejoin="round" />
      </svg>
      <span ref={textRef} className="bubble-text">{text}</span>
    </div>
  )
}
