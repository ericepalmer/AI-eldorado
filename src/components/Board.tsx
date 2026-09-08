import { useEffect, useRef } from 'react'
import {
  BOARD_HEX_SIZE,
  blockadeConnectors,
  hexToPixel,
  tileBorderEdges,
  tileLabelPositions,
} from '../game/board'
import type { HexCell, TerrainSymbol, TerrainType } from '../game/types'

interface Props {
  cells: Record<string, HexCell>
  positions: { id: number; cellId: string; color: string; name: string }[]
  highlights: string[]
  onCellClick: (id: string) => void
  currentPos?: string
  /** Highlight all hexes belonging to this builder piece instance. */
  selectedPieceId?: string | null
  /** Show B/C/N/I/K/E watermarks (map builder only). */
  showTileLetters?: boolean
}

const FILL: Record<TerrainType, string> = {
  jungle: '#2f7a45',
  river: '#2a6f9a',
  village: '#d4a82a',
  rubble: '#8a8680',
  camp: '#b44532',
  mountain: '#2a2a2a',
  start: '#3d8f55',
  finish: '#3a8bb8',
  eldorado: '#e6b422',
}

/** Slightly darker fill for higher power (1 lightest → 4 darkest). */
function fillForPower(type: TerrainType, power: number): string {
  const base = FILL[type] ?? '#666'
  if (type === 'mountain' || type === 'eldorado' || type === 'start') return base
  const p = Math.max(1, Math.min(4, power || 1))
  if (p <= 1) return base
  // power 2 ≈ 12% darker, 3 ≈ 24%, 4 ≈ 32%
  const factor = p === 2 ? 0.88 : p === 3 ? 0.76 : 0.68
  const hex = base.replace('#', '')
  const r = Math.round(parseInt(hex.slice(0, 2), 16) * factor)
  const g = Math.round(parseInt(hex.slice(2, 4), 16) * factor)
  const b = Math.round(parseInt(hex.slice(4, 6), 16) * factor)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function hexPolygon(cx: number, cy: number, size: number): string {
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    points.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`)
  }
  return points.join(' ')
}

function blockadeGlyph(symbols: TerrainSymbol | 'any'): string {
  if (symbols === 'machete') return 'M'
  if (symbols === 'paddle') return 'P'
  if (symbols === 'coin') return '$'
  return '✕'
}

/** Uniform connector colors: green / blue / yellow / grey. */
function blockadeColor(symbols: TerrainSymbol | 'any'): string {
  if (symbols === 'machete') return '#2f7a45'
  if (symbols === 'paddle') return '#2a6f9a'
  if (symbols === 'coin') return '#d4a82a'
  return '#8a8680'
}

function connectorCentroid(path: { x: number; y: number }[]): { x: number; y: number } {
  if (path.length === 0) return { x: 0, y: 0 }
  return {
    x: path.reduce((s, p) => s + p.x, 0) / path.length,
    y: path.reduce((s, p) => s + p.y, 0) / path.length,
  }
}

function SymbolMarks({
  type,
  power,
  x,
  y,
}: {
  type: TerrainType
  power: number
  x: number
  y: number
}) {
  if (type === 'mountain') return null
  if (type === 'eldorado') {
    return (
      <g>
        <text x={x} y={y + 1} textAnchor="middle" className="hex-label" fill="#3a2a08" fontSize={14}>
          ★
        </text>
        <text x={x} y={y + 13} textAnchor="middle" className="hex-label" fill="#3a2a08" fontSize={8}>
          ED
        </text>
      </g>
    )
  }
  if (type === 'start') return null
  if (type === 'camp') {
    const n = Math.max(1, power || 1)
    return (
      <text
        x={x}
        y={y + 5}
        textAnchor="middle"
        className="hex-label"
        fill="#fff"
        fontSize={n >= 3 ? 12 : 14}
        fontWeight={700}
        letterSpacing={n >= 3 ? -0.5 : 0}
      >
        {'X'.repeat(Math.min(3, n))}
      </text>
    )
  }
  if (type === 'rubble') {
    return (
      <text x={x} y={y + 5} textAnchor="middle" className="hex-label" fill="#f4f0e8" fontSize={14} fontWeight={700}>
        {power || 1}
      </text>
    )
  }

  const n = Math.max(1, power || 1)
  if (type === 'jungle' || type === 'river' || type === 'finish' || type === 'village') {
    const color =
      type === 'jungle' ? '#d8f0c8' : type === 'village' ? '#4a3408' : '#e8f4ff'

    if (type === 'river' || type === 'finish') {
      const count = Math.min(3, n)
      const spread = count === 1 ? [0] : count === 2 ? [-5.5, 5.5] : [-7, 0, 7]
      return (
        <g>
          {spread.map((ox, i) => {
            const cx = x + ox
            const rot = -28 + i * 10
            return (
              <g key={i} transform={`rotate(${rot} ${cx} ${y})`}>
                {/* blade */}
                <ellipse cx={cx} cy={y - 3.2} rx={2.6} ry={4.2} fill={color} />
                {/* shaft */}
                <rect
                  x={cx - 0.7}
                  y={y + 0.4}
                  width={1.4}
                  height={6.5}
                  rx={0.7}
                  fill={color}
                />
              </g>
            )
          })}
        </g>
      )
    }

    // Village power 4: four coin dots at N/E/S/W.
    if (type === 'village' && n >= 4) {
      const d = 5.5
      const spots: [number, number][] = [
        [0, -d],
        [d, 0],
        [0, d],
        [-d, 0],
      ]
      return (
        <g>
          {spots.map(([ox, oy], i) => (
            <circle
              key={i}
              cx={x + ox}
              cy={y + oy}
              r={2.8}
              fill={color}
              stroke="#3a2a08"
              strokeWidth={0.55}
            />
          ))}
        </g>
      )
    }

    const marks = []
    const spread = n === 1 ? [0] : n === 2 ? [-5, 5] : [-6.5, 0, 6.5]
    for (let i = 0; i < Math.min(3, n); i++) {
      const ox = spread[i] ?? 0
      if (type === 'village') {
        marks.push(
          <circle key={i} cx={x + ox} cy={y} r={3.4} fill={color} stroke="#3a2a08" strokeWidth={0.55} />,
        )
      } else {
        marks.push(
          <rect
            key={i}
            x={x + ox - 1.1}
            y={y - 5.5}
            width={2.2}
            height={11}
            rx={0.7}
            fill={color}
            transform={`rotate(${-35 + i * 8} ${x + ox} ${y})`}
          />,
        )
      }
    }
    return <g>{marks}</g>
  }
  return null
}

export function Board({
  cells,
  positions,
  highlights,
  onCellClick,
  currentPos,
  selectedPieceId,
  showTileLetters = false,
}: Props) {
  const size = BOARD_HEX_SIZE
  const wrapRef = useRef<HTMLDivElement>(null)
  const list = Object.values(cells)
  const empty = list.length === 0

  const xs = empty ? [] : list.map((c) => hexToPixel(c.q, c.r, size).x)
  const ys = empty ? [] : list.map((c) => hexToPixel(c.q, c.r, size).y)
  const pad = size * 2.2
  const minX = empty ? 0 : Math.min(...xs) - pad
  const maxX = empty ? 0 : Math.max(...xs) + pad
  const minY = empty ? 0 : Math.min(...ys) - pad
  const maxY = empty ? 0 : Math.max(...ys) + pad
  const width = maxX - minX
  const height = maxY - minY

  const focusKey =
    currentPos ??
    (selectedPieceId
      ? list.find((c) => c.pieceId === selectedPieceId)?.id ?? null
      : null)

  useEffect(() => {
    if (empty || !focusKey || !wrapRef.current) return
    const cell = cells[focusKey]
    if (!cell) return
    const { x, y } = hexToPixel(cell.q, cell.r, size)
    const wrap = wrapRef.current
    wrap.scrollLeft = Math.max(0, x - minX - wrap.clientWidth / 2)
    wrap.scrollTop = Math.max(0, y - minY - wrap.clientHeight / 2)
  }, [focusKey])

  if (empty) {
    return <div className="board-wrap" ref={wrapRef} />
  }

  const byCell = new Map<string, typeof positions>()
  for (const p of positions) {
    const arr = byCell.get(p.cellId) ?? []
    arr.push(p)
    byCell.set(p.cellId, arr)
  }

  const seams = tileBorderEdges(cells, size)
  const labels = showTileLetters ? tileLabelPositions(cells, size) : []
  const connectors = blockadeConnectors(cells, size)

  return (
    <div className="board-wrap" ref={wrapRef}>
      <svg
        className="board-svg"
        width={Math.round(width)}
        height={Math.round(height)}
        viewBox={`${minX} ${minY} ${width} ${height}`}
        role="img"
        aria-label="Expedition map"
      >
        <defs>
          <filter id="tile-shade" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.35" />
          </filter>
        </defs>

        {seams.map((e, i) => (
          <line
            key={`seam-${i}`}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke="#1a1208"
            strokeWidth={size * 0.55}
            strokeLinecap="round"
            opacity={0.85}
          />
        ))}

        {list.map((cell) => {
          const { x, y } = hexToPixel(cell.q, cell.r, size)
          const hi = highlights.includes(cell.id)
          const isHere = cell.id === currentPos
          const selected = Boolean(selectedPieceId && cell.pieceId === selectedPieceId)
          const fill = fillForPower(cell.type, cell.power)
          return (
            <g
              key={cell.id}
              className={`hex ${hi ? 'hex-hi' : ''} ${isHere ? 'hex-here' : ''} ${selected ? 'hex-selected' : ''}`}
              onClick={() => onCellClick(cell.id)}
              style={{ cursor: 'pointer' }}
              filter={cell.tile !== 'seam' ? 'url(#tile-shade)' : undefined}
            >
              <polygon
                points={hexPolygon(x, y, size * 0.95)}
                fill={selected ? '#ffe08a' : fill}
                stroke={
                  hi ? '#ffe08a' : selected ? '#fff8dc' : isHere ? '#ffe08a' : '#0d1a10'
                }
                strokeWidth={hi ? 3.8 : selected ? 2.6 : isHere ? 2.2 : 1}
              />
              {cell.isStart != null && (
                <text x={x} y={y + 5} textAnchor="middle" className="hex-label" fill="#fff" fontSize={12}>
                  {cell.isStart}
                </text>
              )}
              {cell.isStart == null && (
                <SymbolMarks type={cell.type} power={cell.power} x={x} y={y} />
              )}
            </g>
          )
        })}

        {connectors.map((conn) => {
          if (conn.path.length < 2) return null
          const mid = connectorCentroid(conn.path)
          const color = blockadeColor(conn.symbols)
          const glyph = blockadeGlyph(conn.symbols)
          // ~1/3 of hex flat-to-flat width
          const stripW = size * (Math.sqrt(3) / 3)
          return (
            <g key={`connector-${conn.id}`} className="blockade-connector" pointerEvents="none">
              <polyline
                points={conn.path.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#1a1208"
                strokeWidth={stripW + 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />
              <polyline
                points={conn.path.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={stripW}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx={mid.x}
                cy={mid.y}
                r={size * 0.32}
                fill="#1a1208"
                stroke={color}
                strokeWidth={1.5}
              />
              <text
                x={mid.x}
                y={mid.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                className="hex-label"
                fill="#f4e6c0"
                fontSize={size * 0.3}
                fontWeight={700}
              >
                {glyph}
                {conn.power}
              </text>
            </g>
          )
        })}

        {list.map((cell) => {
          const tokens = byCell.get(cell.id) ?? []
          if (!tokens.length) return null
          const { x, y } = hexToPixel(cell.q, cell.r, size)
          const tokenR = size * 0.72
          const step = tokens.length > 1 ? size * 0.28 : 0
          const start = -((tokens.length - 1) * step) / 2
          return tokens.map((p, i) => (
            <circle
              key={p.id}
              cx={x + start + i * step}
              cy={y}
              r={tokenR}
              fill={p.color}
              stroke="#fff"
              strokeWidth={2.2}
              style={{ pointerEvents: 'none' }}
            >
              <title>{p.name}</title>
            </circle>
          ))
        })}

        {labels.map((l, i) => (
          <text
            key={`${l.tile}-${i}-${l.x}`}
            x={l.x}
            y={l.y + 6}
            textAnchor="middle"
            className="tile-letter"
            fill="rgba(255,255,255,0.28)"
            fontSize={size * (l.tile === 'E' ? 1.6 : 2.2)}
            pointerEvents="none"
          >
            {l.tile}
          </text>
        ))}
      </svg>
    </div>
  )
}
