import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getDef, symbolColor } from '../game/cards'
import type { CardDef } from '../game/types'

function SymbolIcon({ symbol, power }: { symbol: string; power: number }) {
  const color = symbolColor(symbol)
  let glyph = '◆'
  if (symbol === 'machete') glyph = 'M'
  else if (symbol === 'paddle') glyph = 'P'
  else if (symbol === 'coin') glyph = '$'
  else if (symbol === 'joker') glyph = '★'
  else if (symbol === 'none') glyph = '·'
  return (
    <div className="card-power" style={{ color }}>
      <span className="glyph">{glyph}</span>
      {power > 0 && <span className="pwr">{power}</span>}
    </div>
  )
}

/** Corner mark for single-use (item) cards. */
export function SingleUseMark() {
  return (
    <span className="single-use-mark" title="Single use — removed after play">
      <span className="single-use-glyph" aria-hidden>
        1×
      </span>
      <span className="visually-hidden">Single use</span>
    </span>
  )
}

export function FullCardFace({
  def,
  stock,
  className = '',
}: {
  def: CardDef
  stock?: number
  className?: string
}) {
  const border = symbolColor(def.symbol === 'none' ? 'joker' : def.symbol)
  return (
    <div
      className={`expedition-card full-face ${def.isItem ? 'item' : ''} ${className}`}
      style={{ borderColor: border }}
    >
      {def.isItem && <SingleUseMark />}
      <div className="card-name">{def.name}</div>
      <SymbolIcon symbol={def.symbol} power={def.power} />
      <div className="card-kind">{def.kind === 'action' ? 'Action' : 'Movement'}</div>
      <div className="card-desc">{def.description}</div>
      {def.cost != null && <div className="card-cost">Hire ${def.cost}</div>}
      {def.cost == null && <div className="card-cost">Starting card</div>}
      {def.isItem && <div className="card-item">Single use — removed after play</div>}
      {stock != null && <div className="card-stock">×{stock} in market</div>}
    </div>
  )
}

interface HoverProps {
  defId: string
  stock?: number
  children: ReactNode
  className?: string
}

/** Shows an enlarged full card to the left of the trigger after a short hover delay. */
const HOVER_DELAY_MS = 960

export function CardHover({ defId, stock, children, className }: HoverProps) {
  const def = getDef(defId)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const popW = 220
    const popH = 280
    let left = r.left - popW - 12
    let top = r.top
    if (left < 8) left = Math.min(r.right + 12, window.innerWidth - popW - 8)
    if (top + popH > window.innerHeight - 8) top = Math.max(8, window.innerHeight - popH - 8)
    if (top < 8) top = 8
    setAnchor({ top, left })
  }, [])

  const scheduleShow = useCallback(() => {
    clearTimer()
    timerRef.current = setTimeout(place, HOVER_DELAY_MS)
  }, [clearTimer, place])

  const hide = useCallback(() => {
    clearTimer()
    setAnchor(null)
  }, [clearTimer])

  useEffect(() => () => clearTimer(), [clearTimer])

  return (
    <span
      ref={triggerRef}
      className={`card-hover-trigger ${className ?? ''}`}
      onMouseEnter={scheduleShow}
      onMouseLeave={hide}
      onFocus={scheduleShow}
      onBlur={hide}
    >
      {children}
      {anchor &&
        createPortal(
          <div
            className="card-hover-pop"
            style={{ top: anchor.top, left: anchor.left }}
            role="tooltip"
          >
            <FullCardFace def={def} stock={stock} />
          </div>,
          document.body,
        )}
    </span>
  )
}

export { SymbolIcon }
